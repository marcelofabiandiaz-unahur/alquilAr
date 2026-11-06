const { AiError, CODIGOS_IA } = require('./aiErrors');

const codigoSegunStatus = (statusCode) => {
  if (statusCode === 401 || statusCode === 403) return CODIGOS_IA.SIN_PERMISO;
  if (statusCode === 404) return CODIGOS_IA.NO_ENCONTRADO;
  if (statusCode === 400 || statusCode === 409 || statusCode === 422) return CODIGOS_IA.VALIDACION;
  if (statusCode === 429) return CODIGOS_IA.LIMITE_PROVEEDOR;
  return CODIGOS_IA.INTERNO;
};

/**
 * Ejecuta un controlador existente sin pasar por HTTP y conserva el status
 * original de la respuesta. Antes de este cambio, cualquier 4xx/5xx se
 * convertía en un Error genérico y el asistente no podía distinguir un
 * problema de permisos de una falla técnica.
 */
const ejecutarControlador = async (controlador, req) => {
  let statusCode = 200;
  let responseBody;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await controlador(req, res);
  if (statusCode >= 400) {
    const mensaje = responseBody?.message
      || responseBody?.mensaje
      || responseBody?.error
      || 'No se pudo completar la operación solicitada.';
    throw new AiError(codigoSegunStatus(statusCode), mensaje, {
      status: statusCode,
      detalleTecnico: `el controlador respondió ${statusCode}`,
    });
  }
  return responseBody;
};

module.exports = { ejecutarControlador, codigoSegunStatus };
