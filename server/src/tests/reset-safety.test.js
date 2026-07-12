import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeResetTarget, RESET_CONFIRMATION_ARGUMENT } from '../db/reset-safety.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const confirmed = [RESET_CONFIRMATION_ARGUMENT];

assert.throws(
  () => assertSafeResetTarget({
    targetPath: path.join(os.tmpdir(), 'a4-pos-reset-test.sqlite'),
    serverRoot,
    nodeEnv: 'production',
    allowReset: 'true',
    argv: confirmed
  }),
  /production/
);

assert.throws(
  () => assertSafeResetTarget({
    targetPath: path.join(os.tmpdir(), 'a4-pos-reset-test.sqlite'),
    serverRoot,
    nodeEnv: 'test',
    allowReset: 'true',
    argv: []
  }),
  /confirm-reset/
);

assert.throws(
  () => assertSafeResetTarget({
    targetPath: path.join(serverRoot, 'src', 'db', 'a4_pos.db'),
    serverRoot,
    nodeEnv: 'development',
    allowReset: 'true',
    argv: confirmed
  }),
  /default application database/
);

assert.throws(
  () => assertSafeResetTarget({
    targetPath: path.join(os.tmpdir(), 'a4-pos.live.test.sqlite'),
    serverRoot,
    nodeEnv: 'test',
    allowReset: 'true',
    argv: confirmed
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
    argv: confirmed
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
    argv: confirmed
  }),
  path.join(fs.realpathSync.native(path.dirname(developmentTarget)), path.basename(developmentTarget))
);

console.log('Database reset safety checks passed.');
