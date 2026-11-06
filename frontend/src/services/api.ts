const API_BASE = '/api';

function getStoredToken(): string | null {
  return localStorage.getItem('accord_token');
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem('accord_token', token);
  } else {
    localStorage.removeItem('accord_token');
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getStoredToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Header protection for CSRF sensitive endpoints
  if (path.includes('/auth/refresh') || path.includes('/auth/logout')) {
    headers.set('x-accord-csrf', '1');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/signup')) {
    setStoredToken(null);
    window.dispatchEvent(new Event('accord:auth_expired'));
  }

  if (!res.ok) {
    let errorMsg = 'An unexpected error occurred';
    try {
      const errData = await res.json();
      errorMsg = errData.detail || errorMsg;
    } catch {
      errorMsg = `HTTP Error ${res.status}`;
    }
    throw new Error(errorMsg);
  }

  return res.json();
}
