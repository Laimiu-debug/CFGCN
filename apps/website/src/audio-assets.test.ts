import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../art/audio/ink-v1/manifest.json';

describe('prepared game audio', () => {
  it('keeps every runtime file matched to its provenance hash', () => {
    for (const asset of [
      ...Object.values(manifest.music),
      ...Object.values(manifest.environment),
      ...Object.values(manifest.effects),
    ]) {
      const file = readFileSync(resolve('apps/website/public', '.' + asset.url));
      expect(file.byteLength).toBe(asset.bytes);
      expect(createHash('sha256').update(file).digest('hex')).toBe(asset.sha256);
    }
  });
  it('wraps the mastered PCM on valid samples without added silence or a click-sized jump', () => {
    for (const asset of Object.values(manifest.music)) {
      const file = readFileSync(resolve('apps/website/public', '.' + asset.url));
      expect(file.toString('ascii', 0, 4)).toBe('RIFF');
      expect(file.toString('ascii', 36, 40)).toBe('data');
      const pcm = new Int16Array(
        file.buffer.slice(file.byteOffset + 44, file.byteOffset + file.byteLength),
      );
      expect(pcm.length / 2).toBe(asset.frames);
      expect(asset.loopStartFrame).toBeGreaterThan(0); // Intro only once.
      expect(asset.loopEndFrame).toBe(asset.frames);
      expect(asset.loopEndFrame - asset.loopStartFrame).toBe(asset.periodFrames);
      const deltas: number[] = [];
      for (let i = asset.loopStartFrame; i < asset.loopStartFrame + 4800; i++)
        for (let ch = 0; ch < 2; ch++)
          deltas.push(Math.abs(pcm[(i + 1) * 2 + ch] - pcm[i * 2 + ch]));
      deltas.sort((a, b) => a - b);
      for (let ch = 0; ch < 2; ch++) {
        const seam = Math.abs(
          pcm[(asset.loopEndFrame - 1) * 2 + ch] - pcm[asset.loopStartFrame * 2 + ch],
        );
        expect(seam).toBeLessThanOrEqual(deltas[Math.floor(deltas.length * 0.99)] + 2);
      }
      const head = pcm.slice(asset.loopStartFrame * 2, (asset.loopStartFrame + 480) * 2);
      expect(head.some((sample) => Math.abs(sample) > 32)).toBe(true);
    }
  });
});
