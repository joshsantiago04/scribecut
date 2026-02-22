import { useState } from "react";

const TABS = ["Audio Detect", "Transcript"];

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function BottomPanel({
    timestamps,
    segments,
    onTimestampClick,
    onAddToExport,
}) {
    const [activeTab, setActiveTab] = useState(0);

    const audioClips = (timestamps || []).filter(
        (ts) => typeof ts.text !== "string" || ts.text.trim() === "",
    );

    const transcriptMatches = (timestamps || []).filter(
        (ts) => typeof ts.text === "string" && ts.text.trim() !== "",
    );

    return (
        <div className="bottom">
            <div className="bottom-tabs">
                {TABS.map((tab, i) => (
                    <div
                        key={tab}
                        className={`bottom-tab ${activeTab === i ? "active" : ""}`}
                        onClick={() => setActiveTab(i)}
                    >
                        {tab}
                    </div>
                ))}
            </div>

            <div className="bottom-content">
                {/* TAB 0: Audio Detect clips */}
                {activeTab === 0 &&
                    (audioClips.length > 0 ? (
                        audioClips.map((ts, i) => (
                            <div key={i} className="timestamp-item">
                                <span
                                    className="timestamp-time"
                                    onClick={() => onTimestampClick(ts.start)}
                                >
                                    [{formatTime(ts.start)} – {formatTime(ts.end)}]
                                </span>
                                <button
                                    className="add-to-export-btn"
                                    title="Add to export queue"
                                    onClick={() => onAddToExport({ start: ts.start, end: ts.end })}
                                >
                                    +
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="timestamp-text">
                            Auto-detect notable peaks in volume. Useful for finding louder
                            moments, especially in gaming.
                        </div>
                    ))}

                {/* TAB 1: Transcript — search matches if present, else full transcript */}
                {activeTab === 1 &&
                    (segments && segments.length > 0 ? (
                        <div style={{ lineHeight: "1.6" }}>
                            {(transcriptMatches.length > 0 ? transcriptMatches : segments).map(
                                (s, i) => (
                                    <div key={i} className="timestamp-item">
                                        <span
                                            className="timestamp-text"
                                            onClick={() => onTimestampClick(s.start)}
                                        >
                                            {s.text}
                                        </span>
                                        <span className="timestamp-time">
                                            ({formatTime(s.start)})
                                        </span>
                                        <button
                                            className="add-to-export-btn"
                                            title="Add to export queue"
                                            onClick={() =>
                                                onAddToExport({ start: s.start, end: s.end })
                                            }
                                        >
                                            +
                                        </button>
                                    </div>
                                ),
                            )}
                        </div>
                    ) : (
                        <div className="timestamp-text">
                            Autogenerate a transcript with timestamps.
                        </div>
                    ))}
            </div>
        </div>
    );
}
