const Gasto = require('../models/gasto');
const Propiedad = require('../models/propiedad');
const Contrato = require('../models/contrato');
const {
  obtenerIdentidad,
  resolverId,
  esAdministrador,
  esPropietario,
  esInquilino,
  buscarPropiedadGestionable,
} = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');

const responder = (res, status, data, message) =>
  res.status(status).json({ success: status < 400, data, message });

const obtenerPropiedadesVisibles = async (usuario) => {
  const { id, roles } = obtenerIdentidad(usuario);
  const condiciones = [];
  if (esPropietario(roles)) condiciones.push({ id_propietario: id });
  if (esInquilino(roles)) {
    const contratos = await Contrato.find({ id_inquilino: id, estado: 'VIGENTE' }).select('id_propiedad');
    const ids = contratos.map((contrato) => resolverId(contrato.id_propiedad));
    if (ids.length) condiciones.push({ _id: { $in: ids } });
  }
  if (esAdministrador(roles)) return null;
  if (!condiciones.length) return [];
  const filtro = condiciones.length === 1 ? condiciones[0] : { $or: condiciones };
  return Propiedad.find(filtro).select('_id');
};

const listarGastos = async (req, res) => {
  try {
    const { roles } = obtenerIdentidad(req.usuario);
    if (!roles.some((rol) => ['ADMINISTRADOR', 'PROPIETARIO', 'INQUILINO'].includes(rol))) {
      return responder(res, 403, null, 'No tenés permiso para consultar gastos.');
    }
    const propiedades = await obtenerPropiedadesVisibles(req.usuario);
    const filtro = propiedades ? { id_propiedad: { $in: propiedades.map((p) => p._id) } } : {};

    if (req.query.id_propiedad) {
      if (!esObjectIdValido(req.query.id_propiedad)) return responder(res, 400, null, 'id_propiedad inválido.');
      if (propiedades && !propiedades.some((p) => resolverId(p._id) === req.query.id_propiedad)) {
        return responder(res, 403, null, 'No tenés permiso para consultar esta propiedad.');
      }
      filtro.id_propiedad = req.query.id_propiedad;
    }
    if (req.query.desde || req.query.hasta) {
      const desde = req.query.desde ? new Date(req.query.desde) : null;
      const hasta = req.query.hasta ? new Date(req.query.hasta) : null;
      if ((desde && Number.isNaN(desde.getTime())) || (hasta && Number.isNaN(hasta.getTime()))) {
        return responder(res, 400, null, 'El período indicado no es válido.');
      }
      if (desde && hasta && desde > hasta) return responder(res, 400, null, 'El inicio del período debe ser anterior al fin.');
      filtro.fecha_emision = {};
      if (desde) filtro.fecha_emision.$gte = desde;
      if (hasta) {
        hasta.setHours(23, 59, 59, 999);
        filtro.fecha_emision.$lte = hasta;
      }
    }
    if (req.query.estado_pago) filtro.estado_pago = req.query.estado_pago;
    if (req.query.estado_pago && !['PENDIENTE', 'PAGADO', 'ATRASADO'].includes(req.query.estado_pago)) {
      return responder(res, 400, null, 'estado_pago inválido.');
    }

    const gastos = await Gasto.find(filtro)
      .populate('id_propiedad', 'direccion tipo id_propietario')
      .sort({ fecha_emision: -1 });
    return responder(res, 200, gastos, 'Gastos consultados.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

const obtenerGasto = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const gasto = await Gasto.findById(req.params.id).populate('id_propiedad', 'direccion tipo id_propietario');
    if (!gasto) return responder(res, 404, null, 'Gasto no encontrado.');
    const { permitido } = await buscarPropiedadGestionable(resolverId(gasto.id_propiedad), req.usuario);
    const roles = obtenerIdentidad(req.usuario).roles;
    let puedeLeerComoInquilino = false;
    if (!permitido && esInquilino(roles)) {
      puedeLeerComoInquilino = Boolean(await Contrato.exists({
        id_propiedad: resolverId(gasto.id_propiedad),
        id_inquilino: obtenerIdentidad(req.usuario).id,
        estado: 'VIGENTE',
      }));
    }
    if (!permitido && !puedeLeerComoInquilino) return responder(res, 403, null, 'No tenés permiso para ver este gasto.');
    return responder(res, 200, gasto, 'Gasto consultado.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

const crearGasto = async (req, res) => {
  try {
    const { id_propiedad, fecha_emision, monto_total, tipo, estado_pago, proveedor, comprobantes } = req.body || {};
    if (!id_propiedad || !fecha_emision || monto_total === undefined || !tipo) {
      return responder(res, 400, null, 'id_propiedad, fecha_emision, monto_total y tipo son obligatorios.');
    }
    if (!esObjectIdValido(id_propiedad)) return responder(res, 400, null, 'id_propiedad inválido.');
    if (!Number.isFinite(Number(monto_total)) || Number(monto_total) < 0) {
      return responder(res, 400, null, 'monto_total debe ser un número mayor o igual a cero.');
    }
    if (Number.isNaN(new Date(fecha_emision).getTime())) return responder(res, 400, null, 'fecha_emision inválida.');
    if (comprobantes !== undefined
      && (!Array.isArray(comprobantes) || comprobantes.some((url) => typeof url !== 'string' || !/^https:\/\/\S+$/.test(url)))) {
      return responder(res, 400, null, 'comprobantes debe ser un array de URLs HTTPS.');
    }
    const { propiedad, permitido } = await buscarPropiedadGestionable(id_propiedad, req.usuario);
    if (!propiedad) return responder(res, 404, null, 'Propiedad no encontrada.');
    if (!permitido) return responder(res, 403, null, 'Solo el propietario o un administrador puede registrar gastos.');
    const gasto = new Gasto({
      id_propiedad,
      fecha_emision,
      monto_total: Number(monto_total),
      tipo,
      estado_pago: estado_pago || 'PENDIENTE',
      proveedor: proveedor || '',
      comprobantes: Array.isArray(comprobantes) ? comprobantes : [],
    });
    await gasto.save();
    return responder(res, 201, gasto, 'Gasto registrado.');
  } catch (error) {
    if (error.name === 'ValidationError') return responder(res, 400, null, error.message);
    return responder(res, 500, null, error.message);
  }
};

const actualizarGasto = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const gasto = await Gasto.findById(req.params.id);
    if (!gasto) return responder(res, 404, null, 'Gasto no encontrado.');
    const { permitido } = await buscarPropiedadGestionable(resolverId(gasto.id_propiedad), req.usuario);
    if (!permitido) return responder(res, 403, null, 'No tenés permiso para modificar este gasto.');
    if (req.body?.comprobantes !== undefined
      && (!Array.isArray(req.body.comprobantes)
        || req.body.comprobantes.some((url) => typeof url !== 'string' || !/^https:\/\/\S+$/.test(url)))) {
      return responder(res, 400, null, 'comprobantes debe ser un array de URLs HTTPS.');
    }
    const permitidos = ['fecha_emision', 'monto_total', 'tipo', 'estado_pago', 'proveedor', 'comprobantes'];
    for (const campo of permitidos) {
      if (req.body?.[campo] !== undefined) gasto[campo] = req.body[campo];
    }
    await gasto.save();
    return responder(res, 200, gasto, 'Gasto actualizado.');
  } catch (error) {
    if (error.name === 'ValidationError') return responder(res, 400, null, error.message);
    return responder(res, 500, null, error.message);
  }
};

const eliminarGasto = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const gasto = await Gasto.findById(req.params.id);
    if (!gasto) return responder(res, 404, null, 'Gasto no encontrado.');
    const { permitido } = await buscarPropiedadGestionable(resolverId(gasto.id_propiedad), req.usuario);
    if (!permitido) return responder(res, 403, null, 'No tenés permiso para eliminar este gasto.');
    await gasto.deleteOne();
    return responder(res, 200, null, 'Gasto eliminado.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

module.exports = { listarGastos, obtenerGasto, crearGasto, actualizarGasto, eliminarGasto };
