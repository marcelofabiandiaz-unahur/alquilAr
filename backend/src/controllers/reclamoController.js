const Reclamo = require('../models/reclamo');
const Propiedad = require('../models/propiedad');
const Contrato = require('../models/contrato');
const {
  obtenerIdentidad,
  resolverId,
  esAdministrador,
  esPropietario,
  esInquilino,
  buscarContratoGestionable,
} = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');
const { resolverAlcanceAgrupamiento } = require('../utils/agrupamientoHelpers');
const { responder, responderError } = require('../utils/controllerHelpers');

const CATEGORIAS_RECLAMO = [
  'PLOMERIA',
  'ELECTRICIDAD',
  'ESTRUCTURAL',
  'EDIFICIO',
  'OTRO',
  'GAS',
  'MANTENIMIENTO',
  'SERVICIOS',
  'SEGURIDAD',
];

const listarReclamos = async (req, res) => {
  try {
    const { id, roles } = obtenerIdentidad(req.usuario);
    const query = req.query || {};
    const condiciones = [];
    if (esInquilino(roles)) condiciones.push({ id_inquilino: id });
    if (esPropietario(roles)) {
      const propiedades = await Propiedad.find({ id_propietario: id }).select('_id');
      condiciones.push({ id_propiedad: { $in: propiedades.map((propiedad) => propiedad._id) } });
    }
    let filtro = esAdministrador(roles)
      ? {}
      : condiciones.length === 0
        ? null
        : condiciones.length === 1
          ? condiciones[0]
          : { $or: condiciones };
    if (!filtro) return responder(res, 403, null, 'No tenés permiso para consultar reclamos.');

    const extras = {};
    if (query.estado !== undefined) {
      if (!['PENDIENTE', 'EN_PROCESO', 'RESUELTO', 'CANCELADO'].includes(query.estado)) {
        return responder(res, 400, null, 'estado inválido.');
      }
      extras.estado = query.estado;
    }
    if (query.prioridad !== undefined) {
      if (!['BAJA', 'MEDIA', 'ALTA', 'URGENTE'].includes(query.prioridad)) {
        return responder(res, 400, null, 'prioridad inválida.');
      }
      extras.prioridad = query.prioridad;
    }
    if (query.categoria !== undefined) {
      if (!CATEGORIAS_RECLAMO.includes(query.categoria)) {
        return responder(res, 400, null, 'categoria inválida.');
      }
      extras.categoria = query.categoria;
    }

    if (query.id_agrupamiento !== undefined) {
      if (!esObjectIdValido(String(query.id_agrupamiento))) {
        return responder(res, 400, null, 'id_agrupamiento inválido.');
      }
      const { propiedades, error } = await resolverAlcanceAgrupamiento(
        query.id_agrupamiento,
        req.usuario,
      );
      if (error) return responder(res, error.status, null, error.mensaje);
      extras.id_propiedad = { $in: propiedades.map((propiedad) => propiedad._id) };
    }

    if (Object.keys(extras).length > 0) {
      filtro = Object.keys(filtro).length > 0
        ? { $and: [filtro, extras] }
        : extras;
    }

    const reclamos = await Reclamo.find(filtro)
      .populate('id_contrato')
      .populate('id_propiedad', 'direccion')
      .sort({ fecha_creacion: -1 });
    return responder(res, 200, reclamos, 'Reclamos consultados.');
  } catch (error) {
    return responderError(res, error);
  }
};

const obtenerReclamo = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const reclamo = await Reclamo.findById(req.params.id);
    if (!reclamo) return responder(res, 404, null, 'Reclamo no encontrado.');
    const { contrato, permitido } = await buscarContratoGestionable(resolverId(reclamo.id_contrato), req.usuario);
    if (!contrato || !permitido) return responder(res, 403, null, 'No tenés permiso para ver este reclamo.');
    return responder(res, 200, reclamo, 'Reclamo consultado.');
  } catch (error) {
    return responderError(res, error);
  }
};

