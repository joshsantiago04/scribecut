import { forwardRef, useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

const VideoPlayer = forwardRef(function VideoPlayer({ src, peaks }, ref) {
  const waveContainerRef = useRef(null);
  const wsRef = useRef(null);

  // Only initialize WaveSurfer once peaks are available — avoids audio decoding entirely
  useEffect(() => {
    if (!src || !peaks || !waveContainerRef.current || !ref?.current) return;

    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }

    wsRef.current = WaveSurfer.create({
      container: waveContainerRef.current,
      waveColor: '#3a3a3a',
      progressColor: '#007acc',
      media: ref.current,
      height: 56,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      interact: true,
      normalize: true,
      peaks: [peaks],
      duration: ref.current.duration || undefined,
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.destroy();
        wsRef.current = null;
      }
    };
  }, [src, peaks]);

  // Destroy waveform when src changes (new video selected)
  useEffect(() => {
    if (!src && wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }
  }, [src]);

  return (
    <div className="main">
      <div className="video-container">
        {src ? (
          <video ref={ref} controls src={src} preload="metadata" controlsList="nofullscreen" />
        ) : (
          <div className="video-placeholder">
            <div className="upload-icon">&#9654;</div>
            <span>Add a video by clicking the "Upload Video" button</span>
          </div>
        )}
      </div>
      {src && (
        <div className="waveform-bar" ref={waveContainerRef}>
          {!peaks && <div className="waveform-loading">Loading waveform...</div>}
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
