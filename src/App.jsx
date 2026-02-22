import { useState, useRef, useEffect } from "react";
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

    const videoRef = useRef(null);

    const segments =
        activeVideo >= 0 ? (videos[activeVideo]?.segments ?? []) : [];

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
        if (!window.electronAPI) return;
        const filePaths = await window.electronAPI.openFile();
        if (!filePaths) return;

        setVideos((prev) => {
            const existing = new Set(prev.map((v) => v.path));
            const newVids = filePaths
                .filter((fp) => !existing.has(fp))
                .map((fp) => ({
                    name: fp.split(/[\\/]/).pop(),
                    path: fp,
                    url: "file://" + fp.replace(/\\/g, "/"),
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
        setMessages([
            { type: "system", text: `Transcribing ${video.name}...` },
        ]);

        try {
            const r = await fetch(`${API}/transcribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: video.path }),
            });
            const data = await r.json();
            setVideos((prev) =>
                prev.map((v, i) =>
                    i === index
                        ? { ...v, status: "done", segments: data.segments }
                        : v,
                ),
            );
            setMessages([
                {
                    type: "system",
                    text: "Transcription complete. Type to search.",
                },
            ]);
        } catch (err) {
            setVideos((prev) =>
                prev.map((v, i) =>
                    i === index ? { ...v, status: "pending" } : v,
                ),
            );
            setMessages([
                {
                    type: "system",
                    text: `Transcription failed: ${err.message}`,
                },
            ]);
        }
    };

    // ✅ NEW: peaks detection
    const handleDetectPeaks = async (index) => {
        const video = videos[index];
        if (!video) return;

        setMessages([
            { type: "system", text: `Detecting peaks for ${video.name}...` },
        ]);

        try {
            const r = await fetch(`${API}/peaks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: video.path }),
            });
            const data = await r.json();
            const clips = data.clips ?? [];
            setTimestamps(clips);
            setMessages([
                {
                    type: "system",
                    text: `Found ${clips.length} peak clip${clips.length !== 1 ? "s" : ""}.`,
                },
            ]);
        } catch (err) {
            setMessages([
                {
                    type: "system",
                    text: `Peak detection failed: ${err.message}`,
                },
            ]);
        }
    };

    const handleSelectOutputDir = async () => {
        if (!window.electronAPI) return;
        const dir = await window.electronAPI.openDirectory?.();
        if (dir) setOutputDir(dir);
    };

    const handleAddToExport = ({ start, end }) => {
        const video = videos[activeVideo];
        if (!video) return;
        setExportQueue((prev) => [
            ...prev,
            {
                id: `${Date.now()}-${Math.random()}`,
                videoPath: video.path,
                videoName: video.name,
                start,
                end,
            },
        ]);
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
        const clips = exportQueue.map((clip, i) => ({
            videoPath: clip.videoPath,
            start: clip.start,
            end: clip.end,
            filename: `${clip.videoName.replace(/\.[^/.]+$/, "")}_clip_${i + 1}.mp4`,
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
        if (videoRef.current) {
            videoRef.current.currentTime = start;
            videoRef.current.play();
        }
    };

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
                onDetectPeaks={handleDetectPeaks} // ✅ NEW prop
            />
            <VideoPlayer ref={videoRef} src={videoSrc} />
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
