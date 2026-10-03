const Contrato = require('../models/contrato');
const Propiedad = require('../models/propiedad');

const obtenerIdentidad = (usuario) => ({
  id: usuario?.id || usuario?._id,
  roles: Array.isArray(usuario?.roles) ? usuario.roles : [],
});

const resolverId = (referencia) => {
  if (!referencia) return null;
  return String(referencia._id || referencia);
};

const esAdministrador = (roles) => roles.includes('ADMINISTRADOR');
const esPropietario = (roles) => roles.includes('PROPIETARIO');
const esInquilino = (roles) => roles.includes('INQUILINO');

const buscarPropiedadGestionable = async (propiedadId, usuario) => {
  const { id, roles } = obtenerIdentidad(usuario);
  const propiedad = await Propiedad.findById(propiedadId);
  if (!propiedad) return { propiedad: null, permitido: false };
  return {
    propiedad,
    permitido: esAdministrador(roles)
      || (esPropietario(roles) && resolverId(propiedad.id_propietario) === resolverId(id)),
  };
};

const buscarContratoGestionable = async (contratoId, usuario) => {
  const contrato = await Contrato.findById(contratoId);
  if (!contrato) return { contrato: null, propiedad: null, permitido: false };
  const propiedad = await Propiedad.findById(resolverId(contrato.id_propiedad));
  if (!propiedad) return { contrato, propiedad: null, permitido: false };
  const { id, roles } = obtenerIdentidad(usuario);
  const permitido = esAdministrador(roles)
    || (esPropietario(roles) && resolverId(propiedad.id_propietario) === resolverId(id))
    || (esInquilino(roles) && resolverId(contrato.id_inquilino) === resolverId(id));
  return { contrato, propiedad, permitido };
};

const obtenerContratosVisibles = async (usuario) => {
  const { id, roles } = obtenerIdentidad(usuario);
  if (esAdministrador(roles)) return Contrato.find({});

  const condiciones = [];
  if (esInquilino(roles)) condiciones.push({ id_inquilino: id });
  if (esPropietario(roles)) {
    const propiedades = await Propiedad.find({ id_propietario: id }).select('_id');
    condiciones.push({ id_propiedad: { $in: propiedades.map((p) => p._id) } });
  }
  if (!condiciones.length) return null;
  return Contrato.find(condiciones.length === 1 ? condiciones[0] : { $or: condiciones });
};

module.exports = {
  obtenerIdentidad,
  resolverId,
  esAdministrador,
  esPropietario,
  esInquilino,
  buscarPropiedadGestionable,
  buscarContratoGestionable,
  obtenerContratosVisibles,
};
