const mongoose = require('mongoose');

const esObjectIdValido = (id) => {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
};

const resolverIdReferencia = (ref) => {
  if (!ref) return null;
  if (ref._id) return ref._id.toString();
  return ref.toString();
};

const esAdmin = (roles) => roles.includes('ADMINISTRADOR');
const esPropietario = (roles) => roles.includes('PROPIETARIO');
const esInquilino = (roles) => roles.includes('INQUILINO');

const perteneceAlPropietario = (propiedad, usuarioId) =>
  propiedad.id_propietario.toString() === usuarioId.toString();

const puedeVerContrato = (contrato, propiedad, usuarioId, roles) => {
  if (esAdmin(roles)) return true;
  if (perteneceAlPropietario(propiedad, usuarioId)) return true;
  if (resolverIdReferencia(contrato.id_inquilino) === usuarioId.toString()) return true;
  return false;
};

const puedeCambiarEstadoPropiedad = (estadoActual, estadoNuevo) => {
  if (estadoActual === estadoNuevo) {
    return { ok: true };
  }
  if (estadoNuevo === 'INACTIVA') {
    return { ok: false, mensaje: 'La baja lógica se realiza con DELETE.' };
  }
  if (estadoNuevo === 'ALQUILADA') {
    return { ok: false, mensaje: 'ALQUILADA solo se asigna via contrato vigente.' };
  }
  if (estadoNuevo === 'DISPONIBLE' || estadoNuevo === 'EN_MANTENIMIENTO') {
    return { ok: true };
  }
  return { ok: false, mensaje: 'Estado no válido.' };
};

const debeLiberarPropiedad = (estadoAnterior, estadoNuevo) =>
  estadoAnterior === 'VIGENTE'
  && (estadoNuevo === 'FINALIZADO' || estadoNuevo === 'CANCELADO' || estadoNuevo === 'BORRADOR');

const construirFiltroContratosMixto = (usuarioId, propiedadIds) => ({
  $or: [
    { id_propiedad: { $in: propiedadIds } },
    { id_inquilino: usuarioId },
  ],
});

const propiedadPermiteContratoVigente = (estadoPropiedad) =>
  estadoPropiedad === 'DISPONIBLE' || estadoPropiedad === 'EN_MANTENIMIENTO';

const esErrorCast = (error) => error?.name === 'CastError';

module.exports = {
  esObjectIdValido,
  resolverIdReferencia,
  esAdmin,
  esPropietario,
  esInquilino,
  perteneceAlPropietario,
  puedeVerContrato,
  puedeCambiarEstadoPropiedad,
  debeLiberarPropiedad,
  construirFiltroContratosMixto,
  propiedadPermiteContratoVigente,
  esErrorCast,
};
