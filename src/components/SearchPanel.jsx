export default function SearchPanel({ query, onQueryChange, messages, outputDir, onSelectOutputDir }) {
  return (
    <div className="right">
      {/* ── Top half: Search ── */}
      <div className="right-pane">
        <div className="right-header">Search Transcript</div>
        <div className="search-container">
          <input
            className="search-input"
            type="text"
            placeholder="Search keyword..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <div className="chat-output">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.type === 'system' ? 'system' : ''}`}>
              {msg.text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="right-divider" />

      {/* ── Bottom half: Export ── */}
      <div className="right-pane export-pane">
        <div className="right-header">Export Clips</div>
        <div className="export-body">
          <div className="export-label">Output Folder</div>
          <div className="export-dir-row">
            <span className="export-dir-path">
              {outputDir || 'No folder selected'}
            </span>
            <button className="export-browse-btn" onClick={onSelectOutputDir}>
              Browse
            </button>
          </div>
          <div className="export-hint">
            Clips will be saved to this folder when exported.
          </div>
        </div>
      </div>
    </div>
  );
}
