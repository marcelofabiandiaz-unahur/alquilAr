const express = require('express');
const {
  listarGastos,
  obtenerGasto,
  crearGasto,
  actualizarGasto,
  eliminarGasto,
} = require('../controllers/gastoController');
const { verificarToken, verificarPermiso } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(verificarToken);
router.get('/', verificarPermiso('VER_GASTOS'), listarGastos);
router.post('/', verificarPermiso('GESTIONAR_GASTOS'), crearGasto);
router.get('/:id', verificarPermiso('VER_GASTOS'), obtenerGasto);
router.put('/:id', verificarPermiso('GESTIONAR_GASTOS'), actualizarGasto);
router.delete('/:id', verificarPermiso('GESTIONAR_GASTOS'), eliminarGasto);

module.exports = router;
