const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ mensaje: 'Acceso denegado. No hay token provisto.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'CLAVE_SECRETA_MOCK_FACULTAD');
    req.usuario = payload;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado.' });
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

module.exports = { verificarToken, verificarRol };
