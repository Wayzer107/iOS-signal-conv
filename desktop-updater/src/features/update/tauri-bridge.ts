export type PreviewResult = {
  totalInput: number;
  newRows: number;
  skippedExisting: number;
};

export type UpdateResult = {
  inserted: number;
  skipped: number;
};

type InvokeFn = (command: string, args: Record<string, unknown>) => Promise<unknown>;

declare global {
  interface Window {
    __TAURI_INVOKE__?: InvokeFn;
  }
}

function fallbackInvoke(command: string): Promise<unknown> {
  return Promise.reject(new Error(`Tauri invoke bridge is unavailable for ${command}`));
}

function getInvoke(): InvokeFn {
  return (globalThis as typeof globalThis & { __TAURI_INVOKE__?: InvokeFn }).__TAURI_INVOKE__ ?? fallbackInvoke;
}

export function previewUpdate(profilePath: string, targetDbPath: string): Promise<PreviewResult> {
  return getInvoke()('preview_update', { profile_path: profilePath, target_db_path: targetDbPath }) as Promise<PreviewResult>;
}

export function runUpdate(profilePath: string, targetDbPath: string): Promise<UpdateResult> {
  return getInvoke()('run_update', { profile_path: profilePath, target_db_path: targetDbPath }) as Promise<UpdateResult>;
}
