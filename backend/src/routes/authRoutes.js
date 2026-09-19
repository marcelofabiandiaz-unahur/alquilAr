const express = require('express');
const router = express.Router();
const { registrarUsuario, loginUsuario, listarUsuarios } = require('../controllers/authController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.post('/', registrarUsuario);
router.post('/login', loginUsuario);
router.get('/', verificarToken, verificarRol(['ADMINISTRADOR']), listarUsuarios);

module.exports = router;
