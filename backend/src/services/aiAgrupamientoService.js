const dashboardController = require('../controllers/dashboardController');
const reclamoController = require('../controllers/reclamoController');
const { obtenerIdentidad } = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');
const { ejecutarControlador } = require('../utils/controllerInvoker');

const CAMPOS = ['id_agrupamiento', 'periodo'];

const validarCampos = (args) => {
  const invalidos = Object.keys(args || {}).filter((campo) => !CAMPOS.includes(campo));
  if (invalidos.length > 0) {
    throw new Error(`La herramienta recibió campos no autorizados: ${invalidos.join(', ')}.`);
  }
};

const validarPeriodo = (periodo) => /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo);

const contarReclamosUrgentes = async (usuarioAutenticado, idAgrupamiento) => {
  try {
    const query = {};
    if (idAgrupamiento !== undefined) query.id_agrupamiento = idAgrupamiento;
    const respuesta = await ejecutarControlador(reclamoController.listarReclamos, {
      usuario: usuarioAutenticado,
      query,
      params: {},
      body: {},
    });
    const reclamos = Array.isArray(respuesta?.data) ? respuesta.data : [];
    return reclamos.filter((reclamo) => (
      !['RESUELTO', 'CANCELADO'].includes(reclamo.estado)
      && ['ALTA', 'URGENTE'].includes(reclamo.prioridad)
    )).length;
  } catch {
    // El resumen financiero sigue siendo útil aunque no se puedan contar los reclamos.
    return 0;
  }
};

const consultarResumenAgrupamiento = async (usuarioAutenticado, args = {}) => {
  const { id, roles } = obtenerIdentidad(usuarioAutenticado);
  if (!id) throw new Error('Se requiere una sesión autenticada.');
  validarCampos(args);

  const query = {};
  if (args.id_agrupamiento !== undefined) {
    if (!esObjectIdValido(String(args.id_agrupamiento))) {
      throw new Error('id_agrupamiento inválido.');
    }
    query.id_agrupamiento = args.id_agrupamiento;
  }
  if (args.periodo !== undefined) {
    const periodo = String(args.periodo).trim();
    if (!validarPeriodo(periodo)) {
      throw new Error('periodo debe tener formato YYYY-MM.');
    }
    query.periodo = periodo;
  }

  const respuesta = await ejecutarControlador(dashboardController.obtenerResumen, {
    usuario: usuarioAutenticado,
    query,
    params: {},
    body: {},
  });

  const resumen = respuesta?.data;
  if (!resumen) throw new Error('No se pudo obtener el resumen del agrupamiento.');

  const reclamosUrgentes = await contarReclamosUrgentes(usuarioAutenticado, args.id_agrupamiento);
  const alcance = args.id_agrupamiento
    ? 'AGRUPAMIENTO'
    : roles.includes('ADMINISTRADOR') ? 'GLOBAL' : 'PROPIO';

  return {
    ...resumen,
    reclamosUrgentes,
    alcance,
  };
};

module.exports = {
  CAMPOS,
  consultarResumenAgrupamiento,
  contarReclamosUrgentes,
};
