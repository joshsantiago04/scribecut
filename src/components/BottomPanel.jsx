import { useState } from 'react';

const TABS = ['Timestamps', 'Transcript', 'Console'];

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

export default function BottomPanel({ timestamps, segments, onTimestampClick }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="bottom">
      <div className="bottom-tabs">
        {TABS.map((tab, i) => (
          <div
            key={tab}
            className={`bottom-tab ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="bottom-content">
        {activeTab === 0 &&
          timestamps.map((ts, i) => (
            <div
              key={i}
              className="timestamp-item"
              onClick={() => onTimestampClick(ts.start)}
            >
              <span className="timestamp-time">[{formatTime(ts.start)}]</span>
              <span className="timestamp-text">{ts.text}</span>
            </div>
          ))}
        {activeTab === 1 && (
          segments && segments.length > 0
            ? <div className="timestamp-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {segments.map(s => s.text).join(' ')}
              </div>
            : <div className="timestamp-text">Transcript will appear here.</div>
        )}
        {activeTab === 2 && (
          <div className="timestamp-text">Console output will appear here.</div>
        )}
      </div>
    </div>
  );
}
