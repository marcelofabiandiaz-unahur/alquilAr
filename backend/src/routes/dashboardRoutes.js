const express = require('express');
const { verificarToken } = require('../middlewares/authMiddleware');
const { obtenerResumen } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/resumen', verificarToken, obtenerResumen);

module.exports = router;
