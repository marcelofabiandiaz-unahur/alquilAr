const Contrato = require('../models/contrato');
const reclamoController = require('../controllers/reclamoController');
const { consultarDatosAlquiler } = require('./aiConsultaDatosService');

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
        name: 'gestionarReclamos',
        description:
          'Consulta reclamos visibles, consulta contratos vigentes propios para abrir un reclamo, '
          + 'o crea un reclamo con categoría y prioridad sugeridas. La identidad y los permisos '
          + 'se verifican únicamente con la sesión autenticada.',
        parameters: {
          type: 'OBJECT',
          properties: {
            accion: {
              type: 'STRING',
              enum: ['LISTAR', 'CONTRATOS_VIGENTES', 'CREAR'],
              description: 'Acción requerida: listar reclamos, consultar contratos vigentes o crear un reclamo.',
            },
            id_contrato: { type: 'STRING', description: 'ID de un contrato vigente del usuario autenticado.' },
            asunto: { type: 'STRING', description: 'Título breve del reclamo.' },
            descripcion: { type: 'STRING', description: 'Detalle del problema.' },
            categoria: {
              type: 'STRING',
              enum: ['PLOMERIA', 'ELECTRICIDAD', 'GAS', 'ESTRUCTURAL', 'MANTENIMIENTO', 'SERVICIOS', 'SEGURIDAD', 'OTRO'],
              description: 'Categoría del reclamo.',
            },
            prioridad: {
              type: 'STRING',
              enum: ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'],
              description: 'Prioridad; usar MEDIA salvo que el usuario indique urgencia.',
            },
          },
          required: ['accion'],
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

const ejecutarToolSegura = async (name, args = {}, usuarioAutenticado) => {
  const usuario = usuarioAutenticado || {};
  const userId = usuario.id || usuario._id;
  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];

  switch (name) {
    case 'consultarDatosAlquiler':
      if (!userId) throw new Error('Se requiere una sesión autenticada.');
      return consultarDatosAlquiler(usuario, args);
    case 'gestionarReclamos': {
      if (!userId) throw new Error('Se requiere una sesión autenticada.');
      switch (args.accion) {
        case 'LISTAR':
          return ejecutarControlador(reclamoController.listarReclamos, {
            usuario,
            query: {},
            params: {},
            body: {},
          });
        case 'CONTRATOS_VIGENTES': {
          if (!roles.includes('INQUILINO')) {
            throw new Error('Solo un inquilino autenticado puede consultar sus contratos vigentes.');
          }
          const contratos = await Contrato.find({ id_inquilino: userId, estado: 'VIGENTE' })
            .select('_id id_propiedad fecha_inicio fecha_fin')
            .populate('id_propiedad', 'direccion');
          return contratos.map((contrato) => ({
            id: String(contrato._id),
            propiedad: contrato.id_propiedad?.direccion || 'Propiedad',
            fecha_inicio: contrato.fecha_inicio,
            fecha_fin: contrato.fecha_fin,
          }));
        }
        case 'CREAR': {
          if (!roles.includes('INQUILINO')) {
            throw new Error('Solo un inquilino autenticado puede crear un reclamo.');
          }
          const datosReclamo = { ...args };
          delete datosReclamo.accion;
          return ejecutarControlador(reclamoController.crearReclamo, {
            usuario,
            query: {},
            params: {},
            body: datosReclamo,
          });
        }
        default:
          throw new Error('La acción de gestión de reclamos no está autorizada.');
      }
    }
    default:
      throw new Error(`La herramienta ${name} no está autorizada o registrada.`);
  }
};

module.exports = {
  toolsEsquemas,
  ejecutarToolSegura,
};
