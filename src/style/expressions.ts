// Walks the colour outputs of a paint value, leaving its structure untouched. Unknown
// expression operators throw: a silently skipped colour would survive into the output.

type Rewrite = (css: string) => string;

function rewriteArray(value: unknown[], rewrite: Rewrite): unknown[] {
  const output = [...value];
  const outputs = (start: number, step: number) => {
    for (let i = start; i < output.length; i += step) output[i] = mapColors(output[i], rewrite);
  };
  const operator = value[0];
  switch (operator) {
    case 'interpolate':
    case 'interpolate-hcl':
    case 'interpolate-lab':
      outputs(4, 2);
      break;
    case 'step':
      outputs(2, 2);
      break;
    case 'match':
      outputs(3, 2);
      output[output.length - 1] = mapColors(output[output.length - 1], rewrite);
      break;
    case 'case':
      outputs(2, 2);
      output[output.length - 1] = mapColors(output[output.length - 1], rewrite);
      break;
    case 'coalesce':
      outputs(1, 1);
      break;
    default:
      throw new Error(`Unsupported colour expression: ${String(operator)}`);
  }
  return output;
}

export function mapColors(value: unknown, rewrite: Rewrite): unknown {
  if (typeof value === 'string') return rewrite(value);
  if (Array.isArray(value)) return rewriteArray(value, rewrite);
  if (value && typeof value === 'object' && 'stops' in value) {
    const fn = value as { stops: [unknown, unknown][] };
    return { ...fn, stops: fn.stops.map(([input, output]) => [input, mapColors(output, rewrite)]) };
  }
  throw new Error(`Unsupported colour value: ${JSON.stringify(value)}`);
}

export function collectColors(value: unknown): string[] {
  const colors: string[] = [];
  mapColors(value, (css) => {
    colors.push(css);
    return css;
  });
  return colors;
}
