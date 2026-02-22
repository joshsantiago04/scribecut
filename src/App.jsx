import { useState } from 'react';
import Sidebar from './components/Sidebar';
import VideoPlayer from './components/VideoPlayer';
import SearchPanel from './components/SearchPanel';
import BottomPanel from './components/BottomPanel';

const EXAMPLE_TIMESTAMPS = [
  { time: '00:12', text: 'Example transcript line' },
  { time: '01:45', text: 'Another result' },
  { time: '03:22', text: 'Keyword match found here' },
];

export default function App() {
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([
    { type: 'system', text: 'Upload a video to begin searching transcripts.' },
  ]);
  const [timestamps, setTimestamps] = useState(EXAMPLE_TIMESTAMPS);

  const handleUpload = () => {
    // Will be wired to file input / drag-and-drop
  };

  const handleTimestampClick = (time) => {
    // Will seek video to timestamp
  };

  const videoSrc = activeVideo >= 0 ? videos[activeVideo]?.url : null;

  return (
    <>
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
