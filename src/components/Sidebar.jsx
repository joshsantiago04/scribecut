export default function Sidebar({ videos, activeVideo, onSelectVideo, onUpload, onTranscribe }) {
  const active = activeVideo >= 0 ? videos[activeVideo] : null;

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
              <span className={`status-dot status-${video.status}`} title={video.status} />
              <span className="video-item-name">{video.name}</span>
            </div>
          ))
        )}
      </div>
      {active && (
        <button
          className="transcribe-btn"
          onClick={() => onTranscribe(activeVideo)}
          disabled={active.status !== 'pending'}
        >
          {active.status === 'transcribing' ? 'Transcribing...' :
           active.status === 'done' ? '✓ Transcribed' : 'Transcribe'}
        </button>
      )}
    </div>
  );
}
