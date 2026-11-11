const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusError = Number.isInteger(err.statusCode) ? err.statusCode : err.status;
  const statusCode = Number.isInteger(statusError) && statusError >= 400 && statusError <= 599
    ? statusError
    : 500;
  if (statusCode >= 500) {
    console.error(err);
  }

  // Los errores internos no exponen detalles de Mongoose o del stack.
  res.status(statusCode).json({
    mensaje: statusCode >= 500
      ? 'Error interno del servidor.'
      : (err.message || 'Error al procesar la solicitud.'),
  });
};

module.exports = errorHandler;
