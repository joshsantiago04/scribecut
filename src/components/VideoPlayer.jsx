import { forwardRef } from 'react';

const VideoPlayer = forwardRef(function VideoPlayer({ src }, ref) {
  return (
    <div className="main">
      <div className="video-container">
        {src ? (
          <video ref={ref} controls src={src} />
        ) : (
          <div className="video-placeholder">
            <div className="upload-icon">&#9654;</div>
            <span>Add a video by clicking the "Upload Video" button</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default VideoPlayer;
