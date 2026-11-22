import type { CheckResult, FixNotice } from '../presets';
import type { TokenName } from '../tokens/types';

/**
 * One line per auto-fix, worded for the row it sits next to. Every kind includes the colour that was used.
 * In data mode, fixes other than holds happened on the light colours, before the map receded.
 */
export function describeFix(notice: FixNotice, dataMode = false): string {
  const text = describe(notice);
  return dataMode && notice.kind !== 'hold' ? `Before data mode: ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

function describe(notice: FixNotice): string {
  switch (notice.kind) {
    case 'slot':
      return `Auto-fix: used ${notice.to} so “${notice.check}” passes.`;
    case 'token':
      return `Auto-fix: used ${notice.to} (was ${notice.from}) so “${notice.check}” passes.`;
    case 'fallback':
      return `Auto-fix: used ${notice.to} (was ${notice.from}) so “${notice.check}” passes.`;
    case 'pick': {
      const [text, halo] = notice.to.split(' on ');
      return `Auto-fix: water labels use the ${text} colour with a ${halo} halo so “${notice.check}” passes.`;
    }
    case 'hold':
      return `Data mode: used ${notice.to} (receded: ${notice.from}) so “${notice.check}” stays readable.`;
  }
}

/** The token row a notice belongs to. Water-label picks sit with water. */
export const noticeToken = (notice: FixNotice): TokenName | undefined =>
  notice.kind === 'slot' ? undefined : notice.kind === 'pick' ? 'water' : (notice.target as TokenName);

const formatValue = (check: CheckResult) => (check.kind === 'contrast' ? `${check.value.toFixed(2)}:1` : check.value.toFixed(3));
const formatMin = (check: CheckResult) => (check.kind === 'contrast' ? `${check.min}:1` : String(check.min));

/** A check that still fails after every fix, for the row of the token it measures. */
export const describeFailure = (check: CheckResult) =>
  `Still below “${check.id}”: ${formatValue(check)}, needs ${formatMin(check)}. Pick another colour or edit it here.`;
