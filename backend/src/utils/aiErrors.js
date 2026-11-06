/**
 * Errores tipados del asistente de IA.
 *
 * El objetivo es no perder la causa real del fallo: cada error conserva un
 * código estable para el frontend, un status HTTP sugerido y un detalle
 * técnico que solo se escribe en los logs del backend.
 */

const CODIGOS_IA = Object.freeze({
  SIN_PERMISO: 'SIN_PERMISO',
  VALIDACION: 'VALIDACION',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  CONFIGURACION: 'CONFIGURACION',
  AUTENTICACION_PROVEEDOR: 'AUTENTICACION_PROVEEDOR',
  MODELO_INEXISTENTE: 'MODELO_INEXISTENTE',
  LIMITE_PROVEEDOR: 'LIMITE_PROVEEDOR',
  PROVEEDOR: 'PROVEEDOR',
  TIMEOUT: 'TIMEOUT',
  PASOS_EXCEDIDOS: 'PASOS_EXCEDIDOS',
  INTERNO: 'INTERNO',
});

const MENSAJES_USUARIO = Object.freeze({
  [CODIGOS_IA.SIN_PERMISO]: 'No tenés permisos para realizar esa consulta con tu rol actual.',
  [CODIGOS_IA.VALIDACION]: 'La consulta no es válida. Revisá los datos e intentá nuevamente.',
  [CODIGOS_IA.NO_ENCONTRADO]: 'No encontramos la información solicitada.',
  [CODIGOS_IA.CONFIGURACION]:
    'El asistente no está configurado correctamente. Avisá a la administración de AlquilAR.',
  [CODIGOS_IA.AUTENTICACION_PROVEEDOR]:
    'El asistente no pudo autenticarse con el proveedor de IA. Avisá a la administración de AlquilAR.',
  [CODIGOS_IA.MODELO_INEXISTENTE]:
    'El modelo de IA configurado no está disponible. Avisá a la administración de AlquilAR.',
  [CODIGOS_IA.LIMITE_PROVEEDOR]:
    'El asistente alcanzó el límite de uso por el momento. Esperá unos segundos y volvé a intentar.',
  [CODIGOS_IA.PROVEEDOR]:
    'El proveedor de IA no está disponible en este momento. Volvé a intentar en unos segundos.',
  [CODIGOS_IA.TIMEOUT]:
    'El asistente tardó demasiado en responder. Volvé a intentar en unos segundos.',
  [CODIGOS_IA.PASOS_EXCEDIDOS]:
    'No pude completar la consulta con la información disponible. Probá reformularla.',
  [CODIGOS_IA.INTERNO]:
    'No se pudo procesar la consulta del asistente. Volvé a intentar en unos segundos.',
});

const STATUS_POR_CODIGO = Object.freeze({
  [CODIGOS_IA.SIN_PERMISO]: 403,
  [CODIGOS_IA.VALIDACION]: 400,
  [CODIGOS_IA.NO_ENCONTRADO]: 404,
  [CODIGOS_IA.CONFIGURACION]: 503,
  [CODIGOS_IA.AUTENTICACION_PROVEEDOR]: 503,
  [CODIGOS_IA.MODELO_INEXISTENTE]: 503,
  [CODIGOS_IA.LIMITE_PROVEEDOR]: 503,
  [CODIGOS_IA.PROVEEDOR]: 503,
  [CODIGOS_IA.TIMEOUT]: 504,
  [CODIGOS_IA.PASOS_EXCEDIDOS]: 503,
  [CODIGOS_IA.INTERNO]: 500,
});

const REINTENTABLES = new Set([
  CODIGOS_IA.LIMITE_PROVEEDOR,
  CODIGOS_IA.PROVEEDOR,
  CODIGOS_IA.TIMEOUT,
]);

class AiError extends Error {
  constructor(codigo, mensaje, opciones = {}) {
    const codigoNormalizado = CODIGOS_IA[codigo] ? codigo : CODIGOS_IA.INTERNO;
    super(mensaje || MENSAJES_USUARIO[codigoNormalizado]);
    this.name = 'AiError';
    this.codigo = codigoNormalizado;
    this.status = opciones.status ?? STATUS_POR_CODIGO[codigoNormalizado] ?? 500;
    this.reintentable = opciones.reintentable ?? REINTENTABLES.has(codigoNormalizado);
    this.detalleTecnico = opciones.detalleTecnico || null;
    if (opciones.causa) this.cause = opciones.causa;
  }
}

const esAiError = (error) => Boolean(error) && (
  error instanceof AiError
  || error.name === 'AiError'
  || Boolean(error.codigo && CODIGOS_IA[error.codigo])
);

const mensajeUsuario = (codigo, respaldo) =>
  MENSAJES_USUARIO[CODIGOS_IA[codigo] ? codigo : CODIGOS_IA.INTERNO] || respaldo;

