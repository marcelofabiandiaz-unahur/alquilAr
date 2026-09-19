const express = require('express');
const router = express.Router();
const {
  listarContratos,
  obtenerContrato,
  crearContrato,
  actualizarContrato,
  finalizarContrato,
  cancelarContrato,
} = require('../controllers/contratoController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.use(verificarToken);

router.get('/', listarContratos);
router.post('/', crearContrato);
router.get('/:id', obtenerContrato);
router.put('/:id', actualizarContrato);
router.patch('/:id/finalizar', finalizarContrato);
router.delete('/:id', cancelarContrato);

module.exports = router;
