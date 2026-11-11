const Agrupamiento = require('../models/agrupamiento');
const Propiedad = require('../models/propiedad');
const Contrato = require('../models/contrato');
const {
  obtenerIdentidad,
  resolverId,
  esAdministrador,
  esPropietario,
  esInquilino,
} = require('./operacionHelpers');

const MENSAJE_NO_VISIBLE = 'No tenés permiso para consultar este agrupamiento.';

const esGestor = (agrupamiento, usuarioId) => {
  if (!agrupamiento || !usuarioId) return false;
  if (resolverId(agrupamiento.id_administrador) === resolverId(usuarioId)) return true;
  return (Array.isArray(agrupamiento.gestores) ? agrupamiento.gestores : [])
    .some((gestor) => resolverId(gestor) === resolverId(usuarioId));
};

const puedeGestionarAgrupamiento = (agrupamiento, usuario) => {
  const { id, roles } = obtenerIdentidad(usuario);
  if (!agrupamiento || !id) return false;
  return esAdministrador(roles) || (esPropietario(roles) && esGestor(agrupamiento, id));
};

const obtenerIdsAgrupamientosDePropiedades = async (filtroPropiedades) => {
  const propiedades = await Propiedad.find({
    ...filtroPropiedades,
    id_agrupamiento: { $ne: null },
  }).select('id_agrupamiento');
  return [...new Set(
    propiedades
      .map((propiedad) => resolverId(propiedad.id_agrupamiento))
      .filter(Boolean),
  )];
};

const buscarAgrupamientosVisibles = async (usuario) => {
  const { id, roles } = obtenerIdentidad(usuario);
  if (!id) return { filtro: null, error: { status: 403, mensaje: MENSAJE_NO_VISIBLE } };

  if (esAdministrador(roles)) return { filtro: {}, error: null };

  const condiciones = [];
  if (esPropietario(roles)) {
    condiciones.push({ id_administrador: id });
    condiciones.push({ gestores: id });
    const idsPropios = await obtenerIdsAgrupamientosDePropiedades({ id_propietario: id });
    if (idsPropios.length > 0) condiciones.push({ _id: { $in: idsPropios } });
  }
  if (esInquilino(roles)) {
    const contratos = await Contrato.find({
      id_inquilino: id,
      estado: 'VIGENTE',
    }).select('id_propiedad');
    const idsPropiedades = [...new Set(
      contratos.map((contrato) => resolverId(contrato.id_propiedad)).filter(Boolean),
    )];
    if (idsPropiedades.length > 0) {
      const idsAgrupamientos = await obtenerIdsAgrupamientosDePropiedades({
        _id: { $in: idsPropiedades },
      });
      if (idsAgrupamientos.length > 0) condiciones.push({ _id: { $in: idsAgrupamientos } });
    }
  }

  if (condiciones.length === 0) {
    return { filtro: { _id: { $in: [] } }, error: null };
  }
  return {
    filtro: condiciones.length === 1 ? condiciones[0] : { $or: condiciones },
    error: null,
  };
};

const obtenerAgrupamientosVisibles = async (usuario) => {
  const { filtro, error } = await buscarAgrupamientosVisibles(usuario);
  if (error) return { agrupamientos: null, error };
  return { agrupamientos: await Agrupamiento.find(filtro).sort({ nombre: 1 }), error: null };
};

const puedeVerAgrupamiento = async (agrupamiento, usuario) => {
  const { id, roles } = obtenerIdentidad(usuario);
  if (!agrupamiento || !id) return false;
  if (esAdministrador(roles)) return true;
  if (esPropietario(roles) && esGestor(agrupamiento, id)) return true;

  if (esPropietario(roles)) {
    const propia = await Propiedad.exists({
      id_agrupamiento: agrupamiento._id,
      id_propietario: id,
    });
    if (propia) return true;
  }

  if (esInquilino(roles)) {
    const propiedades = await Propiedad.find({
      id_agrupamiento: agrupamiento._id,
    }).select('_id');
    const ids = propiedades.map((propiedad) => propiedad._id);
    if (ids.length > 0) {
      const contrato = await Contrato.exists({
        id_inquilino: id,
        id_propiedad: { $in: ids },
        estado: 'VIGENTE',
      });
      if (contrato) return true;
    }
  }

  return false;
};

const obtenerAgrupamientoVisible = async (idAgrupamiento, usuario) => {
  const agrupamiento = await Agrupamiento.findById(idAgrupamiento);
  const { roles } = obtenerIdentidad(usuario);
  if (!agrupamiento) {
    return {
      agrupamiento: null,
      error: {
        status: esAdministrador(roles) ? 404 : 403,
        mensaje: 'Agrupamiento no encontrado.',
      },
    };
  }
  if (!(await puedeVerAgrupamiento(agrupamiento, usuario))) {
    return { agrupamiento: null, error: { status: 403, mensaje: MENSAJE_NO_VISIBLE } };
  }
  return { agrupamiento, error: null };
};

const obtenerPropiedadesVisiblesDeAgrupamiento = async (agrupamiento, usuario) => {
  const { id, roles } = obtenerIdentidad(usuario);
  const filtroBase = {
    id_agrupamiento: agrupamiento._id,
    estado: { $ne: 'INACTIVA' },
  };

  if (esAdministrador(roles) || (esPropietario(roles) && esGestor(agrupamiento, id))) {
    return Propiedad.find(filtroBase);
  }

  const condiciones = [];
  if (esPropietario(roles)) {
    condiciones.push({ ...filtroBase, id_propietario: id });
  }
  if (esInquilino(roles)) {
    const contratos = await Contrato.find({
      id_inquilino: id,
      estado: 'VIGENTE',
    }).select('id_propiedad');
    const idsPropiedades = [...new Set(
      contratos.map((contrato) => resolverId(contrato.id_propiedad)).filter(Boolean),
    )];
    if (idsPropiedades.length > 0) {
      condiciones.push({ ...filtroBase, _id: { $in: idsPropiedades } });
    }
  }

  if (condiciones.length === 0) return [];
  return Propiedad.find(condiciones.length === 1 ? condiciones[0] : { $or: condiciones });
};

const resolverAlcanceAgrupamiento = async (idAgrupamiento, usuario) => {
  const { agrupamiento, error } = await obtenerAgrupamientoVisible(idAgrupamiento, usuario);
  if (error) return { agrupamiento: null, propiedades: null, error };

  const propiedades = await obtenerPropiedadesVisiblesDeAgrupamiento(agrupamiento, usuario);
  return { agrupamiento, propiedades, error: null };
};

module.exports = {
  esGestor,
  buscarAgrupamientosVisibles,
  puedeGestionarAgrupamiento,
  puedeVerAgrupamiento,
  obtenerAgrupamientosVisibles,
  obtenerAgrupamientoVisible,
  obtenerPropiedadesVisiblesDeAgrupamiento,
  resolverAlcanceAgrupamiento,
};
