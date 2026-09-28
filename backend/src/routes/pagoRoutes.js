const express = require('express');
const router = express.Router();
const {
  crearPago,
  obtenerPagosPorInquilino,
  registrarComprobante,
  marcarComoPagado,
} = require('../controllers/pago.controller');


//Crear pago / cuota
router.post('/', crearPago);

//Obtener historial del inquilino
router.get('/inquilino', obtenerPagosPorInquilino);

//Cargar comprobante de pago
router.patch('/:id/comprobante', registrarComprobante);

//Marcar pago como completado (Propietario/Admin)
router.patch('/:id/confirmar', marcarComoPagado);

module.exports = router;