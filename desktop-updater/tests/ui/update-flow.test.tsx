// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';

const invoke = vi.fn(async (command: string) => {
  if (command === 'preview_update') {
    return { totalInput: 2, newRows: 1, skippedExisting: 1 };
  }
  if (command === 'run_update') {
    return { inserted: 1, skipped: 1 };
  }
  throw new Error(`Unexpected command: ${command}`);
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('update flow', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    invoke.mockClear();
    (globalThis as typeof globalThis & { __TAURI_INVOKE__?: typeof invoke }).__TAURI_INVOKE__ = invoke;
  });

  it('shows preview and then success after update', async () => {
    const container = document.getElementById('root');
    if (!container) {
      throw new Error('Missing root container');
    }

    await act(async () => {
      createRoot(container).render(<App />);
    });

    await typeInput('Profile path', '/Users/test/Library/Application Support/Signal');
    await typeInput('Target database path', '/Users/test/archive.sqlite');

    await clickButton('Preview');
    expect(screenText()).toContain('1 new row');

    await clickButton('Run update');
    expect(screenText()).toContain('Update completed');
  });
});

function screenText(): string {
  return document.body.textContent ?? '';
}

async function clickButton(name: string): Promise<void> {
  const button = Array.from(document.querySelectorAll('button')).find((el) => el.textContent === name);
  if (!button) {
    throw new Error(`Missing button: ${name}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function typeInput(name: string, value: string): Promise<void> {
  const input = Array.from(document.querySelectorAll('input')).find((el) => el.getAttribute('aria-label') === name);
  if (!input) {
    throw new Error(`Missing input: ${name}`);
  }

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
