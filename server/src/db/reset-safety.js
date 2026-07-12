import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const RESET_CONFIRMATION_ARGUMENT = '--confirm-reset';

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isSamePath(left, right) {
  return path.relative(left, right) === '';
}

function canonicalPath(candidate) {
  const absolute = path.resolve(candidate);
  let existingAncestor = absolute;
  const missingSegments = [];

  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) throw new Error(`Cannot resolve reset target: ${absolute}`);
    missingSegments.unshift(path.basename(existingAncestor));
    existingAncestor = parent;
  }

  return path.join(fs.realpathSync.native(existingAncestor), ...missingSegments);
}

function hasDevelopmentMarker(candidate) {
  const filename = path.basename(candidate).toLowerCase();
  return /(^|[._-])(dev|development|local|test|testing|sandbox|scratch)([._-]|$)/.test(filename);
}

function hasLiveMarker(candidate) {
  return String(candidate).toLowerCase().split(/[\\/]+/).some(
    (segment) => /(^|[._-])(prod|production|live)([._-]|$)/.test(segment)
  );
}

export function assertSafeResetTarget({
  targetPath,
  serverRoot,
  nodeEnv = process.env.NODE_ENV || 'development',
  allowReset = process.env.ALLOW_DATABASE_RESET,
  argv = process.argv.slice(2),
  productionPath = process.env.PRODUCTION_SQLITE_DB_PATH
}) {
  if (String(nodeEnv).toLowerCase() === 'production') {
    throw new Error('Database reset is disabled when NODE_ENV=production.');
  }
  if (allowReset !== 'true') {
    throw new Error('Database reset requires ALLOW_DATABASE_RESET=true.');
  }
  if (!argv.includes(RESET_CONFIRMATION_ARGUMENT)) {
    throw new Error(`Database reset requires the ${RESET_CONFIRMATION_ARGUMENT} argument.`);
  }
  if (!targetPath) throw new Error('Database reset requires an explicit SQLite target path.');

  const absoluteTarget = path.resolve(targetPath);
  if (fs.existsSync(absoluteTarget) && fs.lstatSync(absoluteTarget).isSymbolicLink()) {
    throw new Error('Database reset refuses symbolic-link targets.');
  }

  const target = canonicalPath(absoluteTarget);
  const canonicalServerRoot = fs.realpathSync.native(path.resolve(serverRoot));
  const canonicalTempRoot = fs.realpathSync.native(os.tmpdir());
  const defaultLivePath = path.join(canonicalServerRoot, 'src', 'db', 'a4_pos.db');

  if (isSamePath(target, defaultLivePath)) {
    throw new Error(`Refusing to reset the default application database: ${target}`);
  }
  if (productionPath && isSamePath(target, canonicalPath(path.resolve(canonicalServerRoot, productionPath)))) {
    throw new Error(`Refusing to reset the configured production database: ${target}`);
  }
  if (hasLiveMarker(target)) {
    throw new Error(`Refusing to reset a database path marked as production/live: ${target}`);
  }

  const isTemporary = isWithin(canonicalTempRoot, target);
  const isMarkedDevelopmentDatabase = isWithin(canonicalServerRoot, target) && hasDevelopmentMarker(target);
  if (!isTemporary && !isMarkedDevelopmentDatabase) {
    throw new Error(
      'Reset targets must be inside the operating-system temp directory or use a dev/local/test marker in the filename.'
    );
  }

  return target;
}
