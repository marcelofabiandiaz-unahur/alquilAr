const express = require('express');
const router = express.Router();
const {
  crearReclamo,
  obtenerReclamosPorInquilino,
  actualizarEstadoReclamo,
} = require('../controllers/reclamo.controller');

//Crear reclamo
router.post('/', crearReclamo);

//Consultar reclamos propios
router.get('/inquilino', obtenerReclamosPorInquilino);

//Actualizar estado / prioridad
router.patch('/:id/estado', actualizarEstadoReclamo);

module.exports = router;