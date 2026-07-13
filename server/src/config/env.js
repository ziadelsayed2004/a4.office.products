import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = path.resolve(configDirectory, '../..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

let loadedEnvironmentFile = null;

function findEnvironmentFile(environment) {
  if (environment.A4_ENV_FILE) {
    const explicitPath = path.resolve(PROJECT_ROOT, environment.A4_ENV_FILE);
    if (!fs.existsSync(explicitPath)) {
      throw new Error(`Configured environment file does not exist: ${explicitPath}`);
    }
    return explicitPath;
  }

  const candidates = [path.join(PROJECT_ROOT, '.env'), path.join(SERVER_ROOT, '.env')];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

/**
 * Loads the single project environment file without replacing variables that
 * were explicitly supplied by the process, service manager, or test runner.
 */
export function loadEnvironment(environment = process.env) {
  const environmentFile = findEnvironmentFile(environment);
  if (!environmentFile) return null;

  const result = dotenv.config({ path: environmentFile, processEnv: environment });
  if (result.error) {
    throw new Error(`Unable to load environment file ${environmentFile}: ${result.error.message}`);
  }

  if (environment === process.env) loadedEnvironmentFile = environmentFile;
  return environmentFile;
}

export function getLoadedEnvironmentFile() {
  return loadedEnvironmentFile;
}

loadEnvironment();
