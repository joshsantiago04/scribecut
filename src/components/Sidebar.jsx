export default function Sidebar({
    videos,
    activeVideo,
    onSelectVideo,
    onUpload,
    onTranscribe,
    transcribeProgress,
    transcribeModel,
    onModelChange,
    useGpu,
    onGpuChange,
    cudaAvailable,
    gpuName,
}) {
    const active = activeVideo >= 0 ? videos[activeVideo] : null;

    return (
        <div className="sidebar">
            <button className="upload-btn" onClick={onUpload}>
                + Upload Video
            </button>
            <div className="video-list-label">Videos</div>
            <div className="video-list">
                {videos.length === 0 ? (
                    <div className="video-list-empty">No videos uploaded</div>
                ) : (
                    videos.map((video, i) => (
                        <div
                            key={i}
                            className={`video-list-item ${activeVideo === i ? "active" : ""}`}
                            onClick={() => onSelectVideo(i)}
                        >
                            <span
                                className={`status-dot status-${video.status}`}
                                title={video.status}
                            />
                            <span className="video-item-name">
                                {video.name}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {active && (
                <>
                    <button
                        className="transcribe-btn"
                        onClick={() => onTranscribe(activeVideo)}
                        disabled={active.status !== "pending"}
                    >
                        {active.status === "transcribing"
                            ? "Transcribing..."
                            : active.status === "done"
                              ? "✓ Transcribed"
                              : "Transcribe"}
                    </button>
                    {transcribeProgress !== null && (
                        <div className="transcribe-progress">
                            <div
                                className="transcribe-progress-fill"
                                style={{ width: `${transcribeProgress}%` }}
                            />
                            <span className="transcribe-progress-label">
                                {transcribeProgress < 100 ? `${transcribeProgress}%` : "Done"}
                            </span>
                        </div>
                    )}

                </>
            )}

            <div className="sidebar-settings">
                <div className="video-list-label">Transcribe Settings</div>
                <div className="setting-row">
                    <label className="setting-label">Model</label>
                    <select
                        className="setting-select"
                        value={transcribeModel}
                        onChange={(e) => onModelChange(e.target.value)}
                        size="1"
                    >
                        <option value="small">Small (fast)</option>
                        <option value="medium">Medium (balanced)</option>
                        <option value="large-v3">Large (best)</option>
                    </select>
                </div>
                <div className="setting-row">
                    <label className={`setting-label ${!cudaAvailable ? "setting-label--dim" : ""}`}>
                        GPU
                        {cudaAvailable && gpuName ? (
                            <span className="setting-gpu-name" title={gpuName}>
                                {gpuName.replace(/NVIDIA\s*/i, "").replace(/GeForce\s*/i, "")}
                            </span>
                        ) : !cudaAvailable ? (
                            <span className="setting-na">(N/A)</span>
                        ) : null}
                    </label>
                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={useGpu}
                            disabled={!cudaAvailable}
                            onChange={(e) => onGpuChange(e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>
                </div>
            </div>
        </div>
    );
}
