import assert from 'node:assert/strict';

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  clear() {
    this.#values.clear();
  }
}

const storage = new MemoryStorage();
const events = new EventTarget();
globalThis.localStorage = storage;
globalThis.addEventListener = events.addEventListener.bind(events);
globalThis.removeEventListener = events.removeEventListener.bind(events);
globalThis.dispatchEvent = events.dispatchEvent.bind(events);

const { api, AUTH_SESSION_CLEARED_EVENT, shouldClearSessionForStorageEvent } =
  await import('../src/services/apiClient.js');
const ACCESS_KEY = 'a4_access_token';
const REFRESH_KEY = 'a4_refresh_token';

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function seedSession(access = 'expired-access', refresh = 'valid-refresh') {
  storage.clear();
  storage.setItem(ACCESS_KEY, access);
  storage.setItem(REFRESH_KEY, refresh);
}

seedSession();
let refreshCount = 0;
let protectedCount = 0;
let releaseRefresh;
const refreshGate = new Promise((resolve) => {
  releaseRefresh = resolve;
});
globalThis.fetch = async (url, options = {}) => {
  if (String(url).endsWith('/api/auth/refresh')) {
    refreshCount += 1;
    await refreshGate;
    return json(200, { data: { accessToken: 'fresh-access' } });
  }
  protectedCount += 1;
  const authorization = new Headers(options.headers).get('Authorization');
  return authorization === 'Bearer fresh-access'
    ? json(200, { data: String(url) })
    : json(401, { error: 'expired', code: 'UNAUTHORIZED' });
};

const firstRequest = api.get('/api/first');
const secondRequest = api.get('/api/second');
while (refreshCount === 0) await Promise.resolve();
releaseRefresh();
const [firstResult, secondResult] = await Promise.all([firstRequest, secondRequest]);
assert.match(firstResult.data, /\/api\/first$/);
assert.match(secondResult.data, /\/api\/second$/);
assert.equal(refreshCount, 1, 'concurrent 401 responses share one refresh request');
assert.equal(protectedCount, 4, 'each protected request is retried exactly once');
assert.equal(storage.getItem(ACCESS_KEY), 'fresh-access');

seedSession();
refreshCount = 0;
protectedCount = 0;
let clearedEvents = 0;
const countClear = () => {
  clearedEvents += 1;
};
globalThis.addEventListener(AUTH_SESSION_CLEARED_EVENT, countClear);
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/api/auth/refresh')) {
    refreshCount += 1;
    return json(200, { data: { accessToken: 'still-rejected' } });
  }
  protectedCount += 1;
  return json(401, { error: 'disabled', code: 'UNAUTHORIZED' });
};
await assert.rejects(api.get('/api/protected'), (error) => error.status === 401);
assert.equal(refreshCount, 1);
assert.equal(protectedCount, 2, 'a rejected retry is not retried again');
assert.equal(storage.getItem(ACCESS_KEY), null);
assert.equal(storage.getItem(REFRESH_KEY), null);
assert.equal(clearedEvents, 1);

seedSession();
refreshCount = 0;
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/api/auth/refresh')) {
    refreshCount += 1;
    return json(401, { error: 'invalid refresh', code: 'REFRESH_FAILED' });
  }
  return json(401, { error: 'expired', code: 'UNAUTHORIZED' });
};
await assert.rejects(api.get('/api/protected'), (error) => error.code === 'REFRESH_FAILED');
assert.equal(refreshCount, 1);
assert.equal(storage.getItem(ACCESS_KEY), null);
assert.equal(storage.getItem(REFRESH_KEY), null);

seedSession();
refreshCount = 0;
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/api/auth/refresh')) refreshCount += 1;
  return json(401, { error: 'wrong credentials', code: 'AUTH_FAILED' });
};
await assert.rejects(
  api.post('/api/auth/login', { username: 'bad', password: 'bad' }),
  (error) => error.code === 'AUTH_FAILED'
);
assert.equal(refreshCount, 0, 'public auth failures never start a refresh loop');
assert.equal(storage.getItem(ACCESS_KEY), 'expired-access');

storage.clear();
clearedEvents = 0;
globalThis.fetch = async () => json(401, { error: 'expired', code: 'UNAUTHORIZED' });
await assert.rejects(api.get('/api/protected-with-empty-storage'), (error) => {
  return error.code === 'NO_REFRESH_TOKEN';
});
assert.equal(
  clearedEvents,
  1,
  'session-clear notification fires even when storage is already empty'
);

seedSession();
storage.removeItem(ACCESS_KEY);
assert.equal(
  shouldClearSessionForStorageEvent({ key: ACCESS_KEY, newValue: null }),
  false,
  'removing one token in another window waits for the complete session removal'
);
storage.removeItem(REFRESH_KEY);
assert.equal(
  shouldClearSessionForStorageEvent({ key: REFRESH_KEY, newValue: null }),
  true,
  'the final cross-window token removal clears in-memory authentication'
);
assert.equal(
  shouldClearSessionForStorageEvent({ key: ACCESS_KEY, newValue: 'rotated-access' }),
  false,
  'cross-window token rotation does not log the user out'
);

globalThis.removeEventListener(AUTH_SESSION_CLEARED_EVENT, countClear);
console.log('API client refresh tests passed.');
