import { describe, expect, it } from 'vitest';
import { sampleState, setPrimary, toPresetState } from '../src/app/brandState';
import { PRESETS, resolvePreset } from '../src/presets';
import { TOKEN_NAMES } from '../src/tokens/types';
import { describeFix, noticeToken } from '../src/ui/notices';

// Primaries that push the checks: very light, very dark, mid-tone, saturated.
const PRIMARIES = ['#f5f0e6', '#101820', '#808080', '#ffe600', '#00a0ff', '#e0623f'];

const cases = PRESETS.flatMap((preset) =>
  PRIMARIES.flatMap((primary) =>
    (['light', 'data'] as const).flatMap((mode) => [0, 60, 100].map((recede) => ({ preset, primary, mode, recede }))),
  ),
).filter((item) => item.mode === 'data' || item.recede === 0);

describe('auto-fix notices', () => {
  it('every notice in every preset and mode has a row to sit next to, and names the colour used', () => {
    const kinds = new Set<string>();
    for (const { preset, primary, mode, recede } of cases) {
      const brand = { ...setPrimary(sampleState(preset.id), primary), mode, recede };
      const resolved = resolvePreset(toPresetState(brand));
      for (const notice of resolved.notices) {
        kinds.add(notice.kind);
        if (notice.kind === 'slot') {
          expect(preset.slots.map((slot) => slot.id)).toContain(notice.target);
          expect(resolved.slots.find((slot) => slot.id === notice.target)!.used).toBe(notice.to);
        } else {
          expect(TOKEN_NAMES).toContain(noticeToken(notice));
        }
        if (notice.kind !== 'pick') expect(describeFix(notice)).toContain(notice.to);
      }
    }
    // The cases reach slot fixes, token fixes and data-mode holds.
    expect([...kinds]).toEqual(expect.arrayContaining(['slot', 'token', 'hold']));
  });

  it('data mode holds are reported, not silent', () => {
    let holds = 0;
    for (const { preset, primary, recede } of cases.filter((item) => item.mode === 'data')) {
      const brand = { ...setPrimary(sampleState(preset.id), primary), mode: 'data' as const, recede };
      const resolved = resolvePreset(toPresetState(brand));
      const held = resolved.notices.filter((notice) => notice.kind === 'hold');
      holds += held.length;
      for (const notice of held) expect(resolved.tokens[notice.target as keyof typeof resolved.tokens]).toBe(notice.to);
    }
    expect(holds).toBeGreaterThan(0);
  });
});
