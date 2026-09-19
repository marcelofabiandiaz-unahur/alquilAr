const mongoose = require('mongoose');
const Contrato = require('../models/contrato');
const Propiedad = require('../models/propiedad');
const Usuario = require('../models/usuario');
const {
  esAdmin,
  esPropietario,
  esInquilino,
  perteneceAlPropietario,
  puedeVerContrato,
  debeLiberarPropiedad,
  construirFiltroContratosMixto,
  propiedadPermiteContratoVigente,
  esErrorCast,
} = require('../utils/recursosHelpers');
const {
  validarIdParam,
  validarObjectIdBody,
  responderErrorServidor,
} = require('../utils/controllerHelpers');

// Requiere replica set (MongoDB Atlas cumple).
const ejecutarTransaccion = async (callback) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const resolverInquilino = async (body, res) => {
  if (body.email_inquilino) {
    const email = String(body.email_inquilino).trim().toLowerCase();
    if (!email) {
      res.status(400).json({ mensaje: 'email_inquilino es requerido.' });
      return null;
    }
    const inquilino = await Usuario.findOne({ email });
    if (!inquilino) {
      res.status(404).json({ mensaje: 'No existe un usuario registrado con ese email.' });
      return null;
    }
    return inquilino;
  }

  if (body.id_inquilino) {
    if (!validarObjectIdBody(body.id_inquilino, res, 'id_inquilino')) return null;
    const inquilino = await Usuario.findById(body.id_inquilino);
    if (!inquilino) {
      res.status(404).json({ mensaje: 'Inquilino no encontrado.' });
      return null;
    }
    return inquilino;
  }

  res.status(400).json({ mensaje: 'Debe indicar email_inquilino o id_inquilino.' });
  return null;
};

const obtenerPropiedadConPermiso = async (idPropiedad, usuarioId, roles) => {
  const propiedad = await Propiedad.findById(idPropiedad);
  if (!propiedad || propiedad.estado === 'INACTIVA') {
    return { error: { status: 404, mensaje: 'Propiedad no encontrada.' } };
  }

  if (!esAdmin(roles) && !perteneceAlPropietario(propiedad, usuarioId)) {
    return { error: { status: 403, mensaje: 'No tienes permiso sobre esta propiedad.' } };
  }

  return { propiedad };
};

const listarContratos = async (req, res) => {
  try {
    const { roles, id: usuarioId } = req.usuario;
    let contratos;

    if (esAdmin(roles)) {
      contratos = await Contrato.find()
        .populate('id_propiedad', 'direccion tipo estado id_propietario')
        .populate('id_inquilino', 'nombre apellido email dni')
        .sort({ createdAt: -1 });
    } else if (esPropietario(roles) && esInquilino(roles)) {
      const propiedades = await Propiedad.find({
        id_propietario: usuarioId,
        estado: { $ne: 'INACTIVA' },
      }).select('_id');
      const ids = propiedades.map((p) => p._id);
      contratos = await Contrato.find(construirFiltroContratosMixto(usuarioId, ids))
        .populate('id_propiedad', 'direccion tipo estado')
        .populate('id_inquilino', 'nombre apellido email dni')
        .sort({ createdAt: -1 });
    } else if (esPropietario(roles)) {
      const propiedades = await Propiedad.find({
        id_propietario: usuarioId,
        estado: { $ne: 'INACTIVA' },
      }).select('_id');
      const ids = propiedades.map((p) => p._id);
      contratos = await Contrato.find({ id_propiedad: { $in: ids } })
        .populate('id_propiedad', 'direccion tipo estado')
        .populate('id_inquilino', 'nombre apellido email dni')
        .sort({ createdAt: -1 });
    } else if (esInquilino(roles)) {
      contratos = await Contrato.find({ id_inquilino: usuarioId })
        .populate('id_propiedad', 'direccion tipo estado id_propietario')
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ mensaje: 'No tienes permiso para listar contratos.' });
    }

    res.json(contratos);
  } catch (error) {
    responderErrorServidor(res, error);
  }
};

const obtenerContrato = async (req, res) => {
  if (!validarIdParam(req, res)) return;

  try {
    const contrato = await Contrato.findById(req.params.id)
      .populate('id_propiedad')
      .populate('id_inquilino', 'nombre apellido email dni');

    if (!contrato) {
      return res.status(404).json({ mensaje: 'Contrato no encontrado.' });
    }

    const propiedad = contrato.id_propiedad;
    const { roles, id: usuarioId } = req.usuario;

    if (!puedeVerContrato(contrato, propiedad, usuarioId, roles)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para ver este contrato.' });
    }

    res.json(contrato);
  } catch (error) {
    responderErrorServidor(res, error);
  }
};

