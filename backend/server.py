from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

import transcribe as transcribe_module
import search as search_module
import peaks as peaks_module  # NEW

app = FastAPI()

# Allow Electron renderer (localhost) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    path: str


class Segment(BaseModel):
    start: float
    end: float
    text: str


class SearchRequest(BaseModel):
    query: str
    segments: list[Segment]


class PeaksRequest(BaseModel):  # NEW
    path: str
    pre_pad: float = 20.0
    post_pad: float = 10.0
    min_prominence_db: float = 8.0
    min_gap_s: float = 30.0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/transcribe")
def transcribe(req: TranscribeRequest):
    """Accept a video file path, return transcript segments with timestamps."""
    try:
        segments = transcribe_module.transcribe(req.path)
        return {"segments": segments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
def search(req: SearchRequest):
    """Fuzzy search a keyword over transcript segments.
    Returns only { start, end } for matching segments."""
    seg_dicts = [s.model_dump() for s in req.segments]
    results = search_module.find_matches(req.query, seg_dicts)
    return {"results": results}


@app.post("/peaks")
def peaks(req: PeaksRequest):
    """Detect loud audio peaks and return clip candidates."""
    try:
        clips = peaks_module.detect_clips(
            video_path=req.path,
            pre_pad=req.pre_pad,
            post_pad=req.post_pad,
            min_prominence_db=req.min_prominence_db,
            min_gap_s=req.min_gap_s,
        )
        return {"clips": clips}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)