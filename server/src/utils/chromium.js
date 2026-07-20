import fs from 'node:fs';
import path from 'node:path';

function isExecutable(filename, access = fs.accessSync) {
  if (!filename) return false;
  try {
    access(filename, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function pathCandidates(environment, platform) {
  const pathEntries = String(environment.PATH || '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (platform === 'win32') {
    const installations = [
      [environment.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'],
      [environment['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'],
      [environment.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'],
      [environment.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
      [environment['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
      [environment.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
      [environment.PROGRAMFILES, 'Chromium', 'Application', 'chrome.exe'],
      [environment.LOCALAPPDATA, 'Chromium', 'Application', 'chrome.exe'],
    ]
      .filter(([base]) => base)
      .map((segments) => path.join(...segments));
    const commands = ['chrome.exe', 'msedge.exe', 'chromium.exe'];
    return [
      ...installations,
      ...pathEntries.flatMap((entry) => commands.map((name) => path.join(entry, name))),
    ];
  }

  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      path.join(
        environment.HOME || '',
        'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      ),
    ];
  }

  const commands = [
    'chromium',
    'chromium-browser',
    'google-chrome-stable',
    'google-chrome',
    'microsoft-edge-stable',
  ];
  return [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/microsoft-edge-stable',
    '/snap/bin/chromium',
    ...pathEntries.flatMap((entry) => commands.map((name) => path.join(entry, name))),
  ];
}

/**
 * Finds a locally installed Chromium-compatible browser. A configured path is
 * preferred, but an invalid path does not prevent portable local development.
 */
export function resolveChromiumExecutablePath({
  configuredPath,
  environment = process.env,
  platform = process.platform,
  cwd = process.cwd(),
  access = fs.accessSync,
} = {}) {
  const configured = String(configuredPath || '').trim();
  const preferred =
    configured && configured.toLowerCase() !== 'auto' ? path.resolve(cwd, configured) : null;
  const candidates = [preferred, ...pathCandidates(environment, platform)].filter(Boolean);
  const seen = new Set();

  for (const candidate of candidates) {
    const key = platform === 'win32' ? candidate.toLowerCase() : candidate;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isExecutable(candidate, access)) return candidate;
  }
  return null;
}
