import fs from 'fs';
import path from 'path';

const envPath = findEnvPath(__dirname);

if (envPath) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] ??= value;
  }
}

function findEnvPath(startDir: string): string | null {
  let currentDir = startDir;

  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.join(currentDir, '.env');
    if (fs.existsSync(candidate)) return candidate;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return null;
}
