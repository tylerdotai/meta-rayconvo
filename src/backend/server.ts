/**
 * RayConvo Backend — Hono + Node.js
 *
 * Audio pipeline:
 *   1. Receive audio from PWA (multipart HTTP)
 *   2. Transcribe with faster-whisper via Python subprocess
 *   3. Send transcript to OpenClaw gateway
 *   4. Receive text response
 *   5. Synthesize with edge-tts (Microsoft Edge Neural TTS — free)
 *   6. Return audio URL to PWA
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { spawn } from 'child_process';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync, statSync, unlink } from 'fs';
import path from 'path';

const app = new Hono();

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT      = parseInt(process.env.PORT || '3001');
const GATEWAY   = process.env.OPENCLAW_GATEWAY || 'http://127.0.0.1:18789';
const TOKEN     = process.env.OPENCLAW_TOKEN     || '';
const SESSION   = process.env.OPENCLAW_SESSION    || 'main';
const TTS_VOICE = process.env.TTS_VOICE           || 'en-US-BrianNeural';
const TTS_RATE  = process.env.TTS_RATE            || '+0%';
const TMP_DIR   = '/tmp/rayconvo';
const AUDIO_DIR = path.join(TMP_DIR, 'audio');

// ─── Init ────────────────────────────────────────────────────────────────────

await mkdir(AUDIO_DIR, { recursive: true });
console.log(`[RayConvo] Starting on :${PORT}`);
console.log(`[RayConvo] OpenClaw: ${GATEWAY} session=${SESSION}`);
console.log(`[RayConvo] TTS: ${TTS_VOICE}`);

// ─── STT — faster-whisper via Python subprocess ──────────────────────────────

async function transcribe(audioPath: string): Promise<{ text: string; duration: number }> {
  return new Promise((resolve, reject) => {
    const escaped = audioPath.replace(/'/g, "'\\''");
    const py = spawn('python3', ['-c', `
import sys, json
from faster_whisper import WhisperModel
model = WhisperModel('base', device='cpu', compute_type='int8')
segments, info = model.transcribe('${escaped}', beam_size=5, language='en', word_timestamps=False)
text = ' '.join(s.text.strip() + ' ' for s in segments)
print(json.dumps({'text': text.strip(), 'duration': info.duration or 0}), flush=True)
`]);

    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (c) => { stdout += c.toString(); });
    py.stderr.on('data', (c) => { stderr += c.toString(); });
    py.on('close', (code) => {
      if (code !== 0) { reject(new Error(`Whisper ${code}: ${stderr}`)); return; }
      try {
        const r = JSON.parse(stdout.trim()) as { text: string; duration: number };
        console.log(`[STT] "${r.text}" [${r.duration.toFixed(1)}s]`);
        resolve(r);
      } catch {
        reject(new Error(`Whisper parse: ${stdout} — ${stderr}`));
      }
    });
    py.on('error', reject);
  });
}

// ─── TTS — edge-tts via subprocess ─────────────────────────────────────────

async function synthesizeTTS(text: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tts = spawn('edge-tts', ['--voice', TTS_VOICE, '--rate', TTS_RATE, '--text', text, '--write-media', outputPath]);
    let stderr = '';
    tts.stderr.on('data', (c) => { stderr += c.toString(); });
    tts.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        const kb = Math.round(statSync(outputPath).size / 1024);
        console.log(`[TTS] "${text.slice(0, 50)}..." → ${path.basename(outputPath)} (${kb}KB)`);
        resolve(outputPath);
      } else {
        reject(new Error(`edge-tts ${code}: ${stderr}`));
      }
    });
    tts.on('error', reject);
  });
}

// ─── OpenClaw Gateway ────────────────────────────────────────────────────────

async function sendToOpenClaw(text: string): Promise<string> {
  if (!TOKEN) {
    return `[Mock AI] Configure OPENCLAW_TOKEN. Heard: "${text}"`;
  }
  try {
    const res = await fetch(`${GATEWAY}/api/sessions/${SESSION}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ role: 'user', content: text }),
    });
    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    const data = await res.json() as { messages?: Array<{ role: string; content: string }> };
    const reply = data.messages?.find((m) => m.role === 'assistant');
    return reply?.content || 'Message received.';
  } catch (err) {
    console.error('[OpenClaw]', err);
    return `Error: ${err}`;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'] }));
app.use('*', logger());

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/', (c) => c.json({ name: 'RayConvo', version: '0.1.0', uptime: Math.round(process.uptime()) }));
app.get('/health', (c) => c.json({ ok: true }));

// POST /api/audio
app.post('/api/audio', async (c) => {
  const ts = Date.now();
  let inputPath = '';

  try {
    const form = await c.req.parseBody();
    const audioFile = form['audio'];
    if (!audioFile || !(audioFile instanceof File)) {
      return c.json({ error: 'No audio file' }, 400);
    }

    const ext = (audioFile.name?.split('.').pop() || 'webm').replace(/[^a-z0-9]/gi, '');
    inputPath = path.join(AUDIO_DIR, `in_${ts}.${ext}`);
    await writeFile(inputPath, Buffer.from(await (audioFile as File).arrayBuffer()));

    const { text: transcript, duration } = await transcribe(inputPath);
    if (!transcript) return c.json({ error: 'Empty transcript' }, 422);

    const responseText = await sendToOpenClaw(transcript);

    const ttsPath = path.join(AUDIO_DIR, `tts_${ts}.mp3`);
    try {
      await synthesizeTTS(responseText, ttsPath);
      return c.json({ text: transcript, responseText, audioUrl: `/audio/${path.basename(ttsPath)}`, durationMs: Math.round(duration * 1000) });
    } catch (ttsErr) {
      console.error('[TTS]', ttsErr);
      return c.json({ text: transcript, responseText, audioUrl: null, ttsError: true });
    }
  } catch (err) {
    console.error('[API]', err);
    return c.json({ error: String(err) }, 500);
  } finally {
    if (inputPath) setTimeout(() => unlink(inputPath, () => {}), 3000);
  }
});

// POST /api/tts
app.post('/api/tts', async (c) => {
  try {
    const { text } = await c.req.json<{ text: string }>();
    if (!text) return c.json({ error: 'No text' }, 400);
    const ttsPath = path.join(AUDIO_DIR, `tts_${Date.now()}.mp3`);
    await synthesizeTTS(text, ttsPath);
    return c.json({ audioUrl: `/audio/${path.basename(ttsPath)}` });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// GET /audio/:file
app.get('/audio/:filename', async (c) => {
  const fp = path.join(AUDIO_DIR, path.basename(c.req.param('filename')));
  if (!existsSync(fp)) return c.json({ error: 'Not found' }, 404);
  const stat = statSync(fp);
  const data = await readFile(fp);
  return c.body(data, 200, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': String(stat.size),
    'Content-Disposition': `inline; filename="${path.basename(fp)}"`,
    'Cache-Control': 'no-store',
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[RayConvo] Ready at http://localhost:${info.port}`);
});
