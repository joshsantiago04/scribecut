import subprocess
import tempfile
import os
from faster_whisper import WhisperModel

# Lazy-loaded so the server starts immediately; model loads on first transcription
_model = None

def _get_model():
    global _model
    if _model is None:
        _model = WhisperModel("small", device="cpu", compute_type="int8")
    return _model


def extract_audio(video_path: str) -> str:
    """Use ffmpeg to pull audio from video into a temp .wav file.
    Returns the path to the temp file — caller is responsible for deleting it."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", video_path,
            "-ac", "1",       # mono
            "-ar", "16000",   # 16kHz sample rate (what whisper expects)
            "-vn",            # no video
            tmp.name,
        ],
        check=True,
        capture_output=True,
    )

    return tmp.name


def transcribe(video_path: str) -> list[dict]:
    """Extract audio from video and transcribe it.
    Returns a list of segments: [{ start, end, text }, ...]"""
    wav_path = None
    try:
        wav_path = extract_audio(video_path)
        segments, _ = _get_model().transcribe(
            wav_path,
            beam_size=5,
            condition_on_previous_text=False,
            vad_filter=True,
        )
        return [
            {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
            for seg in segments
        ]
    finally:
        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)
