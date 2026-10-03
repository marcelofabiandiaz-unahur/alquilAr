const express = require('express');
const {
  listarPagos,
  obtenerPago,
  crearPago,
  actualizarPago,
  registrarComprobante,
  marcarComoPagado,
  eliminarPago,
} = require('../controllers/pagoController');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(verificarToken);
router.get('/', listarPagos);
router.post('/', crearPago);
router.get('/:id', obtenerPago);
router.put('/:id', actualizarPago);
router.patch('/:id/comprobante', registrarComprobante);
router.patch('/:id/confirmar', marcarComoPagado);
router.delete('/:id', eliminarPago);

module.exports = router;
