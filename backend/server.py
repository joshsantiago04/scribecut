from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
import subprocess
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

# ── Lazy module cache ─────────────────────────────────────────────────────────
# faster-whisper, librosa, scipy are heavy — only import them on first use
# so the server starts up fast and the window appears immediately.

_transcribe = None
_search = None
_peaks = None

def get_transcribe():
    global _transcribe
    if _transcribe is None:
        import transcribe as m
        _transcribe = m
    return _transcribe

def get_search():
    global _search
    if _search is None:
        import search as m
        _search = m
    return _search

def get_peaks():
    global _peaks
    if _peaks is None:
        import peaks as m
        _peaks = m
    return _peaks


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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/stream")
def stream_video(path: str):
    """Serve a local video file. FileResponse handles Range requests natively."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


@app.post("/transcribe")
def transcribe(req: TranscribeRequest):
    try:
        segments = get_transcribe().transcribe(req.path)
        return {"segments": segments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
def search(req: SearchRequest):
    seg_dicts = [s.model_dump() for s in req.segments]
    results = get_search().find_matches(req.query, seg_dicts)
    return {"results": results}


class PeaksRequest(BaseModel):
    path: str
    pre_pad: float = 20.0
    post_pad: float = 10.0
    min_prominence_db: float = 8.0
    min_gap_s: float = 30.0


@app.post("/peaks")
def peaks(req: PeaksRequest):
    try:
        clips = get_peaks().detect_clips(
            video_path=req.path,
            pre_pad=req.pre_pad,
            post_pad=req.post_pad,
            min_prominence_db=req.min_prominence_db,
            min_gap_s=req.min_gap_s,
        )
        return {"clips": clips}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ExportClip(BaseModel):
    videoPath: str
    start: float
    end: float
    filename: str


class ExportRequest(BaseModel):
    clips: list[ExportClip]
    outputDir: str


@app.post("/export")
def export_clips(req: ExportRequest):
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    os.makedirs(req.outputDir, exist_ok=True)
    exported = []
    for clip in req.clips:
        out_path = os.path.join(req.outputDir, clip.filename)
        try:
            subprocess.run(
                [
                    ffmpeg, "-y",
                    "-ss", str(clip.start),
                    "-i", clip.videoPath,
                    "-t", str(clip.end - clip.start),
                    "-c:v", "copy",
                    "-c:a", "aac",
                    out_path,
                ],
                check=True,
                capture_output=True,
            )
            exported.append(out_path)
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=e.stderr.decode())
    return {"exported": exported}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
