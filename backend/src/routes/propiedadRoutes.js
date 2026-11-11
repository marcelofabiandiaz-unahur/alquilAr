const express = require('express');
const router = express.Router();
const {
  listarPropiedades,
  listarPropiedadesDisponibles,
  obtenerPropiedad,
  crearPropiedad,
  actualizarPropiedad,
  bajaLogicaPropiedad,
  listarContratosPorPropiedad,
} = require('../controllers/propiedadController');
const { verificarToken, verificarPermiso } = require('../middlewares/authMiddleware');

router.use(verificarToken);

router.get(
  '/disponibles',
  verificarPermiso('VER_PROPIEDADES_DISPONIBLES'),
  listarPropiedadesDisponibles,
);
router.get('/', verificarPermiso('LISTAR_PROPIEDADES'), listarPropiedades);
router.post('/', verificarPermiso('GESTIONAR_PROPIEDADES'), crearPropiedad);
router.get('/:id/contratos', listarContratosPorPropiedad);
router.get('/:id', obtenerPropiedad);
router.put('/:id', verificarPermiso('GESTIONAR_PROPIEDADES'), actualizarPropiedad);
router.delete('/:id', verificarPermiso('GESTIONAR_PROPIEDADES'), bajaLogicaPropiedad);

module.exports = router;
