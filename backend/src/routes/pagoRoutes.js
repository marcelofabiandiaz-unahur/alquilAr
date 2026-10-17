const express = require('express');
const multer = require('multer');
const {
  listarPagos,
  obtenerPago,
  crearPago,
  actualizarPago,
  registrarComprobante,
  subirComprobantes,
  eliminarComprobante,
  verComprobante,
  marcarComoPagado,
  eliminarPago,
} = require('../controllers/pagoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();
const recibirComprobantes = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'files'));
      return;
    }
    callback(null, true);
  },
}).array('files', 5);

const manejarComprobantes = (req, res, next) => {
  recibirComprobantes(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const mensaje = error.code === 'LIMIT_FILE_SIZE'
        ? 'Cada comprobante puede pesar hasta 5 MB.'
        : 'Subí hasta 5 archivos PDF, JPG, PNG o WEBP.';
      return res.status(400).json({ success: false, message: mensaje });
    }
    if (error) return next(error);
    return next();
  });
};

router.use(verificarToken);
router.get('/', listarPagos);
router.get('/inquilino', listarPagos);
router.post('/', crearPago);
router.get('/:id', obtenerPago);
router.put('/:id', actualizarPago);
router.patch('/:id/comprobante', registrarComprobante);
router.post('/:id/comprobantes', verificarRol(['INQUILINO']), manejarComprobantes, subirComprobantes);
router.delete('/:id/comprobantes', verificarRol(['INQUILINO']), eliminarComprobante);
router.get('/:id/comprobantes/:indice', verComprobante);
router.patch('/:id/confirmar', marcarComoPagado);
router.delete('/:id', eliminarPago);

module.exports = router;
