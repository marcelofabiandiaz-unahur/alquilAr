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
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

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
  verificarRol(['PROPIETARIO', 'ADMINISTRADOR']),
  manejarArchivo,
  uploadGarante,
);
router.delete(
  '/garantes/recibos',
  verificarRol(['PROPIETARIO', 'ADMINISTRADOR']),
  eliminarReciboGarante,
);
router.get('/:id/garante/recibo', verReciboGarante);
router.get('/', listarContratos);
router.post('/', crearContrato);
router.get('/:id', obtenerContrato);
router.put('/:id', actualizarContrato);
router.patch('/:id/finalizar', finalizarContrato);
router.delete('/:id', cancelarContrato);

module.exports = router;
