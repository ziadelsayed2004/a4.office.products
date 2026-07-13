import crypto from 'node:crypto';

const candidate = process.env.EXISTING_JWT || '';
const environment = String(process.env.EXISTING_NODE_ENV || '')
  .trim()
  .toLowerCase();
const normalized = candidate.toLowerCase();
const unsafeMarker = [
  'development',
  'change_me',
  'changeme',
  'placeholder',
  'example',
  'replace_me',
].some((marker) => normalized.includes(marker));

const reusable =
  environment === 'production' &&
  candidate.length >= 32 &&
  !/\s/.test(candidate) &&
  new Set(candidate).size >= 12 &&
  !unsafeMarker;

process.stdout.write(reusable ? candidate : crypto.randomBytes(32).toString('hex'));
