const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    mensaje: err.message || 'Error interno del servidor.',
  });
};

module.exports = errorHandler;
