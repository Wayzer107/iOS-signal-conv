export type DesktopReadError =
  | 'MISSING_PROFILE'
  | 'LOCKED_DB'
  | 'DECRYPTION_FAILED'
  | 'UNSUPPORTED_LAYOUT';

export type ReadDesktopInput = { profilePath: string };

export class DesktopReadException extends Error {
  readonly type: DesktopReadError;
  constructor(type: DesktopReadError, message?: string) {
    super(message ?? type);
    this.type = type;
    this.name = 'DesktopReadException';
  }
}
