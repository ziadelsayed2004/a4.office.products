const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function parseResponse(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  return response.text();
}

async function request(path, options = {}) {
  const token = localStorage.getItem('a4_access_token');
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('تعذر الاتصال بالخادم. تأكد من تشغيل الباك إند ثم حاول مرة أخرى.');
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || 'حدث خطأ غير متوقع.');
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }
  return payload;
}

export const api = {
  get: (path, options) => request(path, { method: 'GET', ...options }),
  post: (path, body, options) => request(path, { method: 'POST', body: JSON.stringify(body), ...options }),
  patch: (path, body, options) => request(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  download: async (path, filename) => {
    const token = localStorage.getItem('a4_access_token');
    const response = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error('تعذر تصدير الملف.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};
