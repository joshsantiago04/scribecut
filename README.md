# ScribeCut

**Search your video library by what was said. Cut clips without the scrubbing.**

ScribeCut transcribes your videos locally using [faster-whisper](https://github.com/SYSTRAN/faster-whisper), lets you search the transcript by keyword, and exports precise clips — all offline, no account required.

Built with [Tauri](https://tauri.app) + React frontend and a Python FastAPI backend bundled into a single desktop app.

---

## Features

- **Local transcription** — powered by Whisper, runs entirely on your machine
- **GPU acceleration** — optional CUDA support for faster transcription (auto-detects your GPU)
- **Keyword search** — fuzzy search across the full transcript with timestamp results
- **Waveform clipping** — drag to select clip regions on the audio waveform with sub-second precision
- **Batch export** — queue multiple clips from multiple videos and export in one go
- **Auto-updater** — in-app update notifications when a new version is available

---

## Download

**[hajolabs.com](https://hajolabs.com)** — Windows and macOS installers available.

| Platform | Requirement |
|---|---|
| Windows | Windows 10 / 11 · x64 |
| macOS | macOS 12 Monterey+ · Apple Silicon |

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Rust](https://rustup.rs) (stable)
- Python 3.11+

### Setup

```bash
# Install frontend dependencies
npm install

# Set up the Python backend
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### Run in dev mode

```bash
npm run tauri:dev
```

This starts the Vite dev server, the Python backend, and the Tauri window together.

### Build for production

```bash
npm run tauri:build
```

---

## Architecture

```
scribecut/
├── src/                  # React frontend (Vite)
│   ├── App.jsx           # Root component, state, backend calls
│   └── components/
│       ├── Sidebar.jsx   # Video list, transcribe settings
│       ├── VideoPlayer.jsx  # Video + waveform + clip mode
│       ├── SearchPanel.jsx  # Transcript search + export queue
│       └── BottomPanel.jsx  # Transcript segment list
├── src-tauri/            # Tauri (Rust) shell
│   └── src/lib.rs        # Window setup, Python server spawn, file dialogs
└── backend/              # Python FastAPI server
    ├── server.py         # API endpoints
    ├── transcribe.py     # faster-whisper transcription + GPU detection
    ├── search.py         # Fuzzy keyword search
    └── peaks.py          # Waveform peak extraction
```

The Python backend runs as a local HTTP server on port 8000, started automatically by the Tauri shell on launch. In production builds the backend is bundled as a single executable via PyInstaller.

---

## Releasing

Releases are automated via GitHub Actions. Pushing a version tag triggers the full build and deploys to R2:

```bash
# Bump version in src-tauri/tauri.conf.json and src-tauri/Cargo.toml first
git tag v1.0.2
git push origin v1.0.2
```

The workflow builds Windows (NSIS) and macOS (DMG) installers in parallel, uploads them to Cloudflare R2, and publishes a `latest.json` for the in-app updater.

### Required GitHub secrets

| Secret | Description |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Minisign private key for update signatures |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_ACCOUNT_ID` | Cloudflare account ID |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 18 + Vite |
| Transcription | faster-whisper (Whisper model) |
| Waveform | WaveSurfer.js v7 |
| Backend API | FastAPI + uvicorn |
| Distribution | Cloudflare R2 + Pages |

---

Made by [HajoLabs](https://hajolabs.com)
