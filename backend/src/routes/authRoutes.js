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
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.post('/', registrarUsuario);
router.post('/login', loginUsuario);
router.get('/me', verificarToken, obtenerMiPerfil);
router.patch('/me', verificarToken, actualizarMiPerfil);
router.get('/solicitud-propietario', verificarToken, obtenerSolicitudPropietario);
router.post('/solicitud-propietario', verificarToken, solicitarRolPropietario);
router.get('/', verificarToken, verificarRol(['ADMINISTRADOR']), listarUsuarios);
router.patch('/:id/solicitud-propietario/aprobar', verificarToken, verificarRol(['ADMINISTRADOR']), aprobarSolicitudPropietario);
router.patch('/:id/roles', verificarToken, verificarRol(['ADMINISTRADOR']), agregarRolesUsuario);

module.exports = router;
