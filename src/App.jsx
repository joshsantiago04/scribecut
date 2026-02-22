import { useState, useRef, useEffect } from 'react';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import VideoPlayer from './components/VideoPlayer';
import SearchPanel from './components/SearchPanel';
import BottomPanel from './components/BottomPanel';

const API = 'http://localhost:8000';

export default function App() {
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([
    { type: 'system', text: 'Upload videos, select one, then click Transcribe.' },
  ]);
  const [timestamps, setTimestamps] = useState([]);

  const videoRef = useRef(null);

  const segments = activeVideo >= 0 ? (videos[activeVideo]?.segments ?? []) : [];

  // Update message when switching active video
  useEffect(() => {
    if (activeVideo < 0) return;
    const video = videos[activeVideo];
    if (!video) return;
    setTimestamps([]);
    setSearchQuery('');
    if (video.status === 'done') {
      setMessages([{ type: 'system', text: 'Transcription complete. Type to search.' }]);
    } else {
      setMessages([{ type: 'system', text: 'Click Transcribe to begin.' }]);
    }
  }, [activeVideo]);

  // Debounced search whenever the query changes
  useEffect(() => {
    if (!searchQuery.trim() || segments.length === 0) {
      setTimestamps([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`${API}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, segments }),
      })
        .then(r => r.json())
        .then(data => {
          setTimestamps(data.results);
          const count = data.results.length;
          setMessages([{ type: 'system', text: `Found ${count} match${count !== 1 ? 'es' : ''}.` }]);
        })
        .catch(err => {
          setMessages([{ type: 'system', text: `Search failed: ${err.message}` }]);
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, segments]);

  const handleUpload = async () => {
    if (!window.electronAPI) return;
    const filePaths = await window.electronAPI.openFile();
    if (!filePaths) return;

    setVideos(prev => {
      const existing = new Set(prev.map(v => v.path));
      const newVids = filePaths
        .filter(fp => !existing.has(fp))
        .map(fp => ({
          name: fp.split(/[\\/]/).pop(),
          path: fp,
          url: 'file://' + fp.replace(/\\/g, '/'),
          status: 'pending',
          segments: [],
        }));
      const updated = [...prev, ...newVids];
      if (prev.length === 0 && newVids.length > 0) setActiveVideo(0);
      return updated;
    });
  };

  const handleTranscribe = async (index) => {
    const video = videos[index];
    if (!video || video.status !== 'pending') return;

    setVideos(prev => prev.map((v, i) => i === index ? { ...v, status: 'transcribing' } : v));
    setMessages([{ type: 'system', text: `Transcribing ${video.name}...` }]);

    try {
      const r = await fetch(`${API}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: video.path }),
      });
      const data = await r.json();
      setVideos(prev => prev.map((v, i) =>
        i === index ? { ...v, status: 'done', segments: data.segments } : v
      ));
      setMessages([{ type: 'system', text: 'Transcription complete. Type to search.' }]);
    } catch (err) {
      setVideos(prev => prev.map((v, i) => i === index ? { ...v, status: 'pending' } : v));
      setMessages([{ type: 'system', text: `Transcription failed: ${err.message}` }]);
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
      />
      <VideoPlayer ref={videoRef} src={videoSrc} />
      <SearchPanel
        query={searchQuery}
        onQueryChange={setSearchQuery}
        messages={messages}
      />
      <BottomPanel
        timestamps={timestamps}
        segments={segments}
        onTimestampClick={handleTimestampClick}
      />
    </>
  );
}
