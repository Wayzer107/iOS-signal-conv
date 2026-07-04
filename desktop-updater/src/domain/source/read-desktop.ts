import * as fs from 'fs';
import type { SignalDesktopRow } from '../normalize/types';
import type { ReadDesktopInput, DesktopReadError } from './types';

export async function readSignalDesktopRows(input: ReadDesktopInput): Promise<SignalDesktopRow[]> {
  const { profilePath } = input;
  if (!fs.existsSync(profilePath)) {
    // Missing profile directory
    throw 'MISSING_PROFILE' as DesktopReadError;
  }

  // Minimal implementation for Task 4: detect missing profile and otherwise return empty dataset.
  // Future work: inspect SQLite DB, handle locked DB, decryption, and layout parsing.
  return [];
}
