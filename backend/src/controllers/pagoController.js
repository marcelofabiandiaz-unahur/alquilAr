const Pago = require('../models/pago');
const { sendResponse, validarObjectIdBody } = require('../utils/controllerHelpers');

//Crear un nuevo pago
const crearPago = async (req, res) => {
  try {
    const { contrato, inquilino, monto, fechaVencimiento } = req.body;

    if (!contrato || !inquilino || !monto || !fechaVencimiento) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Todos los campos obligatorios deben ser proporcionados.',
      });
    }

    const nuevoPago = new Pago({
      contrato,
      inquilino,
      monto,
      fechaVencimiento,
    });

    await nuevoPago.save();

    return sendResponse(res, 201, {
      success: true,
      message: 'Pago creado exitosamente.',
      data: nuevoPago,
    });
  } catch (error) {
    return sendResponse(res, 500, {
      success: false,
      message: 'Error al crear el pago.',
      error: error.message,
    });
  }
};

//Obtener los pagos del inquilino autenticado
const obtenerPagosPorInquilino = async (req, res) => {
  try {
    const inquilinoId = req.usuario._id;

    const pagos = await Pago.find({ inquilino: inquilinoId }).populate('contrato');

    return sendResponse(res, 200, {
      success: true,
      message: 'Pagos del inquilino recuperados exitosamente.',
      data: pagos,
    });
  } catch (error) {
    return sendResponse(res, 500, {
      success: false,
      message: 'Error al obtener pagos.',
      error: error.message,
    });
  }
};

//Registrar comprobante de pago
const registrarComprobante = async (req, res) => {
  try {
    const { id } = req.params;
    const { comprobanteUrl } = req.body;

    if (!comprobanteUrl) {
      return sendResponse(res, 400, {
        success: false,
        message: 'La URL del comprobante es requerida.',
      });
    }

    const pago = await Pago.findById(id);
    if (!pago) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Pago no encontrado.',
      });
    }

    pago.comprobanteUrl = comprobanteUrl;
    await pago.save();

    return sendResponse(res, 200, {
      success: true,
      message: 'Comprobante registrado correctamente.',
      data: pago,
    });
  } catch (error) {
    return sendResponse(res, 500, {
      success: false,
      message: 'Error al registrar el comprobante.',
      error: error.message,
    });
  }
};

//Marcar un pago como pagado
const marcarComoPagado = async (req, res) => {
  try {
    const { id } = req.params;

    const pago = await Pago.findById(id);
    if (!pago) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Pago no encontrado.',
      });
    }

    pago.estado = 'PAGADO';
    pago.fechaPago = new Date();
    await pago.save();

    return sendResponse(res, 200, {
      success: true,
      message: 'Estado del pago actualizado a PAGADO.',
      data: pago,
    });
  } catch (error) {
    return sendResponse(res, 500, {
      success: false,
      message: 'Error al actualizar el pago.',
      error: error.message,
    });
  }
};

module.exports = {
  crearPago,
  obtenerPagosPorInquilino,
  registrarComprobante,
  marcarComoPagado,
};
