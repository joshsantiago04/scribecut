function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function parseTime(str) {
    const parts = str.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    if (parts.length === 2) return parts[0] * 60 + (parts[1] || 0);
    return parseFloat(str) || 0;
}

export default function SearchPanel({
    query,
    onQueryChange,
    messages,
    exportQueue,
    outputDir,
    onSelectOutputDir,
    onUpdateClip,
    onRemoveClip,
    onExport,
}) {
    return (
        <div className="right">
            {/* ── Top: Search ── */}
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
                        <div
                            key={i}
                            className={`chat-message ${msg.type === "system" ? "system" : ""}`}
                        >
                            {msg.text}
                        </div>
                    ))}
                </div>
            </div>

            <div className="right-divider" />

            {/* ── Bottom: Export ── */}
            <div className="right-pane export-pane">
                <div className="right-header">
                    Export Clips
                    {exportQueue.length > 0 && (
                        <span className="export-badge">{exportQueue.length}</span>
                    )}
                </div>

                <div className="export-clips">
                    {exportQueue.length === 0 ? (
                        <div className="export-empty">
                            Press + on any clip below to queue it for export.
                        </div>
                    ) : (
                        exportQueue.map((clip) => (
                            <div key={clip.id} className="export-clip-item">
                                <div className="export-clip-header">
                                    <span className="export-clip-name" title={clip.videoName}>
                                        {clip.videoName}
                                    </span>
                                    <button
                                        className="clip-remove-btn"
                                        onClick={() => onRemoveClip(clip.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="export-clip-times">
                                    <div className="time-field">
                                        <label className="time-label">Start</label>
                                        <input
                                            className="time-input"
                                            key={`${clip.id}-start`}
                                            defaultValue={formatTime(clip.start)}
                                            onBlur={(e) =>
                                                onUpdateClip(clip.id, "start", parseTime(e.target.value))
                                            }
                                        />
                                    </div>
                                    <div className="time-field">
                                        <label className="time-label">End</label>
                                        <input
                                            className="time-input"
                                            key={`${clip.id}-end`}
                                            defaultValue={formatTime(clip.end)}
                                            onBlur={(e) =>
                                                onUpdateClip(clip.id, "end", parseTime(e.target.value))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="export-footer">
                    <div className="export-label">Output Folder</div>
                    <div className="export-dir-row">
                        <span className="export-dir-path" title={outputDir}>
                            {outputDir || "No folder selected"}
                        </span>
                        <button className="export-browse-btn" onClick={onSelectOutputDir}>
                            Browse
                        </button>
                    </div>
                    <button
                        className="export-btn"
                        disabled={exportQueue.length === 0 || !outputDir}
                        onClick={onExport}
                    >
                        Export {exportQueue.length > 0
                            ? `${exportQueue.length} clip${exportQueue.length !== 1 ? "s" : ""}`
                            : ""}
                    </button>
                </div>
            </div>
        </div>
    );
}
