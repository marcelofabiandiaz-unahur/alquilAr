const { consultarDatosAlquiler, CAMPOS_PERMITIDOS } = require('./aiConsultaDatosService');
const aiReclamosService = require('./aiReclamosService');
const aiFinanzasService = require('./aiFinanzasService');
const aiAgrupamientoService = require('./aiAgrupamientoService');

const CAMPOS_PROHIBIDOS = ['id_usuario', 'id_inquilino', 'id_propietario', 'usuario', 'roles'];

const CAMPOS_POR_TOOL = {
  consultarDatosAlquiler: [...CAMPOS_PERMITIDOS],
  consultarResumenAgrupamiento: [...aiAgrupamientoService.CAMPOS],
};

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
            id_agrupamiento: {
              type: 'STRING',
              description: 'ID opcional de un agrupamiento visible para el usuario autenticado.',
            },
          },
        },
      },
      {
        name: 'gestionarReclamos',
        description:
          'Gestiona los reclamos del usuario autenticado. Usá LISTAR_CONTRATOS para ver sus contratos vigentes, '
          + 'LISTAR_RECLAMOS para consultar sus reclamos, CLASIFICAR para proponer categoría, prioridad y '
          + 'primeros auxilios a partir de la descripción, y CREAR solo cuando el usuario confirme explícitamente. '
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
              enum: aiReclamosService.CATEGORIAS_IA,
              description: 'Categoría propuesta. Si no se envía, se usa la clasificación del servidor.',
            },
            prioridad: {
              type: 'STRING',
              enum: aiReclamosService.PRIORIDADES_IA,
              description: 'Prioridad propuesta. Si no se envía, se usa la clasificación del servidor.',
            },
            id_agrupamiento: {
              type: 'STRING',
              description: 'ID opcional de un agrupamiento visible. Acota consultas y valida el contrato al crear.',
            },
          },
          required: ['accion'],
        },
      },
      {
        name: 'consultarFinanzas',
        description:
          'Consulta saldos y vencimientos del usuario autenticado, extrae monto y fecha del texto de un comprobante, '
          + 'o redacta un recordatorio de mora. No envía mensajes ni modifica datos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            accion: {
              type: 'STRING',
              enum: aiFinanzasService.ACCIONES,
              description: 'Operación financiera a ejecutar.',
            },
            id_agrupamiento: {
              type: 'STRING',
              description: 'ID opcional de un agrupamiento visible para acotar los saldos.',
            },
            texto: {
              type: 'STRING',
              description: 'Texto del comprobante para ANALIZAR_COMPROBANTE.',
            },
          },
          required: ['accion'],
        },
      },
      {
        name: 'consultarResumenAgrupamiento',
        description:
          'Devuelve métricas consolidadas de cobros, deuda, ocupación y reclamos urgentes, acotadas al rol del '
          + 'usuario autenticado y, opcionalmente, a un agrupamiento visible.',
        parameters: {
          type: 'OBJECT',
          properties: {
            id_agrupamiento: {
              type: 'STRING',
              description: 'ID opcional de un agrupamiento visible. Si es ajeno, la consulta se rechaza.',
            },
            periodo: {
              type: 'STRING',
              description: 'Período opcional con formato YYYY-MM.',
            },
          },
        },
      },
    ],
  },
];

const validarArgumentos = (name, args) => {
  if (args === undefined || args === null) return {};
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('Los argumentos de la herramienta deben ser un objeto.');
  }

  const prohibidos = Object.keys(args).filter((campo) => CAMPOS_PROHIBIDOS.includes(campo));
  if (prohibidos.length > 0) {
    throw new Error(`La herramienta recibió campos no autorizados: ${prohibidos.join(', ')}.`);
  }

  const permitidos = CAMPOS_POR_TOOL[name];
  if (permitidos) {
    const invalidos = Object.keys(args).filter((campo) => !permitidos.includes(campo));
    if (invalidos.length > 0) {
      throw new Error(`La herramienta recibió campos no autorizados: ${invalidos.join(', ')}.`);
    }
  }

  return args;
};

const ejecutarToolSegura = async (name, args = {}, usuarioAutenticado) => {
  const usuario = usuarioAutenticado || {};
  const userId = usuario.id || usuario._id;
  if (!userId) throw new Error('Se requiere una sesión autenticada.');

  const argsSeguros = validarArgumentos(name, args);

  switch (name) {
    case 'consultarDatosAlquiler':
      return consultarDatosAlquiler(usuario, argsSeguros);
    case 'gestionarReclamos':
      return aiReclamosService.gestionarReclamos(usuario, argsSeguros);
    case 'consultarFinanzas':
      return aiFinanzasService.gestionarFinanzas(usuario, argsSeguros);
    case 'consultarResumenAgrupamiento':
      return aiAgrupamientoService.consultarResumenAgrupamiento(usuario, argsSeguros);
    default:
      throw new Error(`La herramienta ${name} no está autorizada o registrada.`);
  }
};

module.exports = {
  CAMPOS_PROHIBIDOS,
  toolsEsquemas,
  ejecutarToolSegura,
};
