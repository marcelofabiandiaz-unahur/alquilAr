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

  res.status(statusCode).json({
    mensaje: err.message || 'Error interno del servidor.',
  });
};

module.exports = errorHandler;
