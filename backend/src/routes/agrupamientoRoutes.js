const express = require('express');
const router = express.Router();
const {
  listarAgrupamientos,
  obtenerAgrupamiento,
  crearAgrupamiento,
  actualizarAgrupamiento,
  eliminarAgrupamiento,
} = require('../controllers/agrupamientoController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.use(verificarToken);

router.get('/', listarAgrupamientos);
router.post('/', crearAgrupamiento);
router.get('/:id', obtenerAgrupamiento);
router.put('/:id', actualizarAgrupamiento);
router.delete('/:id', eliminarAgrupamiento);

module.exports = router;
