'use client';
// Client-side API helper. JWT is stored in an httpOnly cookie set by the server,
// so we don't need to attach Authorization headers — cookies are sent automatically.

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(msg: string, status: number, data?: any) {
    super(msg);
    this.status = status;
    this.data = data;
  }
}

async function request<T = any>(method: string, path: string, body?: any, signal?: AbortSignal): Promise<T> {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', cache: 'no-store', signal };
  if (body !== undefined && body !== null) opts.body = JSON.stringify(body);
  let res: Response;
  for (let attempt = 0; ; attempt += 1) {
    res = await fetch(`/api${path}`, opts);
    // A short retry smooths over transient database/pooler failures for safe
    // reads without ever repeating a mutation such as POST, PATCH, or DELETE.
    if (method === 'GET' && attempt === 0 && (res.status === 500 || res.status === 503)) {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      continue;
    }
    break;
  }
  if (res.status === 401) {
    // Redirect to login page
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.assign(new URL('/', window.location.origin).toString());
    }
    throw new ApiError('Session expired. Please sign in again.', 401);
  }
  const ct = res.headers.get('content-type') || '';
  let data: any = null;
  if (ct.includes('application/json')) data = await res.json();
  else if (ct.includes('text/csv') || ct.includes('text/')) data = await res.text();
  else { try { data = await res.json(); } catch {} }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string, signal?: AbortSignal) => request<T>('GET', p, undefined, signal),
  post: <T = any>(p: string, b?: any) => request<T>('POST', p, b),
  patch: <T = any>(p: string, b?: any) => request<T>('PATCH', p, b),
  delete: <T = any>(p: string, b?: any) => request<T>('DELETE', p, b),
  download: async (path: string, filename: string) => {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) throw new ApiError('Download failed', res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
