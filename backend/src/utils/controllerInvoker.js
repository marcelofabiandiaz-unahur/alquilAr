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
    throw new Error(
      responseBody?.message
      || responseBody?.mensaje
      || responseBody?.error
      || 'No se pudo completar la operación solicitada.',
    );
  }
  return responseBody;
};

module.exports = { ejecutarControlador };
