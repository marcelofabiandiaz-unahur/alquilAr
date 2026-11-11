const express = require('express');
const router = express.Router();
const {
  listarAgrupamientos,
  obtenerAgrupamiento,
  crearAgrupamiento,
  actualizarAgrupamiento,
  eliminarAgrupamiento,
} = require('../controllers/agrupamientoController');
const { verificarToken, verificarPermiso } = require('../middlewares/authMiddleware');

router.use(verificarToken);

router.get('/', verificarPermiso('VER_AGRUPAMIENTOS'), listarAgrupamientos);
router.post('/', verificarPermiso('GESTIONAR_AGRUPAMIENTOS'), crearAgrupamiento);
router.get('/:id', verificarPermiso('VER_AGRUPAMIENTOS'), obtenerAgrupamiento);
router.put('/:id', verificarPermiso('GESTIONAR_AGRUPAMIENTOS'), actualizarAgrupamiento);
router.delete('/:id', verificarPermiso('ELIMINAR_AGRUPAMIENTO'), eliminarAgrupamiento);

module.exports = router;
