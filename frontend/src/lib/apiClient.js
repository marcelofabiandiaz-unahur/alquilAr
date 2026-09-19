import { API_URL } from '../config/api';

async function parseResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.mensaje || `Error ${res.status}`);
  }
  return data;
}

function authHeaders(token, extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export function apiGet(path, token) {
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .catch(() => {
      throw new Error('No se pudo conectar con el servidor. Verificá que el backend esté corriendo en el puerto 3000.');
    })
    .then(parseResponse);
}

const fetchConRed = (url, options) =>
  fetch(url, options).catch(() => {
    throw new Error('No se pudo conectar con el servidor. Verificá que el backend esté corriendo en el puerto 3000.');
  });

export function apiPost(path, token, body) {
  return fetchConRed(`${API_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }).then(parseResponse);
}

export function apiPut(path, token, body) {
  return fetchConRed(`${API_URL}${path}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }).then(parseResponse);
}

export function apiPatch(path, token, body) {
  return fetchConRed(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }).then(parseResponse);
}

export function apiDelete(path, token) {
  return fetchConRed(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse);
}
