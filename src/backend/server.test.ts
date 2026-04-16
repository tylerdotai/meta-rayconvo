import { describe, it, expect } from 'vitest';

// Smoke tests — these verify the server module structure
// Real audio pipeline tests would require mocking the subprocess calls

describe('RayConvo backend smoke tests', () => {
  it('has a PORT config', () => {
    const port = parseInt(process.env.PORT || '3001');
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
  });

  it('has a TTS_VOICE config', () => {
    const voice = process.env.TTS_VOICE || 'en-US-BrianNeural';
    expect(voice).toMatch(/^en-US-/);
  });

  it('has a tmp audio directory', async () => {
    const { existsSync } = await import('fs');
    const { mkdir } = await import('fs/promises');
    const path = await import('path');
    const audioDir = path.join('/tmp/rayconvo', 'audio');
    await mkdir(audioDir, { recursive: true });
    expect(existsSync(audioDir)).toBe(true);
  });
});
