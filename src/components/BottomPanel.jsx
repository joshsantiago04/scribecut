import { useState, useRef } from "react";

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
    const [dragStart, setDragStart] = useState(null);
    const [dragEnd, setDragEnd] = useState(null);
    const isDragging = useRef(false);

    const displayList = timestamps && timestamps.length > 0 ? timestamps : (segments || []);

    const selectedRange = dragStart !== null && dragEnd !== null
        ? [Math.min(dragStart, dragEnd), Math.max(dragStart, dragEnd)]
        : null;

    const handleMouseDown = (i) => {
        isDragging.current = true;
        setDragStart(i);
        setDragEnd(i);
    };

    const handleMouseEnter = (i) => {
        if (isDragging.current) setDragEnd(i);
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleAddSelection = (e) => {
        e.stopPropagation();
        if (!selectedRange) return;
        const selected = displayList.slice(selectedRange[0], selectedRange[1] + 1);
        if (selected.length === 0) return;
        onAddToExport({ start: selected[0].start, end: selected[selected.length - 1].end });
        setDragStart(null);
        setDragEnd(null);
    };

    return (
        <div className="bottom" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className="bottom-tabs">
                <div className="bottom-tab active">Transcript</div>
                {selectedRange && selectedRange[0] !== selectedRange[1] && (
                    <button className="selection-add-btn" onClick={handleAddSelection}>
                        + Add selection as clip
                    </button>
                )}
            </div>

            <div className="bottom-content">
                {displayList.length > 0 ? (
                    <div style={{ lineHeight: "1.6" }}>
                        {displayList.map((s, i) => {
                            const isSelected = selectedRange && i >= selectedRange[0] && i <= selectedRange[1];
                            return (
                                <div
                                    key={i}
                                    className={`timestamp-item ${isSelected ? "timestamp-selected" : ""}`}
                                    onClick={() => onTimestampClick(s.start)}
                                    onMouseDown={() => handleMouseDown(i)}
                                    onMouseEnter={() => handleMouseEnter(i)}
                                    style={{ cursor: "pointer", userSelect: "none" }}
                                >
                                    <span className="timestamp-text">{s.text}</span>
                                    <span className="timestamp-time">({formatTime(s.start)})</span>
                                    <button
                                        className="add-to-export-btn"
                                        title="Add to export queue"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddToExport({ start: s.start, end: s.end });
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="timestamp-text">
                        Autogenerate a transcript with timestamps.
                    </div>
                )}
            </div>
        </div>
    );
}
