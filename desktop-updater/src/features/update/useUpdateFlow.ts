import { useMemo, useState } from 'react';
import { previewUpdate, runUpdate, type PreviewResult, type UpdateResult } from './tauri-bridge';

export type UpdatePhase = 'idle' | 'previewing' | 'previewed' | 'running' | 'completed' | 'error';

export type UpdateUiState = {
  profilePath: string;
  targetDbPath: string;
  preview: PreviewResult | null;
  result: UpdateResult | null;
  phase: UpdatePhase;
  error: string | null;
};

const initialState: UpdateUiState = {
  profilePath: '',
  targetDbPath: '',
  preview: null,
  result: null,
  phase: 'idle',
  error: null,
};

export function useUpdateFlow() {
  const [state, setState] = useState<UpdateUiState>(initialState);

  const canRun = useMemo(
    () => state.profilePath.trim().length > 0 && state.targetDbPath.trim().length > 0,
    [state.profilePath, state.targetDbPath]
  );

  async function preview(): Promise<void> {
    if (!canRun) {
      setState((current) => ({ ...current, phase: 'error', error: 'Select a profile path and target database first.' }));
      return;
    }

    setState((current) => ({ ...current, phase: 'previewing', error: null }));
    try {
      const preview = await previewUpdate(state.profilePath, state.targetDbPath);
      setState((current) => ({ ...current, preview, result: null, phase: 'previewed', error: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Preview failed',
      }));
    }
  }

  async function run(): Promise<void> {
    if (!canRun) {
      setState((current) => ({ ...current, phase: 'error', error: 'Select a profile path and target database first.' }));
      return;
    }

    setState((current) => ({ ...current, phase: 'running', error: null }));
    try {
      const result = await runUpdate(state.profilePath, state.targetDbPath);
      setState((current) => ({ ...current, result, phase: 'completed', error: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Update failed',
      }));
    }
  }

  function setProfilePath(profilePath: string): void {
    setState((current) => ({ ...current, profilePath }));
  }

  function setTargetDbPath(targetDbPath: string): void {
    setState((current) => ({ ...current, targetDbPath }));
  }

  return { state, canRun, setProfilePath, setTargetDbPath, preview, run };
}
