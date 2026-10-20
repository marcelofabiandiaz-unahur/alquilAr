const contratoController = require('../controllers/contratoController');
const reclamoController = require('../controllers/reclamoController');
const { consultarDatosAlquiler } = require('./aiConsultaDatosService');

const CATEGORIAS_RECLAMO = [
  'PLOMERIA',
  'ELECTRICIDAD',
  'GAS',
  'ESTRUCTURAL',
  'MANTENIMIENTO',
  'SERVICIOS',
  'SEGURIDAD',
  'OTRO',
];
const PRIORIDADES_RECLAMO = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'];

const toolsEsquemas = [
  {
    functionDeclarations: [
      {
        name: 'consultarDatosAlquiler',
        description:
          'Consulta contratos y/o pagos visibles para el usuario autenticado. '
          + 'La identidad se obtiene solo del token de sesión; no consulta datos de otras cuentas.',
        parameters: {
          type: 'OBJECT',
          properties: {
            alcance: {
              type: 'STRING',
              enum: ['CONTRATOS', 'PAGOS', 'AMBOS'],
              description: 'Qué información devolver. Por defecto AMBOS.',
            },
          },
        },
      },
      {
        name: 'listarMisContratosVigentes',
        description: 'Lista los contratos vigentes del usuario autenticado para identificar sobre cuál necesita ayuda.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'listarMisReclamos',
        description: 'Consulta los reclamos que el usuario autenticado está autorizado a ver.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'crearNuevoReclamo',
        description: 'Crea un reclamo para un contrato vigente del usuario autenticado.',
        parameters: {
          type: 'OBJECT',
          properties: {
            tipo: {
              type: 'STRING',
              enum: ['CONTRATOS', 'RECLAMOS'],
              description: 'Elegí qué información propia consultar.',
            },
          },
          required: ['tipo'],
        },
      },
      {
        name: 'clasificarYCrearReclamo',
        description: 'Clasifica una incidencia de mantenimiento y, cuando el usuario lo solicite, crea el reclamo para uno de sus contratos vigentes.',
        parameters: {
          type: 'OBJECT',
          properties: {
            id_contrato: { type: 'STRING', description: 'ID de un contrato vigente del inquilino autenticado.' },
            asunto: { type: 'STRING', description: 'Título breve, de hasta 120 caracteres.' },
            descripcion: { type: 'STRING', description: 'Detalle de la incidencia, de hasta 4000 caracteres.' },
            categoria: {
              type: 'STRING',
              enum: CATEGORIAS_RECLAMO,
              description: 'Categoría inferida de la incidencia.',
            },
            prioridad: {
              type: 'STRING',
              enum: PRIORIDADES_RECLAMO,
              description: 'Prioridad inferida; usar MEDIA salvo urgencia clara.',
            },
          },
          required: ['id_contrato', 'asunto', 'descripcion', 'categoria'],
        },
      },
    ],
  },
];

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
    throw new Error(responseBody?.message || responseBody?.mensaje || 'No se pudo completar la operación solicitada.');
  }
  return responseBody;
};

const serializarContratoParaAsistente = (contrato) => ({
  id: String(contrato._id),
  estado: contrato.estado,
  propiedad: typeof contrato.id_propiedad === 'object'
    ? contrato.id_propiedad.direccion || 'Propiedad'
    : 'Propiedad',
  fecha_inicio: contrato.fecha_inicio,
  fecha_fin: contrato.fecha_fin,
  monto_mensual: contrato.monto_mensual,
});

const serializarReclamoParaAsistente = (reclamo) => ({
  id: String(reclamo._id),
  asunto: reclamo.asunto,
  descripcion: reclamo.descripcion,
  categoria: reclamo.categoria,
  prioridad: reclamo.prioridad,
  estado: reclamo.estado,
  fecha_creacion: reclamo.fecha_creacion,
});

const ejecutarToolSegura = async (name, args = {}, usuarioAutenticado) => {
  const usuario = usuarioAutenticado || {};
  const userId = usuario.id || usuario._id;
  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];

  switch (name) {
    case 'consultarDatosAlquiler':
      if (!userId) throw new Error('Se requiere una sesión autenticada.');
      return consultarDatosAlquiler(usuario, args);
    case 'listarMisContratosVigentes': {
      if (!userId || !roles.includes('INQUILINO')) {
        throw new Error('Solo un inquilino autenticado puede consultar sus contratos vigentes.');
      }
      const req = { usuario, query: {}, params: {}, body: {} };
      if (args.tipo === 'CONTRATOS') {
        const contratos = await ejecutarControlador(contratoController.listarContratos, req);
        return contratos.map(serializarContratoParaAsistente);
      }
      if (args.tipo === 'RECLAMOS') {
        const respuesta = await ejecutarControlador(reclamoController.listarReclamos, req);
        if (!Array.isArray(respuesta?.data)) {
          throw new Error('La consulta de reclamos devolvió una respuesta inesperada.');
        }
        return respuesta.data.map(serializarReclamoParaAsistente);
      }
      throw new Error('El tipo de consulta no está autorizado.');
    }
    case 'clasificarYCrearReclamo': {
      if (!userId || !roles.includes('INQUILINO')) {
        throw new Error('Solo un inquilino autenticado puede crear un reclamo.');
      }
      const permitido = ['id_contrato', 'asunto', 'descripcion', 'categoria', 'prioridad'];
      if (Object.keys(args).some((campo) => !permitido.includes(campo))) {
        throw new Error('La herramienta recibió campos no autorizados.');
      }
      const respuesta = await ejecutarControlador(reclamoController.crearReclamo, {
        usuario,
        query: {},
        params: {},
        body: args,
      });
      return {
        success: true,
        data: serializarReclamoParaAsistente(respuesta.data),
        message: respuesta.message,
      };
    }
    default:
      throw new Error(`La herramienta ${name} no está autorizada o registrada.`);
  }
};

module.exports = {
  toolsEsquemas,
  ejecutarToolSegura,
};
