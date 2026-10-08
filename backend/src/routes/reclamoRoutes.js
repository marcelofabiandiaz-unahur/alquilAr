const express = require('express');
const {
  listarReclamos,
  obtenerReclamo,
  crearReclamo,
  actualizarReclamo,
  eliminarReclamo,
} = require('../controllers/reclamoController');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(verificarToken);
router.get('/', listarReclamos);
router.get('/inquilino', listarReclamos);
router.post('/', crearReclamo);
router.get('/:id', obtenerReclamo);
router.patch('/:id/estado', actualizarReclamo);
router.delete('/:id', eliminarReclamo);

module.exports = router;