const crearContrato = async (req, res) => {
  try {
    const { roles, id: usuarioId } = req.usuario;

    if (!esPropietario(roles) && !esAdmin(roles)) {
      return res.status(403).json({ mensaje: 'Solo propietarios pueden crear contratos.' });
    }

    if (!validarObjectIdBody(req.body.id_propiedad, res, 'id_propiedad')) return;

    const inquilino = await resolverInquilino(req.body, res);
    if (!inquilino) return;

    const { propiedad, error } = await obtenerPropiedadConPermiso(
      req.body.id_propiedad,
      usuarioId,
      roles,
    );
    if (error) {
      return res.status(error.status).json({ mensaje: error.mensaje });
    }

    let estado = req.body.estado || 'BORRADOR';
    let requiereRolInquilino = false;

    if (!inquilino.roles.includes('INQUILINO')) {
      estado = 'BORRADOR';
      requiereRolInquilino = true;
    }

    if (estado === 'VIGENTE') {
      const vigenteExistente = await Contrato.findOne({
        id_propiedad: propiedad._id,
        estado: 'VIGENTE',
      });
      if (vigenteExistente) {
        return res.status(400).json({
          mensaje: 'La propiedad ya tiene un contrato vigente.',
        });
      }
      if (!propiedadPermiteContratoVigente(propiedad.estado)) {
        return res.status(400).json({
          mensaje: 'La propiedad no está disponible para un contrato vigente.',
        });
      }
    }

    const contrato = new Contrato({
      id_propiedad: propiedad._id,
      id_inquilino: inquilino._id,
      fecha_inicio: req.body.fecha_inicio,
      fecha_fin: req.body.fecha_fin,
      monto_mensual: req.body.monto_mensual,
      dia_vencimiento: req.body.dia_vencimiento,
      estado,
      garante: req.body.garante || {},
    });

    if (estado === 'VIGENTE') {
      propiedad.estado = 'ALQUILADA';
      await ejecutarTransaccion(async (session) => {
        await contrato.save({ session });
        await propiedad.save({ session });
      });
    } else {
      await contrato.save();
    }

    const contratoPopulado = await Contrato.findById(contrato._id)
      .populate('id_propiedad', 'direccion tipo estado')
      .populate('id_inquilino', 'nombre apellido email dni');

    const respuesta = contratoPopulado.toObject();
    if (requiereRolInquilino) {
      respuesta.requiere_rol_inquilino = true;
    }

    res.status(201).json(respuesta);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ mensaje: 'La propiedad ya tiene un contrato vigente.' });
    }
    res.status(400).json({ mensaje: 'Error al crear contrato', error: error.message });
  }
};

