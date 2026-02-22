import logo from '../assets/peaklogo.webp';

export default function Titlebar() {
  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <img src={logo} alt="ClipFindr" className="titlebar-logo" />
        <span className="titlebar-title">ClipFindr - An AI Video Clip Search Tool</span>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => window.electronAPI?.minimize()}>&#8212;</button>
        <button className="titlebar-btn" onClick={() => window.electronAPI?.maximize()}>&#9633;</button>
        <button className="titlebar-btn close" onClick={() => window.electronAPI?.close()}>&#10005;</button>
      </div>
    </div>
  );
}
