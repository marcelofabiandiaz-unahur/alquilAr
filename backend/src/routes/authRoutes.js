const express = require('express');
const router = express.Router();
const {
  registrarUsuario,
  loginUsuario,
  obtenerMiPerfil,
  actualizarMiPerfil,
  listarUsuarios,
  agregarRolesUsuario,
  obtenerSolicitudPropietario,
  solicitarRolPropietario,
  aprobarSolicitudPropietario,
} = require('../controllers/authController');
const { verificarToken, verificarPermiso } = require('../middlewares/authMiddleware');
const { limiteLogin, limiteRegistro } = require('../middlewares/rateLimiters');

router.post('/', limiteRegistro, registrarUsuario);
router.post('/login', limiteLogin, loginUsuario);
router.get('/me', verificarToken, verificarPermiso('VER_PERFIL'), obtenerMiPerfil);
router.patch('/me', verificarToken, verificarPermiso('VER_PERFIL'), actualizarMiPerfil);
router.get(
  '/solicitud-propietario',
  verificarToken,
  verificarPermiso('VER_PERFIL'),
  obtenerSolicitudPropietario,
);
router.post(
  '/solicitud-propietario',
  verificarToken,
  verificarPermiso('VER_PERFIL'),
  solicitarRolPropietario,
);
router.get('/', verificarToken, verificarPermiso('VER_USUARIOS'), listarUsuarios);
router.patch(
  '/:id/solicitud-propietario/aprobar',
  verificarToken,
  verificarPermiso('APROBAR_PROPIETARIO'),
  aprobarSolicitudPropietario,
);
router.patch(
  '/:id/roles',
  verificarToken,
  verificarPermiso('GESTIONAR_ROLES'),
  agregarRolesUsuario,
);

module.exports = router;
