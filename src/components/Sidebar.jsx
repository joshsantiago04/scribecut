import { useState } from 'react';

export default function Sidebar({ videos, activeVideo, onSelectVideo, onUpload }) {
  return (
    <div className="sidebar">
      <button className="upload-btn" onClick={onUpload}>+ Upload Video</button>
      <div className="video-list-label">Videos</div>
      <div className="video-list">
        {videos.length === 0 ? (
          <div className="video-list-empty">No videos uploaded</div>
        ) : (
          videos.map((video, i) => (
            <div
              key={i}
              className={`video-list-item ${activeVideo === i ? 'active' : ''}`}
              onClick={() => onSelectVideo(i)}
            >
              {video.name}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
