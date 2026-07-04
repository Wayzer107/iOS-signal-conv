export type DesktopReadError =
  | 'MISSING_PROFILE'
  | 'LOCKED_DB'
  | 'DECRYPTION_FAILED'
  | 'UNSUPPORTED_LAYOUT';

export type ReadDesktopInput = { profilePath: string };
