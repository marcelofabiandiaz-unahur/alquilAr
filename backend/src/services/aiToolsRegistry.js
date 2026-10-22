const { consultarDatosAlquiler } = require('./aiConsultaDatosService');
const aiReclamosService = require('./aiReclamosService');

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
          'Gestiona los reclamos del usuario autenticado. Usá LISTAR_CONTRATOS para ver sus contratos vigentes, '
          + 'LISTAR_RECLAMOS para consultar sus reclamos, CLASIFICAR para proponer categoría y prioridad a partir '
          + 'de la descripción, y CREAR solo cuando el usuario confirme explícitamente. '
          + 'La identidad se obtiene solo del token de sesión; nunca accede a datos de otra cuenta.',
        parameters: {
          type: 'OBJECT',
          properties: {
            accion: {
              type: 'STRING',
              enum: aiReclamosService.ACCIONES,
              description: 'Operación de reclamos a ejecutar.',
            },
            id_contrato: {
              type: 'STRING',
              description: 'ID de un contrato vigente del inquilino autenticado. Solo para CREAR.',
            },
            asunto: {
              type: 'STRING',
              description: 'Título breve de la incidencia. Para CLASIFICAR y CREAR.',
            },
            descripcion: {
              type: 'STRING',
              description: 'Detalle de la incidencia. Para CLASIFICAR y CREAR.',
            },
            categoria: {
              type: 'STRING',
              enum: aiReclamosService.CATEGORIAS_RECLAMO,
              description: 'Categoría propuesta. Si no se envía, se usa la clasificación del servidor.',
            },
            prioridad: {
              type: 'STRING',
              enum: aiReclamosService.PRIORIDADES_RECLAMO,
              description: 'Prioridad propuesta. Si no se envía, se usa la clasificación del servidor.',
            },
          },
          required: ['accion'],
        },
      },
    ],
  },
];

const ejecutarToolSegura = async (name, args = {}, usuarioAutenticado) => {
  const usuario = usuarioAutenticado || {};
  const userId = usuario.id || usuario._id;

  switch (name) {
    case 'consultarDatosAlquiler':
      if (!userId) throw new Error('Se requiere una sesión autenticada.');
      return consultarDatosAlquiler(usuario, args);
    case 'gestionarReclamos':
      if (!userId) throw new Error('Se requiere una sesión autenticada.');
      return aiReclamosService.gestionarReclamos(usuario, args);
    default:
      throw new Error(`La herramienta ${name} no está autorizada o registrada.`);
  }
};

module.exports = {
  toolsEsquemas,
  ejecutarToolSegura,
};
