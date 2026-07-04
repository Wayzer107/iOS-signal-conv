import type { UpdateUiState } from './useUpdateFlow';

type UpdateFormProps = {
  state: UpdateUiState;
  canRun: boolean;
  onProfilePathChange: (value: string) => void;
  onTargetDbPathChange: (value: string) => void;
  onPreview: () => Promise<void>;
  onRun: () => Promise<void>;
};

export function UpdateForm({
  state,
  canRun,
  onProfilePathChange,
  onTargetDbPathChange,
  onPreview,
  onRun,
}: UpdateFormProps) {
  return (
    <section aria-label="update controls">
      <label>
        Profile path
        <input
          aria-label="Profile path"
          value={state.profilePath}
          onChange={(event) => onProfilePathChange(event.currentTarget.value)}
        />
      </label>
      <label>
        Target database path
        <input
          aria-label="Target database path"
          value={state.targetDbPath}
          onChange={(event) => onTargetDbPathChange(event.currentTarget.value)}
        />
      </label>
      <button onClick={() => void onPreview()} disabled={!canRun || state.phase === 'previewing' || state.phase === 'running'}>
        Preview
      </button>
      <button onClick={() => void onRun()} disabled={!canRun || state.phase === 'previewing' || state.phase === 'running'}>
        Run update
      </button>
    </section>
  );
}
