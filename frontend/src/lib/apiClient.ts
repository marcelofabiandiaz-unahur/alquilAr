import { API_URL } from '../config/api';

export const SESION_NO_AUTORIZADA_EVENTO = 'alquilar:sesion-no-autorizada';

export type TipoErrorApi = 'red' | 'timeout' | 'http' | 'respuesta';

export class ApiError extends Error {
  readonly status: number | null;
  readonly tipo: TipoErrorApi;

  constructor(
    message: string,
    opciones: { status?: number | null; tipo?: TipoErrorApi } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opciones.status ?? null;
    this.tipo = opciones.tipo ?? 'http';
  }
}

export interface OpcionesRed {
  timeoutMs?: number;
  reintentos?: number;
  onReintento?: (intento: number, totalReintentos: number) => void;
}

const TIEMPO_LIMITE_MS = 45_000;
const REINTENTOS_RED = 1;
const ESPERA_REINTENTO_MS = 1_500;

const MENSAJE_RED = 'No pudimos conectar con el servidor. Revisá tu conexión y volvé a intentar. '
  + 'Si la app estaba inactiva en Render, el servidor puede tardar hasta un minuto en iniciar.';

const MENSAJE_TIMEOUT = 'El servidor tardó demasiado en responder. '
  + 'Si estaba inactivo en Render, puede estar iniciando; esperá unos segundos y volvé a intentar.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mensajeParaEstado(status: number, mensajeBackend?: string): string {
  if (status === 502 || status === 503 || status === 504) {
    return 'El servidor no está disponible en este momento. '
      + 'Puede estar iniciando en Render; esperá unos segundos y volvé a intentar.';
  }
  if (status >= 500) {
    return 'El servidor tuvo un error interno. Reintentá en unos segundos.';
  }
  if (mensajeBackend) return mensajeBackend;
  if (status === 401) return 'Tu sesión venció o las credenciales no son válidas.';
  if (status === 403) return 'No tenés permisos para realizar esta acción.';
  if (status === 404) return 'No encontramos el recurso solicitado.';
  if (status === 408) return 'El servidor tardó demasiado en responder.';
  return `Error ${status}`;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const texto = await res.text().catch(() => '');
  let data: unknown = {};

  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const mensajeBackend = isRecord(data)
      ? data.message || data.mensaje || data.error
      : undefined;
    throw new ApiError(
      mensajeParaEstado(res.status, typeof mensajeBackend === 'string' ? mensajeBackend : undefined),
      { status: res.status, tipo: 'http' },
    );
  }

  if (data === undefined) {
    throw new ApiError(
      'El servidor devolvió una respuesta que no pudimos interpretar. Reintentá en unos segundos.',
      { status: res.status, tipo: 'respuesta' },
    );
  }

  if (isRecord(data) && data.success === true && Object.prototype.hasOwnProperty.call(data, 'data')) {
    return data.data as T;
  }
  return data as T;
}

const esperar = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

const esErrorPorTimeout = (error: unknown): boolean => {
  if (error instanceof DOMException) return error.name === 'AbortError';
  return error instanceof Error && error.name === 'AbortError';
};

const fetchConRed = async (
  url: string,
  options: RequestInit,
  config: OpcionesRed = {},
): Promise<Response> => {
  const timeoutMs = config.timeoutMs ?? TIEMPO_LIMITE_MS;
  const reintentos = config.reintentos ?? REINTENTOS_RED;
  let ultimoError: ApiError | null = null;

  for (let intento = 0; intento <= reintentos; intento += 1) {
    if (intento > 0) {
      config.onReintento?.(intento, reintentos);
      await esperar(ESPERA_REINTENTO_MS);
    }

    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const tieneAutorizacion = new Headers(options.headers).has('Authorization');

      if (tieneAutorizacion && (response.status === 401 || response.status === 403)) {
        window.dispatchEvent(new Event(SESION_NO_AUTORIZADA_EVENTO));
      }
      return response;
    } catch (error) {
      const esTimeout = esErrorPorTimeout(error);
      ultimoError = new ApiError(
        esTimeout ? MENSAJE_TIMEOUT : MENSAJE_RED,
        { tipo: esTimeout ? 'timeout' : 'red' },
      );
    } finally {
      clearTimeout(temporizador);
    }
  }

  throw ultimoError ?? new ApiError(MENSAJE_RED, { tipo: 'red' });
};

function authHeaders(token: string, extra: Record<string, string> = {}): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export function apiRequest<T>(
  path: string,
  options: RequestInit,
  config: OpcionesRed = {},
): Promise<T> {
  return fetchConRed(`${API_URL}${path}`, options, config).then((res) => parseResponse<T>(res));
}

export function apiGet<T>(path: string, token: string, config: OpcionesRed = {}): Promise<T> {
  return apiRequest<T>(path, {
    headers: { Authorization: `Bearer ${token}` },
  }, config);
}

export function apiGetBlob(path: string, token: string, config: OpcionesRed = {}): Promise<Blob> {
  return fetchConRed(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }, config).then(async (res) => {
    if (!res.ok) {
      await parseResponse<never>(res);
    }
    return res.blob();
  });
}

export function apiPostPublico<T = unknown>(
  path: string,
  body: unknown,
  config: OpcionesRed = {},
): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, config);
}

export function apiPost<T = unknown>(
  path: string,
  token: string,
  body: unknown,
  config: OpcionesRed = {},
): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }, config);
}

export function apiUpload<T>(
  path: string,
  token: string,
  file: File,
  config: OpcionesRed = {},
): Promise<T> {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  }, config);
}

export function apiUploadMany<T>(
  path: string,
  token: string,
  files: File[],
  config: OpcionesRed = {},
): Promise<T> {
  const body = new FormData();
  files.forEach((file) => body.append('files', file));
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  }, config);
}

export function apiPut<T = unknown>(
  path: string,
  token: string,
  body: unknown,
  config: OpcionesRed = {},
): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }, config);
}

export function apiPatch<T = unknown>(
  path: string,
  token: string,
  body: unknown,
  config: OpcionesRed = {},
): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }, config);
}

export function apiDelete<T = unknown>(
  path: string,
  token: string,
  body?: unknown,
  config: OpcionesRed = {},
): Promise<T> {
  return apiRequest<T>(path, {
    method: 'DELETE',
    headers: body === undefined
      ? { Authorization: `Bearer ${token}` }
      : authHeaders(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, config);
}