const leerStatus = (error) => {
  const candidatos = [
    error?.status,
    error?.statusCode,
    error?.code,
    error?.response?.status,
    error?.error?.code,
    error?.cause?.status,
  ];
  for (const candidato of candidatos) {
    const numero = Number(candidato);
    if (Number.isInteger(numero) && numero >= 100 && numero <= 599) return numero;
  }
  const texto = `${error?.message || ''} ${error?.cause?.message || ''}`;
  const coincidencia = /"code"\s*:\s*(\d{3})/.exec(texto);
  return coincidencia ? Number(coincidencia[1]) : null;
};

const textoDelError = (error) => [
  error?.message,
  error?.cause?.message,
  error?.response?.data?.error?.message,
].filter((valor) => typeof valor === 'string').join(' ');

const esErrorDeRed = (error) => {
  const texto = textoDelError(error).toLowerCase();
  const codigo = String(error?.code || error?.cause?.code || '').toUpperCase();
  return (
    codigo.startsWith('ECONN')
    || ['ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']
      .includes(codigo)
    || /fetch failed|network|socket hang up|getaddrinfo|econnreset|enotfound|connection (refused|reset|closed)/.test(texto)
  );
};

const esErrorDeTimeout = (error) => {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return true;
  if (error?.code === 'ABORT_ERR') return true;
  return /timed? ?out|deadline exceeded|timeout/i.test(textoDelError(error));
};

/**
 * Traduce un error del proveedor (SDK de Gemini, red o timeout) a un AiError
 * con código y status claros, sin filtrar la clave ni el prompt.
 */
const normalizarErrorProveedor = (error, modelo) => {
  if (esAiError(error)) return error;

  if (esErrorDeTimeout(error)) {
    return new AiError(CODIGOS_IA.TIMEOUT, MENSAJES_USUARIO[CODIGOS_IA.TIMEOUT], {
      status: 504,
      reintentable: true,
      detalleTecnico: `timeout del proveedor${modelo ? ` (${modelo})` : ''}`,
      causa: error,
    });
  }

  const status = leerStatus(error);
  const texto = textoDelError(error);
  const textoNormalizado = texto.toLowerCase();

  if (
    /api[_ ]?key[_ ]?(invalid|not valid)|api key not valid|unauthenticated|invalid api key/i.test(textoNormalizado)
    || (status === 400 && /api[_ ]?key/i.test(textoNormalizado))
  ) {
    return new AiError(CODIGOS_IA.AUTENTICACION_PROVEEDOR, MENSAJES_USUARIO[CODIGOS_IA.AUTENTICACION_PROVEEDOR], {
      status: 503,
      detalleTecnico: 'el proveedor rechazó la credencial (API key inválida o ausente)',
      causa: error,
    });
  }

  if (status === 401 || status === 403) {
    return new AiError(CODIGOS_IA.AUTENTICACION_PROVEEDOR, MENSAJES_USUARIO[CODIGOS_IA.AUTENTICACION_PROVEEDOR], {
      status: 503,
      detalleTecnico: `el proveedor respondió ${status} al autenticar`,
      causa: error,
    });
  }

  if (status === 404 || /not found|is not supported|does not exist|unknown model/i.test(textoNormalizado)) {
    return new AiError(CODIGOS_IA.MODELO_INEXISTENTE, MENSAJES_USUARIO[CODIGOS_IA.MODELO_INEXISTENTE], {
      status: 503,
      detalleTecnico: `modelo no disponible: ${modelo || 'sin modelo'}`,
      causa: error,
    });
  }

  if (status === 429 || /resource_exhausted|quota|rate limit|too many requests/i.test(textoNormalizado)) {
    return new AiError(CODIGOS_IA.LIMITE_PROVEEDOR, MENSAJES_USUARIO[CODIGOS_IA.LIMITE_PROVEEDOR], {
      status: 503,
      reintentable: true,
      detalleTecnico: 'el proveedor informó límite de cuota o rate limit',
      causa: error,
    });
  }

  if (status === 400 || status === 422) {
    return new AiError(CODIGOS_IA.CONFIGURACION, MENSAJES_USUARIO[CODIGOS_IA.CONFIGURACION], {
      status: 503,
      detalleTecnico: `el proveedor rechazó la solicitud (${status})`,
      causa: error,
    });
  }

  if (esErrorDeRed(error) || (status !== null && status >= 500)) {
    return new AiError(CODIGOS_IA.PROVEEDOR, MENSAJES_USUARIO[CODIGOS_IA.PROVEEDOR], {
      status: 503,
      reintentable: true,
      detalleTecnico: status ? `el proveedor respondió ${status}` : 'error de red con el proveedor',
      causa: error,
    });
  }

  return new AiError(CODIGOS_IA.PROVEEDOR, MENSAJES_USUARIO[CODIGOS_IA.PROVEEDOR], {
    status: 503,
    reintentable: true,
    detalleTecnico: `error no clasificado del proveedor${status ? ` (${status})` : ''}`,
    causa: error,
  });
};

module.exports = {
  CODIGOS_IA,
  MENSAJES_USUARIO,
  STATUS_POR_CODIGO,
  AiError,
  esAiError,
  mensajeUsuario,
  normalizarErrorProveedor,
  leerStatus,
};
