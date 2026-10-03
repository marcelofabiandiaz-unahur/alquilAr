const Reclamo = require('../models/reclamo');
const { sendResponse } = require('../utils/controllerHelpers');

//Crear un nuevo reclamo
const crearReclamo = async (req, res) => {
  try {
    const { contrato, titulo, descripcion, categoria, prioridad } = req.body;
    const inquilinoId = req.usuario._id; // Extraído del token por el middleware de auth

    if (!contrato || !titulo || !descripcion) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Contrato, título y descripción son requeridos.',
      });
    }

    const nuevoReclamo = new Reclamo({
      contrato,
      inquilino: inquilinoId,
      titulo,
      descripcion,
      categoria,
      prioridad,
    });

    await nuevoReclamo.save();

    return sendResponse(res, 201, {
      success: true,
      message: 'Reclamo registrado exitosamente.',
      data: nuevoReclamo,
    });
  } catch (error) {
    return sendResponse(res, 500, {
      success: false,
      message: 'Error al registrar el reclamo.',
      error: error.message,
    });
  }
};

//Obtener todos los reclamos del inquilino autenticado
const obtenerReclamosPorInquilino = async (req, res) => {
  try {
    const inquilinoId = req.usuario._id;

    const reclamos = await Reclamo.find({ inquilino: inquilinoId }).populate('contrato');

    return sendResponse(res, 200, {
      success: true,
      message: 'Reclamos recuperados exitosamente.',
      data: reclamos,
    });
  } catch (error) {
    return sendResponse(res, 500, {
      success: false,
      message: 'Error al obtener reclamos.',
      error: error.message,
    });
  }
};

//Cambiar el estado o prioridad de un reclamo
const actualizarEstadoReclamo = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, prioridad } = req.body;

    const reclamo = await Reclamo.findById(id);
    if (!reclamo) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Reclamo no encontrado.',
      });
    }

    if (estado) reclamo.estado = estado;
    if (prioridad) reclamo.prioridad = prioridad;

    await reclamo.save();

    return sendResponse(res, 200, {
      success: true,
      message: 'Estado del reclamo actualizado correctamente.',
      data: reclamo,
    });
  } catch (error) {
    return sendResponse(res, 500, {
      success: false,
      message: 'Error al actualizar el estado del reclamo.',
      error: error.message,
    });
  }
};

module.exports = {
  crearReclamo,
  obtenerReclamosPorInquilino,
  actualizarEstadoReclamo,
};
