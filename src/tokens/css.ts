import { TOKEN_NAMES, type ResolvedTokens, type TokenName } from './types';

export function cssVariableName(token: TokenName): string {
  return `--b2b-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

export function tokensToCss(tokens: ResolvedTokens, selector = ':root'): string {
  const lines = TOKEN_NAMES.map((token) => `  ${cssVariableName(token)}: ${tokens[token]};`);
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}
