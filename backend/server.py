from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
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


# ── Request / Response models ─────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    path: str
    model: str = "small"
    use_gpu: bool = False


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


@app.get("/capabilities")
def capabilities():
    has_cuda = get_transcribe().check_cuda()
    return {"cuda": has_cuda}


@app.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    import asyncio, threading, json

    device = "cuda" if req.use_gpu else "cpu"
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def run():
        try:
            for event in get_transcribe().transcribe_stream(req.path, model_name=req.model, device=device):
                loop.call_soon_threadsafe(queue.put_nowait, event)
        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "detail": str(e)})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "done"})

    threading.Thread(target=run, daemon=True).start()

    async def stream():
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event["type"] in ("done", "error"):
                break

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/search")
def search(req: SearchRequest):
    seg_dicts = [s.model_dump() for s in req.segments]
    results = get_search().find_matches(req.query, seg_dicts)
    return {"results": results}



class WaveformRequest(BaseModel):
    path: str
    samples: int = 1000


@app.post("/waveform")
async def waveform(req: WaveformRequest):
    import asyncio
    import numpy as np
    import imageio_ffmpeg

    def compute():
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        # 100 Hz mono is enough for waveform display and keeps data tiny
        # (a 1-hour video = ~360KB vs ~317MB at 22050Hz)
        result = subprocess.run(
            [
                ffmpeg, "-y",
                "-i", req.path,
                "-ac", "1",
                "-ar", "100",
                "-vn",
                "-f", "f32le",
                "pipe:1",
            ],
            capture_output=True,
            check=True,
        )
        samples = np.frombuffer(result.stdout, dtype=np.float32)
        if len(samples) == 0:
            return []
        chunk = max(1, len(samples) // req.samples)
        peaks = [
            float(np.max(np.abs(samples[i * chunk:(i + 1) * chunk])))
            for i in range(min(req.samples, len(samples) // chunk))
        ]
        return peaks

    try:
        loop = asyncio.get_event_loop()
        peaks = await loop.run_in_executor(None, compute)
        return {"peaks": peaks}
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
