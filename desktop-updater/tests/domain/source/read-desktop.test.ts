import { describe, expect, it } from 'vitest';
import { readSignalDesktopRows } from '../../../src/domain/source/read-desktop';

describe('read desktop source', () => {
  it('errors when profile path missing', async () => {
    await expect(readSignalDesktopRows({ profilePath: '/non/existent/path' })).rejects.toMatchObject({ type: 'MISSING_PROFILE' });
  });
});
