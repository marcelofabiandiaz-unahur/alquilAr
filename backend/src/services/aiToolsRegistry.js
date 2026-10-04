const Contrato = require('../models/contrato');
const reclamoController = require('../controllers/reclamoController');

const toolsEsquemas = [
  {
    functionDeclarations: [
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
            id_contrato: { type: 'STRING', description: 'ID de un contrato vigente del usuario autenticado.' },
            asunto: { type: 'STRING', description: 'Título breve del reclamo.' },
            descripcion: { type: 'STRING', description: 'Detalle del problema.' },
            categoria: {
              type: 'STRING',
              enum: ['PLOMERIA', 'ELECTRICIDAD', 'GAS', 'ESTRUCTURAL', 'MANTENIMIENTO', 'OTRO'],
              description: 'Categoría del reclamo.',
            },
            prioridad: {
              type: 'STRING',
              enum: ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'],
              description: 'Prioridad; usar MEDIA salvo que el usuario indique urgencia.',
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

const ejecutarToolSegura = async (name, args = {}, usuarioAutenticado) => {
  const usuario = usuarioAutenticado || {};
  const userId = usuario.id || usuario._id;
  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];

  switch (name) {
    case 'listarMisContratosVigentes': {
      if (!userId || !roles.includes('INQUILINO')) {
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
    case 'listarMisReclamos':
      if (!userId) throw new Error('Se requiere una sesión autenticada.');
      return ejecutarControlador(reclamoController.listarReclamos, {
        usuario,
        query: {},
        params: {},
        body: {},
      });
    case 'crearNuevoReclamo':
      if (!userId) throw new Error('Se requiere una sesión autenticada.');
      return ejecutarControlador(reclamoController.crearReclamo, {
        usuario,
        query: {},
        params: {},
        body: args,
      });
    default:
      throw new Error(`La herramienta ${name} no está autorizada o registrada.`);
  }
};

module.exports = {
  toolsEsquemas,
  ejecutarToolSegura,
};
