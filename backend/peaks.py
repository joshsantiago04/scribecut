import subprocess
import tempfile
import os

import numpy as np
import librosa
from scipy.signal import find_peaks
from scipy.ndimage import uniform_filter1d


def _extract_audio(video_path: str) -> str:
    """Pull audio from video into a temp mono WAV at 22050 Hz."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", video_path,
                "-ac", "1",        # mono
                "-ar", "22050",    # standard librosa sample rate
                "-vn",             # drop video stream
                tmp.name,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        # Make ffmpeg failures debuggable
        stderr = (e.stderr or "").strip()
        raise RuntimeError(f"ffmpeg failed extracting audio:\n{stderr}") from e

    return tmp.name


def detect_clips(
    video_path: str,
    pre_pad: float = 20.0,
    post_pad: float = 10.0,
    min_prominence_db: float = 8.0,
    min_gap_s: float = 30.0,
) -> list[dict]:
    """
    Analyze the audio track of a video for loud peaks and return clip segments.

    Returns
    -------
    List of dicts: [{ start, end, peak_time, peak_db }, ...]
    """
    wav_path = None
    try:
        wav_path = _extract_audio(video_path)
        y, sr = librosa.load(wav_path, sr=None, mono=True)
        duration = float(len(y)) / sr

        # ── RMS energy per frame ────────────────────────────────────────────
        frame_length = int(sr * 0.10)   # 100 ms window
        hop_length   = int(sr * 0.05)   # 50 ms hop  → 20 frames/s
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]

        # Convert amplitude → dB  (0 dB = loudest frame in the file)
        rms_db = librosa.amplitude_to_db(rms, ref=np.max)

        # Smooth over ~1 second to remove jitter
        hop_dur_s = hop_length / sr
        smooth_window = max(1, int(1.0 / hop_dur_s))
        rms_smooth = uniform_filter1d(rms_db, size=smooth_window)

        # Time stamp for every frame
        times = librosa.frames_to_time(
            np.arange(len(rms_smooth)), sr=sr, hop_length=hop_length
        )

        # ── Peak detection ──────────────────────────────────────────────────
        min_distance_frames = max(1, int(min_gap_s / hop_dur_s))
        peak_indices, _ = find_peaks(
            rms_smooth,
            prominence=min_prominence_db,
            distance=min_distance_frames,
        )

        if len(peak_indices) == 0:
            return []

        # ── Build clip boundaries ───────────────────────────────────────────
        boundary_drop_db = min_prominence_db * 0.5

        clips = []
        for idx in peak_indices:
            peak_time = float(times[idx])
            peak_db   = float(rms_smooth[idx])
            threshold = peak_db - boundary_drop_db

            # Walk LEFT
            boundary_start = peak_time
            for i in range(idx, -1, -1):
                if rms_smooth[i] <= threshold:
                    boundary_start = float(times[i])
                    break

            # Walk RIGHT
            boundary_end = peak_time
            for i in range(idx, len(rms_smooth)):
                if rms_smooth[i] <= threshold:
                    boundary_end = float(times[i])
                    break

            # Expand + clamp
            t_start = max(0.0,      boundary_start - pre_pad)
            t_end   = min(duration, boundary_end   + post_pad)

            clips.append({
                "start":     round(t_start,   2),
                "end":       round(t_end,     2),
                "peak_time": round(peak_time, 2),
                "peak_db":   round(peak_db,   1),
            })

        return clips

    finally:
        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)