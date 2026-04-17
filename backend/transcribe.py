import subprocess
import tempfile
import os
import sys
import glob
import site
from faster_whisper import WhisperModel


def _get_ffmpeg_exe():
    if getattr(sys, 'frozen', False):
        binaries_dir = os.path.join(sys._MEIPASS, 'imageio_ffmpeg', 'binaries')
        if os.path.isdir(binaries_dir):
            for fname in os.listdir(binaries_dir):
                if 'ffmpeg' in fname.lower():
                    return os.path.join(binaries_dir, fname)
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()

# Add pip-installed NVIDIA CUDA libs to LD_LIBRARY_PATH so ctranslate2 can
# find libcublas.so.12 etc. at runtime (they are loaded lazily via dlopen).
def _setup_cuda_libs():
    paths = []
    for sp in site.getsitepackages():
        paths += glob.glob(os.path.join(sp, "nvidia", "*", "lib"))
    if paths:
        existing = os.environ.get("LD_LIBRARY_PATH", "")
        os.environ["LD_LIBRARY_PATH"] = ":".join(filter(None, paths + [existing]))

_setup_cuda_libs()

# Lazy-loaded so the server starts immediately; model loads on first transcription
_model = None
_model_cfg = None  # (model_name, device)

def _get_model(model_name: str = "small", device: str = "cpu"):
    global _model, _model_cfg
    cfg = (model_name, device)
    if _model is None or _model_cfg != cfg:
        compute_type = "float16" if device == "cuda" else "int8"
        _model = WhisperModel(model_name, device=device, compute_type=compute_type)
        _model_cfg = cfg
    return _model


def check_cuda() -> bool:
    try:
        import subprocess
        result = subprocess.run(
            ["nvidia-smi"],
            capture_output=True,
            timeout=5,
        )
        if result.returncode != 0:
            return False
        # Also verify ctranslate2 has CUDA support compiled in
        import ctranslate2
        types = ctranslate2.get_supported_compute_types("cuda")
        return bool(types)
    except Exception:
        return False


def extract_audio(video_path: str) -> str:
    """Use ffmpeg to pull audio from video into a temp .wav file.
    Returns the path to the temp file — caller is responsible for deleting it."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    ffmpeg = _get_ffmpeg_exe()
    subprocess.run(
        [
            ffmpeg, "-y",
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


def transcribe_stream(video_path: str, model_name: str = "small", device: str = "cpu"):
    """Yields {'type': 'info', 'duration': float} first, then
    {'type': 'segment', 'start', 'end', 'text'} for each segment.
    Caller is responsible for running this in a thread."""
    wav_path = extract_audio(video_path)
    try:
        segments, info = _get_model(model_name, device).transcribe(
            wav_path,
            beam_size=5,
            condition_on_previous_text=False,
            vad_filter=True,
        )
        yield {"type": "info", "duration": info.duration}
        for seg in segments:
            yield {"type": "segment", "start": seg.start, "end": seg.end, "text": seg.text.strip()}
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)
