import { API_URL } from '../config/api';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = isRecord(data) ? data.message || data.mensaje || data.error : undefined;
    throw new Error(typeof message === 'string' ? message : `Error ${res.status}`);
  }
  if (isRecord(data) && data.success === true && Object.prototype.hasOwnProperty.call(data, 'data')) {
    return data.data as T;
  }
  return data as T;
}

function authHeaders(token: string, extra: Record<string, string> = {}): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export function apiGet<T>(path: string, token: string): Promise<T> {
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .catch(() => {
      throw new Error('No se pudo conectar con el servidor. Verificá que el backend esté corriendo en el puerto 3000.');
    })
    .then((res) => parseResponse<T>(res));
}

export function apiGetBlob(path: string, token: string): Promise<Blob> {
  return fetchConRed(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (res) => {
    if (!res.ok) {
      await parseResponse<never>(res);
    }
    return res.blob();
  });
}

const fetchConRed = (url: string, options: RequestInit): Promise<Response> =>
  fetch(url, options).catch(() => {
    throw new Error('No se pudo conectar con el servidor. Verificá que el backend esté corriendo en el puerto 3000.');
  });

export function apiPost<T = unknown>(path: string, token: string, body: unknown): Promise<T> {
  return fetchConRed(`${API_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }).then((res) => parseResponse<T>(res));
}

export function apiUpload<T>(path: string, token: string, file: File): Promise<T> {
  const body = new FormData();
  body.append('file', file);
  return fetchConRed(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  }).then((res) => parseResponse<T>(res));
}

export function apiUploadMany<T>(path: string, token: string, files: File[]): Promise<T> {
  const body = new FormData();
  files.forEach((file) => body.append('files', file));
  return fetchConRed(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  }).then((res) => parseResponse<T>(res));
}

export function apiPut<T = unknown>(path: string, token: string, body: unknown): Promise<T> {
  return fetchConRed(`${API_URL}${path}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }).then((res) => parseResponse<T>(res));
}

export function apiPatch<T = unknown>(path: string, token: string, body: unknown): Promise<T> {
  return fetchConRed(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }).then((res) => parseResponse<T>(res));
}

export function apiDelete<T = unknown>(path: string, token: string, body?: unknown): Promise<T> {
  return fetchConRed(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: body === undefined
      ? { Authorization: `Bearer ${token}` }
      : authHeaders(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }).then((res) => parseResponse<T>(res));
}
