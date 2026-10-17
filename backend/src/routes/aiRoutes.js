const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
// Importamos la función de verificación específica para no pasar el módulo entero
const { verificarToken } = require('../middlewares/authMiddleware'); 

// Endpoint protegido
router.post('/chat', verificarToken, aiController.chatAsistente);

module.exports = router;
