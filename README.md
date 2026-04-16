# RayConvo

> Your AI co-founder, in your ear.

A real-time voice bridge between Meta Ray-Ban smart glasses and OpenClaw AI. Press the glasses button, talk to your AI, hear the response — no phone in hand, no Discord, no typing.

Built **2026-04-16** while driving to a Fort Worth event. That's the story.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Voice AI | OpenClaw (MiniMax M2.7) | Tyler's existing AI infrastructure |
| STT | faster-whisper | Local, free, CPU-optimized int8 |
| TTS | edge-tts | Free, no API key, Microsoft Neural voices |
| Backend | Hono + Node.js | Lightweight, fast, TypeScript-first |
| Hosting | Railway | One `docker compose up` deploy |
| CI/CD | GitHub Actions | Lint → test → typecheck → deploy |

---

## Quick Start

### 1. Clone & install

```bash
git clone git@github.com:tylerdotai/meta-rayconvo.git
cd meta-rayconvo
npm ci
```

### 2. Configure

```bash
cp .env.example .env
# Fill in OPENCLAW_GATEWAY and OPENCLAW_TOKEN
```

Find your OpenClaw token in `~/.openclaw/openclaw.json` under `channels.discord.token`.

### 3. Run

```bash
make dev        # Development with hot reload (tsx)
make docker-up  # Production via Docker
```

Backend runs at `http://localhost:3010` (configurable via `PORT`).

### 4. Open the PWA

On your phone, open `http://<your-clawbox-ip>:3001` and add it to your home screen for a full-screen experience.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       RayConvo                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Meta Ray-Ban glasses ──(Bluetooth)── Meta View app           │
│                                              │               │
│                                              ▼               │
│                                    Browser (PWA on phone)    │
│                                              │               │
│                                              │ audio/webm    │
│                                              ▼               │
│  Hono backend (clawbox :3001)                               │
│    │  faster-whisper (STT, local CPU)                        │
│    │  OpenClaw gateway (AI reasoning)                        │
│    │  edge-tts (TTS, Microsoft Neural)                       │
│    │                                                         │
│    └── audio/mp3 ─────────────────────────────────────────►  │
│                              glasses speakers / phone speaker │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## API

### `POST /api/audio`
Main voice pipeline. Accepts a `multipart/form-data` audio file.

```bash
curl -X POST http://localhost:3001/api/audio \
  -F "audio=@recording.webm"

# Response
{
  "text": "What's on my calendar today?",
  "responseText": "You've got the investor sync at 3pm and a design review at 5.",
  "audioUrl": "/audio/tts_1234567890.mp3",
  "durationMs": 3200
}
```

### `GET /health`
Returns `{ "ok": true }`.

### `GET /api/voices`
Returns available TTS voice options.

---

## TTS Voices

| Voice | Gender | Style |
|---|---|---|
| `en-US-BrianNeural` | Male | Approachable, casual |
| `en-US-AvaNeural` | Female | Expressive, friendly |
| `en-US-EmmaNeural` | Female | Cheerful, clear |
| `en-US-AndrewNeural` | Male | Warm, confident |

Set via `TTS_VOICE` env var.

---

## Docker

```bash
cp .env.example .env
# edit .env with your values
make docker-build docker-up
```

Or on Railway: connect the repo, set env vars, deploy.

---

## CI/CD

Every PR and push runs:

1. **TypeScript check** — `tsc --noEmit`
2. **ESLint** — `eslint src --ext .ts`
3. **Tests** — `vitest run`
4. **Health check** (post-deploy only)

---

## Sources

- [Meta Wearables Device Access Toolkit](https://developers.meta.com/wearables/)
- [faster-whisper](https://github.com/SYTOME-Technologies/faster-whisper)
- [edge-tts](https://github.com/rany2/edge-tts)
- [Hono](https://hono.dev/)
