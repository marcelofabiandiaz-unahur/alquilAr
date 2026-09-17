const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  // El token suele venir en los headers como "Bearer <token>"
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ success: false, message: 'Acceso denegado. No hay token provisto.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_seguro_123');
    req.usuario = payload; // Guardamos los datos del usuario en la request para usarlo después
    next(); // Pasa al siguiente controlador
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
  }
};

// 2. Verifica si el usuario tiene el rol necesario
const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    // CORRECCIÓN: Verificamos 'rol' en singular
    if (!req.usuario || !req.usuario.rol) {
      return res.status(403).json({ success: false, message: 'No se encontró el rol del usuario.' });
    }

    // Verificamos si el rol único del usuario está dentro de los permitidos para esa ruta
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ success: false, message: 'No tienes los permisos necesarios para esta acción.' });
    }
    
    next();
  };
};

module.exports = { verificarToken, verificarRol };
