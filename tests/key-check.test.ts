import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function runCheck(file: string, content: string, env: Record<string, string> = {}) {
  const dist = mkdtempSync(join(tmpdir(), 'b2b-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'assets', file), content);
  return spawnSync('node', ['scripts/check-no-keys.mjs', dist], { env: { ...process.env, ...env }, encoding: 'utf8' });
}

describe('bundle key check', () => {
  const key = 'testOnlyNotARealKey123';

  it('passes a clean bundle', () => {
    expect(runCheck('index.js', 'const a = 1;', { MAPTILER_KEY: key }).status).toBe(0);
  });

  it('fails on the exact key in any file, without printing it', () => {
    const result = runCheck('style.json', `"token":"${key}"`, { MAPTILER_KEY: key });
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).not.toContain(key);
  });

  it('fails on a key-shaped URL parameter even without a local key', () => {
    const url = 'https://api.maptiler.com/maps/streets/style.json?key=abcdefghij0123456789';
    expect(runCheck('index.js', url, { MAPTILER_KEY: 'different' }).status).toBe(1);
  });
});