const crearReclamo = async (req, res) => {
  try {
    const { id_contrato, asunto, descripcion, prioridad, categoria } = req.body || {};
    if (!id_contrato || !asunto || !descripcion || !categoria) {
      return responder(res, 400, null, 'id_contrato, asunto, descripcion y categoria son obligatorios.');
    }
    if (
      typeof asunto !== 'string'
      || !asunto.trim()
      || asunto.trim().length > 120
      || typeof descripcion !== 'string'
      || !descripcion.trim()
      || descripcion.trim().length > 4000
    ) {
      return responder(res, 400, null, 'El asunto debe tener hasta 120 caracteres y la descripción hasta 4000.');
    }
    if (!CATEGORIAS_RECLAMO.includes(categoria)) {
      return responder(res, 400, null, 'La categoría del reclamo no es válida.');
    }
    if (prioridad !== undefined && !['BAJA', 'MEDIA', 'ALTA', 'URGENTE'].includes(prioridad)) {
      return responder(res, 400, null, 'La prioridad del reclamo no es válida.');
    }
    if (!esObjectIdValido(id_contrato)) return responder(res, 400, null, 'id_contrato inválido.');
    const { id, roles } = obtenerIdentidad(req.usuario);
    if (!esInquilino(roles)) {
      return responder(res, 403, null, 'Solo el inquilino del contrato puede crear un reclamo.');
    }
    const { contrato, propiedad, permitido } = await buscarContratoGestionable(id_contrato, req.usuario);
    if (!contrato || !propiedad) return responder(res, 404, null, 'Contrato o propiedad no encontrados.');
    if (!permitido || resolverId(contrato.id_inquilino) !== resolverId(id)) {
      return responder(res, 403, null, 'Solo el inquilino del contrato puede crear un reclamo.');
    }
    if (contrato.estado !== 'VIGENTE') return responder(res, 409, null, 'Solo se pueden abrir reclamos en contratos vigentes.');

    const reclamo = new Reclamo({
      id_contrato,
      id_propiedad: contrato.id_propiedad,
      id_inquilino: id,
      asunto,
      descripcion,
      prioridad: prioridad || 'MEDIA',
      categoria,
      estado: 'PENDIENTE',
      fecha_creacion: new Date(),
      fecha_actualizacion: new Date(),
    });
    await reclamo.save();
    return responder(res, 201, reclamo, 'Reclamo registrado.');
  } catch (error) {
    if (error.name === 'ValidationError') return responder(res, 400, null, error.message);
    return responderError(res, error);
  }
};

const actualizarReclamo = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const reclamo = await Reclamo.findById(req.params.id);
    if (!reclamo) return responder(res, 404, null, 'Reclamo no encontrado.');
    const { contrato, permitido } = await buscarContratoGestionable(resolverId(reclamo.id_contrato), req.usuario);
    const roles = obtenerIdentidad(req.usuario).roles;
    if (!contrato || !permitido || (!esAdministrador(roles) && !esPropietario(roles))) {
      return responder(res, 403, null, 'Solo el propietario de la propiedad o un administrador puede actualizar el reclamo.');
    }
    const { estado, prioridad } = req.body || {};
    if (estado !== undefined) reclamo.estado = estado;
    if (prioridad !== undefined) reclamo.prioridad = prioridad;
    reclamo.fecha_actualizacion = new Date();
    await reclamo.save();
    return responder(res, 200, reclamo, 'Reclamo actualizado.');
  } catch (error) {
    if (error.name === 'ValidationError') return responder(res, 400, null, error.message);
    return responderError(res, error);
  }
};

const eliminarReclamo = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const reclamo = await Reclamo.findById(req.params.id);
    if (!reclamo) return responder(res, 404, null, 'Reclamo no encontrado.');
    const { contrato, permitido } = await buscarContratoGestionable(resolverId(reclamo.id_contrato), req.usuario);
    const roles = obtenerIdentidad(req.usuario).roles;
    if (!contrato || !permitido || (!esAdministrador(roles) && !esPropietario(roles))) {
      return responder(res, 403, null, 'No tenés permiso para eliminar este reclamo.');
    }
    await reclamo.deleteOne();
    return responder(res, 200, null, 'Reclamo eliminado.');
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = { listarReclamos, obtenerReclamo, crearReclamo, actualizarReclamo, eliminarReclamo };
