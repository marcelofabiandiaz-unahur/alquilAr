const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  listarContratos,
  obtenerContrato,
  crearContrato,
  actualizarContrato,
  finalizarContrato,
  cancelarContrato,
} = require('../controllers/contratoController');
const {
  uploadGarante,
  eliminarReciboGarante,
  verReciboGarante,
} = require('../controllers/garanteAssetController');
const { verificarToken, verificarPermiso } = require('../middlewares/authMiddleware');

const recibirArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
      return;
    }
    callback(null, true);
  },
}).single('file');

const manejarArchivo = (req, res, next) => {
  recibirArchivo(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const mensaje = error.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el máximo de 5 MB.'
        : 'Subí un único archivo PDF, JPG, PNG o WEBP.';
      return res.status(400).json({ success: false, mensaje });
    }
    if (error) return next(error);
    return next();
  });
};

router.use(verificarToken);

router.post(
  '/garantes/recibos',
  verificarPermiso('GESTIONAR_CONTRATOS'),
  manejarArchivo,
  uploadGarante,
);
router.delete(
  '/garantes/recibos',
  verificarPermiso('GESTIONAR_CONTRATOS'),
  eliminarReciboGarante,
);
router.get('/:id/garante/recibo', verReciboGarante);
router.get('/', verificarPermiso('VER_CONTRATOS'), listarContratos);
router.post('/', verificarPermiso('GESTIONAR_CONTRATOS'), crearContrato);
router.get('/:id', obtenerContrato);
router.put('/:id', verificarPermiso('GESTIONAR_CONTRATOS'), actualizarContrato);
router.patch('/:id/finalizar', verificarPermiso('GESTIONAR_CONTRATOS'), finalizarContrato);
router.delete('/:id', verificarPermiso('GESTIONAR_CONTRATOS'), cancelarContrato);

module.exports = router;
