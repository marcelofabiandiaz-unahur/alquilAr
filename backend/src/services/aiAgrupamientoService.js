const dashboardController = require('../controllers/dashboardController');
const reclamoController = require('../controllers/reclamoController');
const { obtenerIdentidad } = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');
const { ejecutarControlador } = require('../utils/controllerInvoker');
const { CODIGOS_IA, esAiError } = require('../utils/aiErrors');

const CAMPOS = ['id_agrupamiento', 'periodo'];

const validarCampos = (args) => {
  const invalidos = Object.keys(args || {}).filter((campo) => !CAMPOS.includes(campo));
  if (invalidos.length > 0) {
    throw new AiError(
      CODIGOS_IA.VALIDACION,
      `La herramienta recibió campos no autorizados: ${invalidos.join(', ')}.`,
      { status: 400 },
    );
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
    const total = reclamos.filter((reclamo) => (
      !['RESUELTO', 'CANCELADO'].includes(reclamo.estado)
      && ['ALTA', 'URGENTE'].includes(reclamo.prioridad)
    )).length;
    return { total, advertencia: null };
  } catch (error) {
    // Un problema de permisos no se puede disimular como "0 reclamos":
    // sería información incorrecta. Se propaga para explicarlo en el chat.
    if (esAiError(error) && error.codigo === CODIGOS_IA.SIN_PERMISO) throw error;

    console.error('[IA] No se pudieron contar los reclamos urgentes:', error?.message || error);
    return {
      total: null,
      advertencia: 'No se pudo obtener el conteo de reclamos urgentes.',
    };
  }
};

const consultarResumenAgrupamiento = async (usuarioAutenticado, args = {}) => {
  const { id, roles } = obtenerIdentidad(usuarioAutenticado);
  if (!id) {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'Se requiere una sesión autenticada.', {
      status: 401,
    });
  }
  validarCampos(args);

  const query = {};
  if (args.id_agrupamiento !== undefined) {
    if (!esObjectIdValido(String(args.id_agrupamiento))) {
      throw new AiError(CODIGOS_IA.VALIDACION, 'id_agrupamiento inválido.', { status: 400 });
    }
    query.id_agrupamiento = args.id_agrupamiento;
  }
  if (args.periodo !== undefined) {
    const periodo = String(args.periodo).trim();
    if (!validarPeriodo(periodo)) {
      throw new AiError(CODIGOS_IA.VALIDACION, 'periodo debe tener formato YYYY-MM.', {
        status: 400,
      });
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
  if (!resumen) {
    throw new AiError(CODIGOS_IA.INTERNO, 'No se pudo obtener el resumen del agrupamiento.', {
      status: 500,
    });
  }

  const conteo = await contarReclamosUrgentes(usuarioAutenticado, args.id_agrupamiento);
  const alcance = args.id_agrupamiento
    ? 'AGRUPAMIENTO'
    : roles.includes('ADMINISTRADOR') ? 'GLOBAL' : 'PROPIO';

  return {
    ...resumen,
    reclamosUrgentes: conteo.total,
    ...(conteo.advertencia ? { advertencia: conteo.advertencia } : {}),
    alcance,
  };
};

module.exports = {
  CAMPOS,
  consultarResumenAgrupamiento,
  contarReclamosUrgentes,
};
