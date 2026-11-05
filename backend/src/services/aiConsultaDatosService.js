const pagoController = require('../controllers/pagoController');
const {
  obtenerContratosVisibles,
  obtenerIdentidad,
  resolverId,
} = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');
const { resolverAlcanceAgrupamiento } = require('../utils/agrupamientoHelpers');
const { ejecutarControlador } = require('../utils/controllerInvoker');

const ALCANCES_VALIDOS = new Set(['CONTRATOS', 'PAGOS', 'AMBOS']);
const CAMPOS_PERMITIDOS = new Set(['alcance', 'id_agrupamiento']);

const validarCampos = (args) => {
  const invalidos = Object.keys(args || {}).filter((campo) => !CAMPOS_PERMITIDOS.has(campo));
  if (invalidos.length > 0) {
    throw new Error(`La herramienta recibió campos no autorizados: ${invalidos.join(', ')}.`);
  }
};

const normalizarAlcance = (args) => {
  const raw = typeof args?.alcance === 'string' ? args.alcance.trim().toUpperCase() : 'AMBOS';
  return ALCANCES_VALIDOS.has(raw) ? raw : 'AMBOS';
};

const serializarContrato = (contrato) => ({
  id: String(contrato._id),
  estado: contrato.estado,
  propiedad: contrato.id_propiedad?.direccion || 'Propiedad',
  fecha_inicio: contrato.fecha_inicio,
  fecha_fin: contrato.fecha_fin,
  monto_mensual: contrato.monto_mensual,
  dia_vencimiento: contrato.dia_vencimiento,
});

const consultarContratos = async (usuarioAutenticado, args = {}) => {
  const { id } = obtenerIdentidad(usuarioAutenticado);
  if (!id) throw new Error('Se requiere una sesión autenticada.');

  const consulta = await obtenerContratosVisibles(usuarioAutenticado);
  if (!consulta) {
    throw new Error('No tenés permiso para consultar contratos.');
  }

  let contratos = await consulta
    .populate('id_propiedad', 'direccion')
    .select('estado fecha_inicio fecha_fin monto_mensual dia_vencimiento id_propiedad')
    .sort({ fecha_inicio: -1 });

  if (args.id_agrupamiento !== undefined) {
    if (!esObjectIdValido(String(args.id_agrupamiento))) {
      throw new Error('id_agrupamiento inválido.');
    }
    const { propiedades, error } = await resolverAlcanceAgrupamiento(
      args.id_agrupamiento,
      usuarioAutenticado,
    );
    if (error) throw new Error(error.mensaje);
    const ids = new Set(propiedades.map((propiedad) => resolverId(propiedad._id)));
    contratos = contratos.filter((contrato) =>
      ids.has(resolverId(contrato.id_propiedad)));
  }

  return contratos.map(serializarContrato);
};

const serializarPago = (pago) => {
  const contrato = pago.id_contrato;
  const propiedad = contrato?.id_propiedad;
  const idContrato = contrato?._id || contrato || pago.id_contrato;
  return {
    id: String(pago._id),
    id_contrato: String(idContrato),
    mes_correspondiente: pago.mes_correspondiente,
    monto_total: pago.monto_total,
    estado: pago.estado,
    fecha_vencimiento: pago.fecha_vencimiento,
    propiedad: propiedad?.direccion || undefined,
    tipo: pago.tipo,
  };
};

const consultarPagos = async (usuarioAutenticado, args = {}) => {
  const { id } = obtenerIdentidad(usuarioAutenticado);
  if (!id) throw new Error('Se requiere una sesión autenticada.');

  const query = {};
  if (args.id_agrupamiento !== undefined) {
    if (!esObjectIdValido(String(args.id_agrupamiento))) {
      throw new Error('id_agrupamiento inválido.');
    }
    query.id_agrupamiento = args.id_agrupamiento;
  }

  const respuesta = await ejecutarControlador(pagoController.listarPagos, {
    usuario: usuarioAutenticado,
    query,
    params: {},
    body: {},
  });

  const pagos = Array.isArray(respuesta?.data) ? respuesta.data : [];
  return pagos.map(serializarPago);
};

const consultarDatosAlquiler = async (usuarioAutenticado, args = {}) => {
  validarCampos(args);
  const alcance = normalizarAlcance(args);
  const resultado = {};

  if (alcance === 'CONTRATOS' || alcance === 'AMBOS') {
    resultado.contratos = await consultarContratos(usuarioAutenticado, args);
  }
  if (alcance === 'PAGOS' || alcance === 'AMBOS') {
    resultado.pagos = await consultarPagos(usuarioAutenticado, args);
  }

  return resultado;
};

module.exports = {
  CAMPOS_PERMITIDOS,
  consultarDatosAlquiler,
  consultarContratos,
  consultarPagos,
  normalizarAlcance,
};
