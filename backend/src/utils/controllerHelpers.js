const { esObjectIdValido, esErrorCast } = require('./recursosHelpers');

const validarIdParam = (req, res) => {
  if (!esObjectIdValido(req.params.id)) {
    res.status(400).json({ mensaje: 'ID inválido.' });
    return false;
  }
  return true;
};

const validarObjectIdBody = (valor, res, nombreCampo) => {
  if (valor === undefined || valor === null || valor === '') {
    res.status(400).json({ mensaje: `${nombreCampo} es requerido.` });
    return false;
  }
  const idString = String(valor);
  if (!esObjectIdValido(idString)) {
    res.status(400).json({ mensaje: `${nombreCampo} inválido.` });
    return false;
  }
  return true;
};

const responder = (res, status, data, message) =>
  res.status(status).json({ success: status < 400, data, message });

const responderError = (res, error, mensaje = 'Error interno del servidor.') => {
  console.error(mensaje, error);
  return responder(res, 500, null, mensaje);
};

const responderErrorServidor = (res, error) => {
  if (esErrorCast(error)) {
    return res.status(400).json({ mensaje: 'ID inválido.' });
  }
  console.error('Error interno del servidor:', error);
  return res.status(500).json({ mensaje: 'Error interno del servidor.' });
};

const escaparRegex = (valor) => String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  validarIdParam,
  validarObjectIdBody,
  responder,
  responderError,
  responderErrorServidor,
  escaparRegex,
};
