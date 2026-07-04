import { describe, expect, it } from 'vitest';
import { runAppSmoke } from '../../src/App';

describe('app smoke', () => {
  it('returns ready marker', async () => {
    await expect(runAppSmoke()).resolves.toBe('ready');
  });
});
