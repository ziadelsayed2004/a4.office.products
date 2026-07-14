import { APP_CONFIG } from '../config/appConfig.js';

const API_BASE = import.meta.env?.VITE_API_BASE_URL || '';
const AUTH_PATHS_WITHOUT_REFRESH = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
]);

export const AUTH_SESSION_CLEARED_EVENT = 'a4:auth-session-cleared';

let refreshPromise = null;

function readStorage(key) {
  try {
    return globalThis.localStorage?.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // The current request can still use the refreshed token in memory.
  }
}

function clearStoredSession() {
  const accessKey = APP_CONFIG.storageKeys.accessToken;
  const refreshKey = APP_CONFIG.storageKeys.refreshToken;
  try {
    globalThis.localStorage?.removeItem(accessKey);
    globalThis.localStorage?.removeItem(refreshKey);
  } catch {
    // AuthContext still receives the event and clears its in-memory state.
  }

  if (typeof globalThis.dispatchEvent === 'function') {
    globalThis.dispatchEvent(new Event(AUTH_SESSION_CLEARED_EVENT));
  }
}

export function shouldClearSessionForStorageEvent(event) {
  const accessKey = APP_CONFIG.storageKeys.accessToken;
  const refreshKey = APP_CONFIG.storageKeys.refreshToken;
  const relevantKey = event?.key === null || event?.key === accessKey || event?.key === refreshKey;
  if (!relevantKey || (event?.key !== null && event?.newValue !== null)) return false;
  return !readStorage(accessKey) && !readStorage(refreshKey);
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  const text = await response.text();
  return text || null;
}

function requestHeaders(options, token = readStorage(APP_CONFIG.storageKeys.accessToken)) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  else headers.delete('Authorization');
  return headers;
}

async function fetchFromApi(path, options, token) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: requestHeaders(options, token),
  });
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refreshToken = readStorage(APP_CONFIG.storageKeys.refreshToken);
  if (!refreshToken) {
    const error = new Error('انتهت جلسة العمل. سجل الدخول مرة أخرى.');
    error.status = 401;
    error.code = 'NO_REFRESH_TOKEN';
    throw error;
  }

  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const payload = await parseResponse(response);
    const accessToken = payload?.data?.accessToken || payload?.accessToken;

    if (!response.ok || !accessToken) {
      const error = new Error(payload?.error || payload?.message || 'تعذر تجديد جلسة العمل.');
      error.status = response.status;
      error.code = payload?.code || 'REFRESH_FAILED';
      throw error;
    }

    writeStorage(APP_CONFIG.storageKeys.accessToken, accessToken);
    const nextRefreshToken = payload?.data?.refreshToken || payload?.refreshToken;
    if (nextRefreshToken) {
      writeStorage(APP_CONFIG.storageKeys.refreshToken, nextRefreshToken);
    }
    return accessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function authorizedFetch(path, options) {
  let response = await fetchFromApi(path, options);
  const canRefresh = response.status === 401 && !AUTH_PATHS_WITHOUT_REFRESH.has(path.split('?')[0]);
  if (!canRefresh) return response;

  try {
    const accessToken = await refreshAccessToken();
    response = await fetchFromApi(path, options, accessToken);
  } catch (error) {
    clearStoredSession();
    throw error;
  }

  if (response.status === 401) clearStoredSession();
  return response;
}

export async function openAuthorizedStream(path, options = {}) {
  let response;
  try {
    response = await authorizedFetch(path, { method: 'GET', ...options });
  } catch (error) {
    if (error?.status) throw error;
    throw new Error('تعذر فتح قناة التحديث المباشر.');
  }
  if (!response.ok) {
    const payload = await parseResponse(response);
    const error = new Error(payload?.error || payload?.message || 'تعذر فتح قناة التحديث المباشر.');
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }
  return response;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await authorizedFetch(path, options);
  } catch (error) {
    if (error?.status) throw error;
    throw new Error('تعذر الاتصال بالخادم. تأكد من تشغيل الباك إند ثم حاول مرة أخرى.');
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || 'حدث خطأ غير متوقع.');
    error.status = response.status;
    error.code = payload?.code;
    error.details = payload?.details;
    throw error;
  }
  return payload;
}

export const api = {
  get: (path, options) => request(path, { method: 'GET', ...options }),
  post: (path, body, options) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),
  patch: (path, body, options) =>
    request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    }),
  delete: (path, options) => request(path, { method: 'DELETE', ...options }),
  download: async (path, filename) => {
    let response;
    try {
      response = await authorizedFetch(path, { method: 'GET' });
    } catch (error) {
      if (error?.status) throw error;
      throw new Error('تعذر الاتصال بالخادم لتصدير الملف.');
    }
    if (!response.ok) {
      const payload = await parseResponse(response);
      const error = new Error(payload?.error || payload?.message || 'تعذر تصدير الملف.');
      error.status = response.status;
      error.code = payload?.code;
      throw error;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
