Actions taken:
- Removed stale npm lockfile at desktop-updater/package-lock.json because this project uses pnpm and the npm lockfile was out of sync with package.json.

Attempted validation commands and output (deterministic minimal checks; npm unavailable):
- Checked presence of file: ls -la desktop-updater/package-lock.json
desktop-updater/package-lock.json: not found
Committed removal: e1df2d1
FILE_ABSENT
