const express = require('express');
const {
  listarGastos,
  obtenerGasto,
  crearGasto,
  actualizarGasto,
  eliminarGasto,
} = require('../controllers/gastoController');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(verificarToken);
router.get('/', listarGastos);
router.post('/', crearGasto);
router.get('/:id', obtenerGasto);
router.put('/:id', actualizarGasto);
router.delete('/:id', eliminarGasto);

module.exports = router;
