import { describe, expect, it } from 'vitest';
import { detectSignalProfilePaths } from '../../../src/domain/source/discovery';

describe('profile discovery', () => {
  it('returns macOS Signal path', () => {
    const paths = detectSignalProfilePaths('macos', '/Users/demo');
    expect(paths).toContain('/Users/demo/Library/Application Support/Signal');
  });
});
