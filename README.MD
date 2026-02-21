# Video Editor — Technical Requirements

## Problem Statement

Existing video editors require manual scrubbing to find content. Users reviewing long-form footage need fast, keyword-based navigation to jump to relevant moments without manual timeline scrubbing.

## Target User

- Content creators editing interviews or podcasts
- Journalists reviewing footage for relevant quotes
- Researchers analyzing user research recordings
- Documentarians organizing raw footage

## Tech Stack

### Backend
- **FastAPI** — Python web framework for transcription & search APIs
- **faster-whisper** — local speech-to-text transcription
- **ffmpeg** — audio extraction and video processing
- **librosa** — audio feature analysis
- **scipy** — signal processing
- **numpy** — numerical operations
- **rapidfuzz** — fuzzy text search

### Frontend
- **React** — component-based UI
- **Vite** — build tool and dev server
- **wavesurfer.js** (optional) — waveform visualization

### Desktop
- **Electron** — native desktop app shell

## MVP0 Requirements

### Core Features
- Upload and load local video files
- Video playback with standard controls (play, pause, seek)
- Automatic audio transcription (speech-to-text)
- Keyword search across transcript
- Display search results (potentially adding clickable timestamps)

### UI Layout
- Left sidebar: video upload button + video file list
- Center: video player
- Right panel: search input + results display
- Bottom panel: timestamp results list with format `[HH:MM:SS] Transcript line`

## MVP1 (Stretch Goals)

- Clip export with timestamp range
- Waveform visualization
- Bulk video upload
