const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');
const { PERMISOS } = require('../config/permisos');
const Usuario = require('../models/usuario');
const { esObjectIdValido } = require('../utils/recursosHelpers');

const responderNoAutenticado = (res, mensaje = 'Sesión inválida o expirada.') =>
  res.status(401).json({ mensaje });

const verificarToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return responderNoAutenticado(res, 'No autenticado. Token no provisto.');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return responderNoAutenticado(res, 'No autenticado. Token no provisto.');
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  } catch {
    return responderNoAutenticado(res, 'Token inválido o expirado.');
  }

  const usuarioId = payload?.id || payload?._id;
  if (!usuarioId || !esObjectIdValido(String(usuarioId))) {
    return responderNoAutenticado(res);
  }

  try {
    // La identidad y los roles se resuelven contra la base en cada request:
    // así una baja o un cambio de rol impacta sin esperar a que expire el JWT.
    const usuario = await Usuario.findById(usuarioId, 'roles estado');
    if (!usuario) {
      return responderNoAutenticado(res);
    }
    if (usuario.estado && usuario.estado !== 'ACTIVO') {
      return responderNoAutenticado(res);
    }

    req.usuario = {
      ...payload,
      id: String(usuario._id),
      _id: usuario._id,
      roles: Array.isArray(usuario.roles) ? usuario.roles : [],
    };
    return next();
  } catch (error) {
    console.error('Error al validar la sesión del usuario:', error.message);
    return res.status(503).json({
      mensaje: 'Servicio no disponible. Reintentá en unos segundos.',
    });
  }
};

const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    const roles = req.usuario?.roles;

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return res.status(403).json({ mensaje: 'No se encontraron roles del usuario.' });
    }

    const tienePermiso = roles.some((rol) => rolesPermitidos.includes(rol));
    if (!tienePermiso) {
      return res.status(403).json({ mensaje: 'No tienes los permisos necesarios para esta acción.' });
    }

    next();
  };
};

const verificarPermiso = (nombrePermiso) => {
  const rolesPermitidos = PERMISOS[nombrePermiso];
  if (!Array.isArray(rolesPermitidos) || rolesPermitidos.length === 0) {
    throw new Error(`Permiso desconocido o sin roles: ${nombrePermiso}`);
  }

  const middleware = verificarRol(rolesPermitidos);
  middleware.permiso = nombrePermiso;
  return middleware;
};

module.exports = { verificarToken, verificarRol, verificarPermiso };
