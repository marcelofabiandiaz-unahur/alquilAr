const express = require('express');
const router = express.Router();
const {
  listarPropiedades,
  obtenerPropiedad,
  crearPropiedad,
  actualizarPropiedad,
  bajaLogicaPropiedad,
  listarContratosPorPropiedad,
} = require('../controllers/propiedadController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.use(verificarToken);

router.get('/', listarPropiedades);
router.post('/', crearPropiedad);
router.get('/:id/contratos', listarContratosPorPropiedad);
router.get('/:id', obtenerPropiedad);
router.put('/:id', actualizarPropiedad);
router.delete('/:id', bajaLogicaPropiedad);

module.exports = router;
