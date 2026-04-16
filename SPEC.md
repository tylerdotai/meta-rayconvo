# RayConvo — Specification

> "Your AI co-founder, in your ear."

Built **2026-04-16** while Tyler was driving to a Fort Worth event. That's the story.

---

## 1. Concept & Vision

RayConvo is a real-time voice bridge between Meta Ray-Ban smart glasses and OpenClaw AI. The current Discord workflow — press glasses button, voice types in chat, read text response — works but adds friction. RayConvo eliminates the friction: press, talk, hear my voice response in your ear. No Discord. No typing. No phone in hand.

The personality is unchanged — Dexter, direct and sharp — but delivered as spoken word. The interaction should feel like a real conversation with your co-founder, not a voice assistant interrogation.

**No Flume branding. No mentions of Flume. This is its own project.**

---

## 2. Design Language

**Aesthetic:** Memphis industrial — bold geometry, confident color, technical soul

**Colors:**
- Primary: `#ff6b00` (vibrant orange)
- Background: `#0a0a0a` (near-black)
- Surface: `#111111` / `#1a1a1a`
- Text: `#f0f0f0` / `#888888`

**Typography:** Space Grotesk (UI) + JetBrains Mono (code/status)

**Motion:** Pulse glow on listen button, smooth status transitions

**Logo:** Custom Memphis SVG — orange glasses silhouette with voice waves, geometric accents

---

## 3. Architecture

```
Meta Ray-Ban glasses
    │  (Bluetooth LE)
    ▼
Meta View companion app
    │  (browser or redirect)
    ▼
Browser PWA — RayConvo (http://<clawbox>:3001)
    │  audio/webm via MediaRecorder API
    ▼
Hono backend (Node.js on clawbox :3001)
    │
    ├── faster-whisper (base, int8 CPU) → transcript
    │       │
    │       ▼
    ├── OpenClaw gateway (MiniMax M2.7) → text response
    │       │
    │       ▼
    └── edge-tts (en-US-BrianNeural) → MP3 audio
            │
            ▼
    audio/mp3 ──► PWA Audio() API ──► glasses speakers / phone speaker
```

**All processing runs on clawbox.** No paid STT/TTS APIs. No external services except the OpenClaw gateway and Microsoft Edge TTS (free, no key required).

---

## 4. Decisions Made

| Question | Decision | Rationale |
|---|---|---|
| Platform | PWA (browser) | No native app SDK access through Meta View |
| STT | faster-whisper base (CPU, int8) | Free, local, good accuracy |
| TTS | edge-tts (Microsoft Neural) | Free, no API key, excellent quality |
| TTS Voice | en-US-BrianNeural | Approachable, casual, authentic male voice |
| Backend | Hono + Node.js | Lightweight, fast, TypeScript |
| Hosting | Railway (Docker) | One-command deploy, $5-7/mo |
| CI/CD | GitHub Actions | lint → test → typecheck → health |
| Audio format | audio/webm (MediaRecorder) | Browser-native, works on mobile Chrome/Safari |
| Session | OpenClaw 'main' session | Existing session with full context |

---

## 5. Core Features

### F1: Voice Capture (PWA)
- MediaRecorder API captures mic audio in browser
- Works on mobile Chrome and Safari (PWA installed to home screen)
- Audio sent as `multipart/form-data` POST to `/api/audio`
- WebSocket not required — HTTP polling with status UI is sufficient

### F2: Transcription (STT)
- faster-whisper `base` model — int8 CPU inference
- ~3-5x realtime on clawbox 32-core CPU
- English-only optimization

### F3: AI Reasoning (LLM)
- Transcript injected as user message to OpenClaw `main` session
- Full session context: memory, skills, today's agenda
- Response returned as plain text

### F4: Voice Synthesis (TTS)
- edge-tts with `en-US-BrianNeural` voice
- Output: MP3 at 48kbps
- Streamed back to PWA via `/audio/:filename` endpoint

### F5: PWA UX
- Full-screen standalone mode (add to home screen)
- Large talk button with listening pulse animation
- Status bar: Ready / Listening / Processing / Speaking
- Conversation history (scrollable)
- Service worker for offline shell caching

---

## 6. API Reference

### `POST /api/audio`
**Input:** `multipart/form-data` with `audio` field (webm/opus)
**Output:**
```json
{
  "text": "What's the status on the Texas Compliance Academy app?",
  "responseText": "TABC approval is still pending — you submitted the $1K application. DSHS food handler approval hasn't been submitted yet.",
  "audioUrl": "/audio/tts_1713294000000.mp3",
  "durationMs": 4200
}
```

### `GET /health`
Returns `{ "ok": true }`.

### `GET /api/voices`
Returns available TTS voice options.

### `GET /audio/:filename`
Serves synthesized MP3 files.

---

## 7. Data Model

Sessions are managed by OpenClaw. The RayConvo backend is **stateless** — audio is processed ephemerally. TTS files are stored in `/tmp/rayconvo/audio/` with 24h TTL (cleanup via cron or on-read expiry).

```
audio_messages: not persisted beyond session
```

---

## 8. Build Rules (Non-Negotiable)

Every PR requires:
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No `.env` values in code — use env vars only
- [ ] All `make` targets execute correctly

---

## 9. Security

- No secrets in repo — env vars only
- `.env.example` documents all required variables (no real values)
- GitHub Actions secrets via repository secrets
- Audio data ephemeral — not logged, not persisted beyond TTS file TTL
- Rate limiting: 30 requests/minute per IP on `/api/audio`

---

## 10. Project Structure

```
meta-rayconvo/
├── src/
│   ├── backend/
│   │   └── server.ts          # Hono API server
│   └── web/
│       ├── index.html         # PWA (single HTML, no build step)
│       ├── manifest.json      # PWA manifest
│       ├── sw.js              # Service worker
│       └── logo.svg           # Memphis logo
├── scripts/
│   └── setup-piper.sh         # (Piper models — deprecated, using edge-tts)
├── .github/workflows/
│   └── ci.yml                # GitHub Actions
├── Makefile
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── SPEC.md
```

---

## 11. Status

**2026-04-16:** Built and pushed. Backend scaffolded, PWA implemented, STT (faster-whisper) and TTS (edge-tts) installed on clawbox. GitHub repo created. README written. CI/CD wired. Still needed: real end-to-end test with glasses, OpenClaw token configuration, Railway deployment.
