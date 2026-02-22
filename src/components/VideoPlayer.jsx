export default function VideoPlayer({ src }) {
  return (
    <div className="main">
      <div className="video-container">
        {src ? (
          <video controls src={src} />
        ) : (
          <div className="video-placeholder">
            <div className="upload-icon">&#9654;</div>
            <span>Drop a video file or click Upload</span>
          </div>
        )}
      </div>
    </div>
  );
}
