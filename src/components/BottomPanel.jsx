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
}) {
    const [activeTab, setActiveTab] = useState(0);

    // Split current "timestamps" into two buckets:
    // - audio clips: no text
    // - transcript matches: has text
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
                {/* TAB 0: Timestamps (AUDIO CLIPS ONLY) */}
                {activeTab === 0 &&
                    (audioClips.length > 0 ? (
                        audioClips.map((ts, i) => (
                            <div
                                key={i}
                                className="timestamp-item"
                                onClick={() => onTimestampClick(ts.start)}
                            >
                                <span className="timestamp-time">
                                    [{formatTime(ts.start)} –{" "}
                                    {formatTime(ts.end)}]
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="timestamp-text">
                            Auto-detect notable peaks in volume. Useful for
                            finding louder moments, especially in gaming.
                        </div>
                    ))}

                {/* TAB 1: Transcript (SEARCH MATCHES IF PRESENT, ELSE FULL TRANSCRIPT) */}
                {activeTab === 1 &&
                    (segments && segments.length > 0 ? (
                        <div style={{ lineHeight: "1.6" }}>
                            {(transcriptMatches.length > 0
                                ? transcriptMatches
                                : segments
                            ).map((s, i) => (
                                <div
                                    key={i}
                                    className="timestamp-item"
                                    onClick={() => onTimestampClick(s.start)}
                                >
                                    <span className="timestamp-text">
                                        {s.text}
                                    </span>{" "}
                                    <span className="timestamp-time">
                                        ({formatTime(s.start)})
                                    </span>
                                </div>
                            ))}
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
