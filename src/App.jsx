import { useState, useRef, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Titlebar from "./components/Titlebar";
import Sidebar from "./components/Sidebar";
import VideoPlayer from "./components/VideoPlayer";
import SearchPanel from "./components/SearchPanel";
import BottomPanel from "./components/BottomPanel";

const API = "http://localhost:8000";

export default function App() {
    const [videos, setVideos] = useState([]);
    const [activeVideo, setActiveVideo] = useState(-1);
    const [searchQuery, setSearchQuery] = useState("");
    const [messages, setMessages] = useState([
        {
            type: "system",
            text: "Upload videos, select one, then click Transcribe.",
        },
    ]);
    const [timestamps, setTimestamps] = useState([]);
    const [outputDir, setOutputDir] = useState("");
    const [exportQueue, setExportQueue] = useState([]);
    const [waveformPeaks, setWaveformPeaks] = useState(null);
    const [transcribeModel, setTranscribeModel] = useState("small");
    const [useGpu, setUseGpu] = useState(false);
    const [cudaAvailable, setCudaAvailable] = useState(false);
    const [transcribeProgress, setTranscribeProgress] = useState(null); // 0-100 or null

    const videoRef = useRef(null);

    // Show window and fade in after first render to avoid white flash
    useEffect(() => {
        const win = getCurrentWindow();
        win.show().then(() => {
            requestAnimationFrame(() => {
                document.getElementById('root').style.opacity = '1';
            });
        });
    }, []);

    // Check GPU availability once on startup
    useEffect(() => {
        fetch(`${API}/capabilities`)
            .then((r) => r.json())
            .then((data) => setCudaAvailable(data.cuda))
            .catch(() => {});
    }, []);

    const segments =
        activeVideo >= 0 ? (videos[activeVideo]?.segments ?? []) : [];

    // Fetch waveform peaks when active video changes
    useEffect(() => {
        if (activeVideo < 0) return;
        const video = videos[activeVideo];
        if (!video) return;
        setWaveformPeaks(null);
        fetch(`${API}/waveform`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: video.path }),
        })
            .then((r) => r.json())
            .then((data) => setWaveformPeaks(data.peaks ?? null))
            .catch(() => {});
    }, [activeVideo]);

    // Update message when switching active video
    useEffect(() => {
        if (activeVideo < 0) return;
        const video = videos[activeVideo];
        if (!video) return;
        setTimestamps([]);
        setSearchQuery("");
        if (video.status === "done") {
            setMessages([
                {
                    type: "system",
                    text: "Transcription complete. Type to search.",
                },
            ]);
        } else {
            setMessages([
                { type: "system", text: "Click Transcribe to begin." },
            ]);
        }
    }, [activeVideo, videos]);

    // Debounced search whenever the query changes
    useEffect(() => {
        if (!searchQuery.trim() || segments.length === 0) {
            setTimestamps([]);
            return;
        }

        const timer = setTimeout(() => {
            fetch(`${API}/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: searchQuery, segments }),
            })
                .then((r) => r.json())
                .then((data) => {
                    setTimestamps(data.results);
                    const count = data.results.length;
                    setMessages([
                        {
                            type: "system",
                            text: `Found ${count} match${count !== 1 ? "es" : ""}.`,
                        },
                    ]);
                })
                .catch((err) => {
                    setMessages([
                        {
                            type: "system",
                            text: `Search failed: ${err.message}`,
                        },
                    ]);
                });
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, segments]);

    const handleUpload = async () => {
        const filePaths = await invoke("open_file_dialog");
        if (!filePaths) return;

        setVideos((prev) => {
            const existing = new Set(prev.map((v) => v.path));
            const newVids = filePaths
                .filter((fp) => !existing.has(fp))
                .map((fp) => ({
                    name: fp.split(/[\\/]/).pop(),
                    path: fp,
                    url: import.meta.env.DEV
                        ? `${API}/stream?path=${encodeURIComponent(fp)}`
                        : convertFileSrc(fp),
                    status: "pending",
                    segments: [],
                }));
            const updated = [...prev, ...newVids];
            if (prev.length === 0 && newVids.length > 0) setActiveVideo(0);
            return updated;
        });
    };

    const handleTranscribe = async (index) => {
        const video = videos[index];
        if (!video || video.status !== "pending") return;

        setVideos((prev) =>
            prev.map((v, i) =>
                i === index ? { ...v, status: "transcribing" } : v,
            ),
        );
        setMessages([{ type: "system", text: `Transcribing ${video.name}...` }]);
        setTranscribeProgress(0);

        try {
            const r = await fetch(`${API}/transcribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: video.path, model: transcribeModel, use_gpu: useGpu }),
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${r.status}`);
            }

            const reader = r.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let duration = null;
            const collected = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const event = JSON.parse(line.slice(6));
                    if (event.type === "info") {
                        duration = event.duration;
                    } else if (event.type === "segment") {
                        collected.push({ start: event.start, end: event.end, text: event.text });
                        if (duration) {
                            setTranscribeProgress(Math.min(99, Math.round((event.end / duration) * 100)));
                        }
                    } else if (event.type === "error") {
                        throw new Error(event.detail);
                    }
                }
            }

            setVideos((prev) =>
                prev.map((v, i) => i === index ? { ...v, status: "done", segments: collected } : v)
            );
            setTranscribeProgress(100);
            setTimeout(() => setTranscribeProgress(null), 800);
            setMessages([{ type: "system", text: "Transcription complete. Type to search." }]);
        } catch (err) {
            setVideos((prev) =>
                prev.map((v, i) => i === index ? { ...v, status: "pending" } : v)
            );
            setTranscribeProgress(null);
            setMessages([{ type: "system", text: `Transcription failed: ${err.message}` }]);
        }
    };


    const handleSelectOutputDir = async () => {
        const dir = await invoke("open_directory_dialog");
        if (dir) setOutputDir(dir);
    };

    const handleAddToExport = ({ start, end }) => {
        const video = videos[activeVideo];
        if (!video) return;
        const baseName = video.name.replace(/\.[^/.]+$/, "");
        setExportQueue((prev) => {
            const count = prev.filter((c) => c.videoPath === video.path).length + 1;
            const clipName = `${baseName}-${String(count).padStart(3, "0")}`;
            return [
                ...prev,
                {
                    id: `${Date.now()}-${Math.random()}`,
                    videoPath: video.path,
                    videoName: video.name,
                    clipName,
                    start,
                    end,
                },
            ];
        });
    };

    const handleUpdateClip = (id, field, value) => {
        setExportQueue((prev) =>
            prev.map((clip) => (clip.id === id ? { ...clip, [field]: value } : clip)),
        );
    };

    const handleRemoveClip = (id) => {
        setExportQueue((prev) => prev.filter((clip) => clip.id !== id));
    };

    const handleExport = async () => {
        if (!outputDir || exportQueue.length === 0) return;
        setMessages([{ type: "system", text: `Exporting ${exportQueue.length} clip(s)...` }]);
        const clips = exportQueue.map((clip) => ({
            videoPath: clip.videoPath,
            start: clip.start,
            end: clip.end,
            filename: `${clip.clipName}.mp4`,
        }));
        try {
            const r = await fetch(`${API}/export`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clips, outputDir }),
            });
            const data = await r.json();
            setMessages([{ type: "system", text: `Exported ${data.exported.length} clip(s).` }]);
            setExportQueue([]);
        } catch (err) {
            setMessages([{ type: "system", text: `Export failed: ${err.message}` }]);
        }
    };

    const handleTimestampClick = (start) => {
        const video = videoRef.current;
        if (!video) return;

        const seek = () => {
            video.currentTime = start;
            video.play();
        };

        // With preload="none" the video may not have loaded yet — trigger load first
        if (video.readyState >= 1) {
            seek();
        } else {
            video.load();
            video.addEventListener("loadedmetadata", seek, { once: true });
        }
    };

    const [bottomHeight, setBottomHeight] = useState(242);

    const handleResizerMouseDown = (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = bottomHeight;

        const onMove = (e) => {
            const delta = startY - e.clientY;
            const clamped = Math.max(120, Math.min(600, startHeight + delta));
            setBottomHeight(clamped);
            document.documentElement.style.setProperty('--bottom-height', clamped + 'px');
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    useEffect(() => {
        document.documentElement.style.setProperty('--bottom-height', bottomHeight + 'px');
    }, []);

    const videoSrc = activeVideo >= 0 ? videos[activeVideo]?.url : null;

    return (
        <>
            <Titlebar />
            <Sidebar
                videos={videos}
                activeVideo={activeVideo}
                onSelectVideo={setActiveVideo}
                onUpload={handleUpload}
                onTranscribe={handleTranscribe}
                transcribeProgress={transcribeProgress}
                transcribeModel={transcribeModel}
                onModelChange={setTranscribeModel}
                useGpu={useGpu}
                onGpuChange={setUseGpu}
                cudaAvailable={cudaAvailable}
            />
            <VideoPlayer ref={videoRef} src={videoSrc} peaks={waveformPeaks} />
            <div className="bottom-resizer" onMouseDown={handleResizerMouseDown} />
            <SearchPanel
                query={searchQuery}
                onQueryChange={setSearchQuery}
                messages={messages}
                exportQueue={exportQueue}
                outputDir={outputDir}
                onSelectOutputDir={handleSelectOutputDir}
                onUpdateClip={handleUpdateClip}
                onRemoveClip={handleRemoveClip}
                onExport={handleExport}
            />
            <BottomPanel
                timestamps={timestamps}
                segments={segments}
                onTimestampClick={handleTimestampClick}
                onAddToExport={handleAddToExport}
            />
        </>
    );
}
