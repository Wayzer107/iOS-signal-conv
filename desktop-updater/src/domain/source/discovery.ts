export function detectSignalProfilePaths(
  platform: 'linux' | 'macos' | 'windows',
  homeDir: string
): string[] {
  if (platform === 'macos') return [`${homeDir}/Library/Application Support/Signal`];
  if (platform === 'windows') return [`${homeDir}/AppData/Roaming/Signal`];
  return [`${homeDir}/.config/Signal`, `${homeDir}/.var/app/org.signal.Signal/config/Signal`];
}
