const pagoController = require('../controllers/pagoController');
const { obtenerContratosVisibles, obtenerIdentidad } = require('../utils/operacionHelpers');

const ALCANCES_VALIDOS = new Set(['CONTRATOS', 'PAGOS', 'AMBOS']);

const ejecutarControlador = async (controlador, req) => {
  let statusCode = 200;
  let responseBody;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await controlador(req, res);
  if (statusCode >= 400) {
    throw new Error(responseBody?.message || responseBody?.mensaje || 'No se pudo completar la consulta.');
  }
  return responseBody;
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

const consultarContratos = async (usuarioAutenticado) => {
  const { id } = obtenerIdentidad(usuarioAutenticado);
  if (!id) throw new Error('Se requiere una sesión autenticada.');

  const consulta = await obtenerContratosVisibles(usuarioAutenticado);
  if (!consulta) {
    throw new Error('No tenés permiso para consultar contratos.');
  }

  const contratos = await consulta
    .populate('id_propiedad', 'direccion')
    .select('estado fecha_inicio fecha_fin monto_mensual dia_vencimiento id_propiedad')
    .sort({ fecha_inicio: -1 });

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

const consultarPagos = async (usuarioAutenticado) => {
  const { id } = obtenerIdentidad(usuarioAutenticado);
  if (!id) throw new Error('Se requiere una sesión autenticada.');

  const respuesta = await ejecutarControlador(pagoController.listarPagos, {
    usuario: usuarioAutenticado,
    query: {},
    params: {},
    body: {},
  });

  const pagos = Array.isArray(respuesta?.data) ? respuesta.data : [];
  return pagos.map(serializarPago);
};

const consultarDatosAlquiler = async (usuarioAutenticado, args = {}) => {
  const alcance = normalizarAlcance(args);
  const resultado = {};

  if (alcance === 'CONTRATOS' || alcance === 'AMBOS') {
    resultado.contratos = await consultarContratos(usuarioAutenticado);
  }
  if (alcance === 'PAGOS' || alcance === 'AMBOS') {
    resultado.pagos = await consultarPagos(usuarioAutenticado);
  }

  return resultado;
};

module.exports = {
  consultarDatosAlquiler,
  consultarContratos,
  consultarPagos,
  normalizarAlcance,
};
