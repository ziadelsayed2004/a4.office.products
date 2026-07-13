import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeResetTarget, RESET_CONFIRMATION_ARGUMENT } from '../db/reset-safety.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const confirmed = [RESET_CONFIRMATION_ARGUMENT];

assert.throws(
  () =>
    assertSafeResetTarget({
      targetPath: path.join(os.tmpdir(), 'a4-pos-reset-test.sqlite'),
      serverRoot,
      nodeEnv: 'test',
      allowReset: 'false',
      argv: confirmed,
    }),
  /ALLOW_DATABASE_RESET=true/
);

assert.throws(
  () =>
    assertSafeResetTarget({
      targetPath: path.join(os.tmpdir(), 'a4-pos-reset-test.sqlite'),
      serverRoot,
      nodeEnv: 'production',
      allowReset: 'true',
      argv: confirmed,
    }),
  /production/
);

for (const invalidEnvironment of ['staging', 'preview', 'development-preview']) {
  assert.throws(
    () =>
      assertSafeResetTarget({
        targetPath: path.join(os.tmpdir(), 'a4-pos-reset-test.sqlite'),
        serverRoot,
        nodeEnv: invalidEnvironment,
        allowReset: 'true',
        argv: confirmed,
      }),
    /outside NODE_ENV=development or NODE_ENV=test/
  );
}

assert.throws(
  () =>
    assertSafeResetTarget({
      targetPath: path.join(os.tmpdir(), 'a4-pos-reset-test.sqlite'),
      serverRoot,
      nodeEnv: 'test',
      allowReset: 'true',
      argv: [],
    }),
  /confirm-reset/
);

assert.throws(
  () =>
    assertSafeResetTarget({
      targetPath: path.join(serverRoot, 'src', 'db', 'a4_pos.db'),
      serverRoot,
      nodeEnv: 'development',
      allowReset: 'true',
      argv: confirmed,
    }),
  /default application database/
);

const configuredProductionPath = path.join(serverRoot, 'src', 'db', 'production-target.db');
assert.throws(
  () =>
    assertSafeResetTarget({
      targetPath: configuredProductionPath,
      productionPath: configuredProductionPath,
      serverRoot,
      nodeEnv: 'development',
      allowReset: 'true',
      argv: confirmed,
    }),
  /configured production database/
);

assert.throws(
  () =>
    assertSafeResetTarget({
      targetPath: path.join(serverRoot, 'src', 'db', 'unmarked.sqlite'),
      serverRoot,
      nodeEnv: 'development',
      allowReset: 'true',
      argv: confirmed,
    }),
  /dev\/local\/test marker/
);

assert.throws(
  () =>
    assertSafeResetTarget({
      targetPath: path.join(os.tmpdir(), 'a4-pos.live.test.sqlite'),
      serverRoot,
      nodeEnv: 'test',
      allowReset: 'true',
      argv: confirmed,
    }),
  /production\/live/
);

const temporaryTarget = path.join(os.tmpdir(), 'a4-pos-reset-test.sqlite');
assert.equal(
  assertSafeResetTarget({
    targetPath: temporaryTarget,
    serverRoot,
    nodeEnv: 'test',
    allowReset: 'true',
    argv: confirmed,
  }),
  path.join(fs.realpathSync.native(os.tmpdir()), path.basename(temporaryTarget))
);

const developmentTarget = path.join(serverRoot, 'src', 'db', 'a4_pos.local.db');
assert.equal(
  assertSafeResetTarget({
    targetPath: developmentTarget,
    serverRoot,
    nodeEnv: 'development',
    allowReset: 'true',
    argv: confirmed,
  }),
  path.join(
    fs.realpathSync.native(path.dirname(developmentTarget)),
    path.basename(developmentTarget)
  )
);

const symlinkTestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'a4-pos-reset-symlink-'));
try {
  const realTargetDirectory = path.join(symlinkTestRoot, 'real-target');
  const linkedTarget = path.join(symlinkTestRoot, 'linked-target.local.db');
  fs.mkdirSync(realTargetDirectory);
  fs.symlinkSync(
    realTargetDirectory,
    linkedTarget,
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  assert.throws(
    () =>
      assertSafeResetTarget({
        targetPath: linkedTarget,
        serverRoot,
        nodeEnv: 'test',
        allowReset: 'true',
        argv: confirmed,
      }),
    /symbolic-link/
  );
} finally {
  fs.rmSync(symlinkTestRoot, { recursive: true, force: true });
}

console.log('Database reset safety checks passed.');
