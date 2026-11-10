const express = require('express');
const {
  listarReclamos,
  obtenerReclamo,
  crearReclamo,
  actualizarReclamo,
  eliminarReclamo,
} = require('../controllers/reclamoController');
const { verificarToken, verificarPermiso } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(verificarToken);
router.get('/', verificarPermiso('VER_RECLAMOS'), listarReclamos);
router.post('/', verificarPermiso('CREAR_RECLAMO'), crearReclamo);
router.get('/:id', verificarPermiso('VER_RECLAMOS'), obtenerReclamo);
router.patch('/:id/estado', verificarPermiso('GESTIONAR_RECLAMOS'), actualizarReclamo);
router.delete('/:id', verificarPermiso('GESTIONAR_RECLAMOS'), eliminarReclamo);

module.exports = router;
