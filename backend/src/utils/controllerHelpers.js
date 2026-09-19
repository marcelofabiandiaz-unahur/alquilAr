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

const responderErrorServidor = (res, error) => {
  if (esErrorCast(error)) {
    return res.status(400).json({ mensaje: 'ID inválido.' });
  }
  return res.status(500).json({ mensaje: error.message });
};

module.exports = {
  validarIdParam,
  validarObjectIdBody,
  responderErrorServidor,
};
