import { useState } from 'react';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import VideoPlayer from './components/VideoPlayer';
import SearchPanel from './components/SearchPanel';
import BottomPanel from './components/BottomPanel';

export default function App() {
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([
    { type: 'system', text: 'Upload a video to begin searching transcripts.' },
  ]);
  const [timestamps, setTimestamps] = useState([]);

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
        }));
      const updated = [...prev, ...newVids];
      if (prev.length === 0 && newVids.length > 0) setActiveVideo(0);
      return updated;
    });
  };

  const handleTimestampClick = (time) => {
    // TODO: seek video to timestamp
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
      />
      <VideoPlayer src={videoSrc} />
      <SearchPanel
        query={searchQuery}
        onQueryChange={setSearchQuery}
        messages={messages}
      />
      <BottomPanel
        timestamps={timestamps}
        onTimestampClick={handleTimestampClick}
      />
    </>
  );
}
