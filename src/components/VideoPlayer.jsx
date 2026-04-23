import { forwardRef, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00.0';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
};

const IconRestart = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
    <rect x="2" y="2" width="2.5" height="12" rx="1"/>
    <polygon points="14,2 6,8 14,14"/>
  </svg>
);
const IconSkipBack = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
    <polygon points="9,2 3,8 9,14"/>
    <polygon points="14,2 8,8 14,14"/>
  </svg>
);
const IconPlay = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
    <polygon points="3,1 13,8 3,15"/>
  </svg>
);
const IconPause = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
    <rect x="2" y="1" width="4" height="14" rx="1"/>
    <rect x="10" y="1" width="4" height="14" rx="1"/>
  </svg>
);
const IconSkipFwd = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
    <polygon points="2,2 8,8 2,14"/>
    <polygon points="7,2 13,8 7,14"/>
  </svg>
);
const IconScissors = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
    <circle cx="4" cy="4" r="2.2" fillOpacity="0" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="4" cy="12" r="2.2" fillOpacity="0" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="6" y1="5.5" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="6" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const VideoPlayer = forwardRef(function VideoPlayer({ src, peaks, onRegionAdd, onResizerMouseDown }, ref) {
  const waveContainerRef = useRef(null);
  const wsRef = useRef(null);
  const regionsRef = useRef(null);
  const unsubDragRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [clipMode, setClipMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const video = ref?.current;
    if (!video || !src) return;
    const onTime  = () => setCurrentTime(video.currentTime);
    const onMeta  = () => setDuration(video.duration);
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [src]);

  useEffect(() => {
    if (!src || !peaks || !waveContainerRef.current || !ref?.current) return;
    if (wsRef.current) { wsRef.current.destroy(); wsRef.current = null; }
    setSelection(null);
    setClipMode(false);
    if (unsubDragRef.current) { unsubDragRef.current(); unsubDragRef.current = null; }

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    wsRef.current = WaveSurfer.create({
      container: waveContainerRef.current,
      waveColor: '#3d4460',
      progressColor: '#4ecfd4',
      media: ref.current,
      height: 56,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      interact: true,
      dragToSeek: false,
      normalize: true,
      peaks: [peaks],
      duration: ref.current.duration || undefined,
      plugins: [regions],
    });

    const styleRegion = (region) => {
      if (!region.element) return;
      region.element.style.borderRadius = '2px';
      region.element.style.border = '1px solid rgba(78, 207, 212, 0.5)';
      Array.from(region.element.children).forEach((child) => {
        if (child.style.cursor === 'ew-resize') {
          child.style.width = '6px';
          child.style.background = 'rgba(78, 207, 212, 0.8)';
          child.style.borderRadius = '2px';
        }
      });
    };

    regions.on('region-created', (region) => {
      regions.getRegions().forEach((r) => { if (r.id !== region.id) r.remove(); });
      styleRegion(region);
      setSelection({ start: region.start, end: region.end });
    });
    regions.on('region-updated', (region) => {
      setSelection({ start: region.start, end: region.end });
    });

    return () => {
      if (unsubDragRef.current) { unsubDragRef.current(); unsubDragRef.current = null; }
      if (wsRef.current) { wsRef.current.destroy(); wsRef.current = null; }
    };
  }, [src, peaks]);

  useEffect(() => {
    if (!src && wsRef.current) {
      wsRef.current.destroy(); wsRef.current = null;
      setSelection(null); setClipMode(false);
    }
  }, [src]);

  // Custom drag-to-seek — skipped when clip mode is on so RegionsPlugin captures the drag
  useEffect(() => {
    const container = waveContainerRef.current;
    if (!container) return;
    let dragging = false;

    const seek = (clientX) => {
      if (!wsRef.current) return;
      const rect = container.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      wsRef.current.seekTo(ratio);
    };

    // capture phase so we get the event before WaveSurfer's own handlers
    const onDown = (e) => { if (clipMode) return; dragging = true; };
    const onMove = (e) => { if (!dragging || clipMode) return; seek(e.clientX); };
    const onUp   = () => { dragging = false; };

    container.addEventListener('mousedown', onDown, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      container.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [clipMode]);

  const toggleClipMode = () => {
    if (!regionsRef.current) return;
    if (clipMode) {
      if (unsubDragRef.current) { unsubDragRef.current(); unsubDragRef.current = null; }
      regionsRef.current.getRegions().forEach((r) => r.remove());
      setSelection(null);
    } else {
      unsubDragRef.current = regionsRef.current.enableDragSelection({ color: 'rgba(78, 207, 212, 0.18)' });
    }
    setClipMode((v) => !v);
  };

  const handlePlayPause = () => { const v = ref?.current; if (!v) return; isPlaying ? v.pause() : v.play(); };
  const handleRestart   = () => { const v = ref?.current; if (!v) return; v.currentTime = 0; };
  const handleSkipBack  = () => { const v = ref?.current; if (!v) return; v.currentTime = Math.max(0, v.currentTime - 10); };
  const handleSkipFwd   = () => { const v = ref?.current; if (!v) return; v.currentTime = Math.min(v.duration, v.currentTime + 10); };
  const handleVolume    = (e) => { const val = parseFloat(e.target.value); setVolume(val); if (ref?.current) ref.current.volume = val; };
  const handleSpeed     = (e) => { const val = parseFloat(e.target.value); setSpeed(val); if (ref?.current) ref.current.playbackRate = val; };
  const handleAdd = () => { onRegionAdd?.(selection); regionsRef.current?.getRegions().forEach((r) => r.remove()); setSelection(null); };
  const handleClear = () => { regionsRef.current?.getRegions().forEach((r) => r.remove()); setSelection(null); };

  return (
    <div className="main">
      <div className="video-container">
        {src ? (
          <video ref={ref} src={src} preload="metadata" />
        ) : (
          <div className="video-placeholder">
            <div className="upload-icon">&#9654;</div>
            <span>Add a video by clicking the "Upload Video" button</span>
          </div>
        )}
      </div>

      {src && (
        <>
          <div className="bottom-resizer" onMouseDown={onResizerMouseDown} />
          <div className="video-controls">
            <div className="vc-left">
              <button className="vc-btn" onClick={handleRestart} title="Go to start"><IconRestart /></button>
              <button className="vc-btn" onClick={handleSkipBack} title="Back 10s"><IconSkipBack /></button>
              <button className="vc-btn vc-btn--play" onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <IconPause /> : <IconPlay />}
              </button>
              <button className="vc-btn" onClick={handleSkipFwd} title="Forward 10s"><IconSkipFwd /></button>
            </div>

            <div className="vc-timestamp">
              <span className="vc-time-current">{fmt(currentTime)}</span>
              <span className="vc-time-sep">/</span>
              <span className="vc-time-total">{fmt(duration)}</span>
            </div>

            <div className="vc-right">
              <span className="vc-label">Vol</span>
              <input type="range" className="vc-slider" min="0" max="1" step="0.05" value={volume} onChange={handleVolume} />
              <span className="vc-label">Speed</span>
              <select className="vc-speed" value={speed} onChange={handleSpeed}>
                <option value="0.5">0.5×</option>
                <option value="0.75">0.75×</option>
                <option value="1">1×</option>
                <option value="1.25">1.25×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
              <div className="vc-divider" />
              <button
                className={`vc-btn vc-btn--clip ${clipMode ? 'active' : ''}`}
                onClick={toggleClipMode}
                title={clipMode ? 'Exit clip mode' : 'Clip mode'}
              >
                <IconScissors />
              </button>
            </div>
          </div>

          <div className="waveform-bar" ref={waveContainerRef}>
            {!peaks && <div className="waveform-loading">Loading waveform...</div>}
          </div>

          {clipMode && (
            <div className="waveform-selection-bar">
              {selection ? (
                <>
                  <span className="wsel-label">Clip</span>
                  <span className="wsel-time">{fmt(selection.start)}</span>
                  <span className="wsel-arrow">→</span>
                  <span className="wsel-time">{fmt(selection.end)}</span>
                  <span className="wsel-dur">({fmt(selection.end - selection.start)})</span>
                  <button className="waveform-add-btn" onClick={handleAdd}>+ Add Clip</button>
                  <button className="waveform-clear-btn" onClick={handleClear}>✕</button>
                </>
              ) : (
                <span className="wsel-hint">Drag on waveform to select a clip region</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default VideoPlayer;
