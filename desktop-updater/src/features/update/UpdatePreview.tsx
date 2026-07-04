import type { UpdateUiState } from './useUpdateFlow';

type UpdatePreviewProps = {
  state: UpdateUiState;
};

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function UpdatePreview({ state }: UpdatePreviewProps) {
  return (
    <section aria-label="update preview">
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.preview ? (
        <p>
          {state.preview.newRows} {pluralize(state.preview.newRows, 'new row')} ready to append.
        </p>
      ) : (
        <p>No preview loaded.</p>
      )}
      {state.phase === 'completed' && state.result ? <p>Update completed: {state.result.inserted} inserted.</p> : null}
    </section>
  );
}
