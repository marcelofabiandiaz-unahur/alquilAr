const express = require('express');
const router = express.Router();
const { registrarUsuario, loginUsuario, listarUsuarios, agregarRolesUsuario } = require('../controllers/authController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.post('/', registrarUsuario);
router.post('/login', loginUsuario);
router.get('/', verificarToken, verificarRol(['ADMINISTRADOR']), listarUsuarios);
router.patch('/:id/roles', verificarToken, verificarRol(['ADMINISTRADOR']), agregarRolesUsuario);

module.exports = router;
