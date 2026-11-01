export type PaletteErrorCode =
  | 'invalid-hex'
  | 'too-few-colors'
  | 'too-many-colors'
  | 'invalid-primary'
  | 'invalid-override'
  | 'invalid-state';

/** Every bad input surfaces as this, so the UI can show a message instead of crashing. */
export class PaletteError extends Error {
  constructor(
    readonly code: PaletteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PaletteError';
  }
}