const actualizarContrato = async (req, res) => {
  if (!validarIdParam(req, res)) return;

  try {
    const contrato = await Contrato.findById(req.params.id);
    if (!contrato) {
      return res.status(404).json({ mensaje: 'Contrato no encontrado.' });
    }

    const { propiedad, error } = await obtenerPropiedadConPermiso(
      contrato.id_propiedad,
      req.usuario.id,
      req.usuario.roles,
    );
    if (error) {
      return res.status(error.status).json({ mensaje: error.mensaje });
    }

    if (contrato.estado === 'FINALIZADO' || contrato.estado === 'CANCELADO') {
      return res.status(400).json({ mensaje: 'No se puede modificar un contrato cerrado.' });
    }

    const estadoAnterior = contrato.estado;
    const nuevoEstado = req.body.estado;
    let propiedadModificada = false;

    if (nuevoEstado === 'VIGENTE' && contrato.estado !== 'VIGENTE') {
      const inquilinoContrato = await Usuario.findById(contrato.id_inquilino);
      if (!inquilinoContrato || !inquilinoContrato.roles.includes('INQUILINO')) {
        return res.status(400).json({
          mensaje: 'El inquilino debe tener rol INQUILINO antes de activar el contrato.',
        });
      }
      const vigenteExistente = await Contrato.findOne({
        id_propiedad: propiedad._id,
        estado: 'VIGENTE',
        _id: { $ne: contrato._id },
      });
      if (vigenteExistente) {
        return res.status(400).json({ mensaje: 'La propiedad ya tiene un contrato vigente.' });
      }
      if (!propiedadPermiteContratoVigente(propiedad.estado)) {
        return res.status(400).json({
          mensaje: 'La propiedad no está disponible para un contrato vigente.',
        });
      }
      propiedad.estado = 'ALQUILADA';
      propiedadModificada = true;
    } else if (
      nuevoEstado !== undefined
      && debeLiberarPropiedad(estadoAnterior, nuevoEstado)
    ) {
      propiedad.estado = 'DISPONIBLE';
      propiedadModificada = true;
    }

    const camposPermitidos = [
      'fecha_inicio',
      'fecha_fin',
      'monto_mensual',
      'dia_vencimiento',
      'estado',
      'garante',
    ];
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        contrato[campo] = req.body[campo];
      }
    }

    if (propiedadModificada) {
      await ejecutarTransaccion(async (session) => {
        await contrato.save({ session });
        await propiedad.save({ session });
      });
    } else {
      await contrato.save();
    }

    const contratoPopulado = await Contrato.findById(contrato._id)
      .populate('id_propiedad', 'direccion tipo estado')
      .populate('id_inquilino', 'nombre apellido email dni');

    res.json(contratoPopulado);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ mensaje: 'La propiedad ya tiene un contrato vigente.' });
    }
    if (esErrorCast(error)) {
      return res.status(400).json({ mensaje: 'ID inválido.' });
    }
    res.status(400).json({ mensaje: 'Error al actualizar contrato', error: error.message });
  }
};

const finalizarContrato = async (req, res) => {
  if (!validarIdParam(req, res)) return;

  try {
    const contrato = await Contrato.findById(req.params.id);
    if (!contrato) {
      return res.status(404).json({ mensaje: 'Contrato no encontrado.' });
    }

    const { propiedad, error } = await obtenerPropiedadConPermiso(
      contrato.id_propiedad,
      req.usuario.id,
      req.usuario.roles,
    );
    if (error) {
      return res.status(error.status).json({ mensaje: error.mensaje });
    }

    if (contrato.estado !== 'VIGENTE') {
      return res.status(400).json({ mensaje: 'Solo se pueden finalizar contratos vigentes.' });
    }

    contrato.estado = 'FINALIZADO';
    if (req.body.fecha_fin) {
      contrato.fecha_fin = req.body.fecha_fin;
    } else if (!contrato.fecha_fin) {
      contrato.fecha_fin = new Date();
    }

    propiedad.estado = 'DISPONIBLE';

    await ejecutarTransaccion(async (session) => {
      await contrato.save({ session });
      await propiedad.save({ session });
    });

    const contratoPopulado = await Contrato.findById(contrato._id)
      .populate('id_propiedad', 'direccion tipo estado')
      .populate('id_inquilino', 'nombre apellido email dni');

    res.json({
      mensaje: 'Contrato finalizado. Propiedad disponible.',
      contrato: contratoPopulado,
    });
  } catch (error) {
    responderErrorServidor(res, error);
  }
};

const cancelarContrato = async (req, res) => {
  if (!validarIdParam(req, res)) return;

  try {
    const contrato = await Contrato.findById(req.params.id);
    if (!contrato) {
      return res.status(404).json({ mensaje: 'Contrato no encontrado.' });
    }

    const { propiedad, error } = await obtenerPropiedadConPermiso(
      contrato.id_propiedad,
      req.usuario.id,
      req.usuario.roles,
    );
    if (error) {
      return res.status(error.status).json({ mensaje: error.mensaje });
    }

    if (contrato.estado === 'FINALIZADO' || contrato.estado === 'CANCELADO') {
      return res.status(400).json({ mensaje: 'El contrato ya está cerrado.' });
    }

    const eraVigente = contrato.estado === 'VIGENTE';
    contrato.estado = 'CANCELADO';

    if (eraVigente) {
      propiedad.estado = 'DISPONIBLE';
      await ejecutarTransaccion(async (session) => {
        await contrato.save({ session });
        await propiedad.save({ session });
      });
    } else {
      await contrato.save();
    }

    res.json({ mensaje: 'Contrato cancelado.', contrato });
  } catch (error) {
    responderErrorServidor(res, error);
  }
};

module.exports = {
  listarContratos,
  obtenerContrato,
  crearContrato,
  actualizarContrato,
  finalizarContrato,
  cancelarContrato,
};
