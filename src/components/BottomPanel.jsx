import { useState } from 'react';

const TABS = ['Timestamps', 'Transcript', 'Console'];

export default function BottomPanel({ timestamps, onTimestampClick }) {
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
              onClick={() => onTimestampClick(ts.time)}
            >
              <span className="timestamp-time">[{ts.time}]</span>
              <span className="timestamp-text">{ts.text}</span>
            </div>
          ))}
        {activeTab === 1 && (
          <div className="timestamp-text">Transcript will appear here.</div>
        )}
        {activeTab === 2 && (
          <div className="timestamp-text">Console output will appear here.</div>
        )}
      </div>
    </div>
  );
}
