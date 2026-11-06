const contratoController = require('../controllers/contratoController');
const reclamoController = require('../controllers/reclamoController');
const Contrato = require('../models/contrato');
const { obtenerIdentidad, esInquilino, resolverId } = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');
const agrupamientoHelpers = require('../utils/agrupamientoHelpers');
const { ejecutarControlador } = require('../utils/controllerInvoker');
const { AiError, CODIGOS_IA } = require('../utils/aiErrors');

// Taxonomía estricta para la IA. El modelo Mongoose acepta además valores legacy.
const CATEGORIAS_IA = ['PLOMERIA', 'ELECTRICIDAD', 'ESTRUCTURAL', 'EDIFICIO', 'OTRO'];
const CATEGORIAS_RECLAMO = [
  ...CATEGORIAS_IA,
  'GAS',
  'MANTENIMIENTO',
  'SERVICIOS',
  'SEGURIDAD',
];
const PRIORIDADES_IA = ['BAJA', 'MEDIA', 'ALTA'];
const PRIORIDADES_RECLAMO = [...PRIORIDADES_IA, 'URGENTE'];
const ACCIONES = ['LISTAR_CONTRATOS', 'LISTAR_RECLAMOS', 'CLASIFICAR', 'CREAR'];

const CAMPOS_POR_ACCION = {
  LISTAR_CONTRATOS: ['id_agrupamiento'],
  LISTAR_RECLAMOS: ['id_agrupamiento'],
  CLASIFICAR: ['asunto', 'descripcion', 'id_agrupamiento'],
  CREAR: ['id_contrato', 'asunto', 'descripcion', 'categoria', 'prioridad', 'id_agrupamiento'],
};

const PRIORIDAD_BASE = {
  PLOMERIA: 'MEDIA',
  ELECTRICIDAD: 'MEDIA',
  ESTRUCTURAL: 'ALTA',
  EDIFICIO: 'MEDIA',
  OTRO: 'MEDIA',
};

const normalizar = (valor) => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const normalizarTerminos = (terminos) => terminos.map(normalizar);

const escaparRegex = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const coincide = (texto, termino) =>
  new RegExp(`(^|[^a-z0-9])${escaparRegex(termino)}([^a-z0-9]|$)`, 'i').test(texto);

const REGLAS_CATEGORIA = [
  {
    categoria: 'PLOMERIA',
    terminos: normalizarTerminos([
      'plomeria',
      'agua',
      'cano',
      'canilla',
      'inodoro',
      'bano',
      'desague',
      'pileta',
      'ducha',
      'tanque',
      'bomba de agua',
      'perdida de agua',
      'fuga de agua',
      'pierde agua',
      'humedad',
      'gotera',
      'filtracion',
      'gas',
      'garrafa',
      'calefon',
      'termotanque',
      'hornalla',
      'medidor de gas',
      'olor a gas',
      'perdida de gas',
      'fuga de gas',
    ]),
  },
  {
    categoria: 'ELECTRICIDAD',
    terminos: normalizarTerminos([
      'electricidad',
      'electrico',
      'electrica',
      'luz',
      'enchufe',
      'tomacorriente',
      'cortocircuito',
      'disyuntor',
      'termica',
      'lampara',
      'medidor de luz',
      'tablero',
      'chispa',
      'chispas',
    ]),
  },
  {
    categoria: 'ESTRUCTURAL',
    terminos: normalizarTerminos([
      'grieta',
      'rajadura',
      'estructura',
      'techo',
      'mamposteria',
      'desprendimiento',
      'hundimiento',
      'balcon',
      'pared',
      'cielo raso',
      'columna',
      'viga',
    ]),
  },
  {
    categoria: 'EDIFICIO',
    terminos: normalizarTerminos([
      'edificio',
      'ascensor',
      'palier',
      'hall',
      'pasillo',
      'escalera',
      'porton',
      'portero',
      'porteria',
      'limpieza',
      'basura',
      'expensas',
      'administracion',
      'jardin',
      'areas comunes',
      'azotea',
      'terraza',
      'ruido',
      'vecinos',
    ]),
  },
];

const TERMINOS_URGENTES = normalizarTerminos([
  'urgente',
  'emergencia',
  'peligro',
  'riesgo',
  'fuga de gas',
  'olor a gas',
  'perdida de gas',
  'cortocircuito',
  'chispa',
  'chispas',
  'humo',
  'fuego',
  'incendio',
  'inundacion',
  'inundando',
  'desprendimiento',
  'colapso',
  'se cae',
]);

const TERMINOS_ALTOS = normalizarTerminos([
  'perdida de agua',
  'fuga de agua',
  'pierde agua',
  'no tengo agua',
  'no hay agua',
  'sin agua',
  'sin luz',
  'sin gas',
  'no anda',
  'no funciona',
  'roto',
  'rota',
  'rompio',
  'rompieron',
  'filtracion',
  'humedad',
  'gotera',
  'no calienta',
  'sin agua caliente',
  'cerradura',
  'vidrio roto',
  'ventana rota',
  'grave',
  'no abre',
  'no cierra',
  'ascensor detenido',
]);

const TERMINOS_BAJOS = normalizarTerminos([
  'pintura',
  'pintar',
  'estetico',
  'cosmetico',
  'consulta',
  'informacion',
  'certificado',
  'factura',
  'recibo',
  'titular',
  'ruido',
  'molestia',
]);

const PRIMEROS_AUXILIOS = {
  PLOMERIA: [
    'Cerrá la llave de paso general o la más cercana a la pérdida.',
    'No manipules conexiones eléctricas que estén cerca del agua.',
  ],
  ELECTRICIDAD: [
    'No toques el tablero ni los cables expuestos.',
    'Si hay chispas, humo u olor a quemado, cortá la energía desde el disyuntor general solo si es seguro hacerlo.',
  ],
  ESTRUCTURAL: [
    'Alejate del sector afectado y no te apoyes en paredes, balcones ni techos dañados.',
    'Si ves desprendimientos o grietas que avanzan, evacuá y avisá a la administración.',
  ],
  EDIFICIO: [
    'Avisá a la administración o al portero del edificio.',
    'No fuerces ascensores detenidos ni uses escaleras en mal estado.',
  ],
  OTRO: [
    'Describí la incidencia con la mayor precisión posible.',
    'Si detectás riesgo para personas, llamá primero al servicio de emergencias.',
  ],
};

const AUXILIOS_GAS = [
  'Si hay olor a gas, cerrá la llave general, ventilá y no enciendas artefactos ni luces.',
  'Alejate del lugar y llamá al servicio de emergencias del gas.',
];

const tieneAlguno = (texto, terminos) => terminos.some((termino) => coincide(texto, termino));

const calcularPrioridad = (texto, categoria) => {
  if (tieneAlguno(texto, TERMINOS_URGENTES)) return 'ALTA';
  if (tieneAlguno(texto, TERMINOS_ALTOS)) return 'ALTA';
  if (tieneAlguno(texto, TERMINOS_BAJOS)) return 'BAJA';
  return PRIORIDAD_BASE[categoria] || 'MEDIA';
};

const calcularPrimerosAuxilios = (categoria, texto, prioridad) => {
  const auxilios = [...(PRIMEROS_AUXILIOS[categoria] || PRIMEROS_AUXILIOS.OTRO)];
  if (categoria === 'PLOMERIA' && /gas|garrafa|calefon|termotanque|hornalla/.test(texto)) {
    auxilios.unshift(...AUXILIOS_GAS);
  }
  if (prioridad === 'ALTA') {
    auxilios.push('Si hay riesgo de vida, llamá al 911 y seguí las indicaciones del servicio de emergencias.');
  }
  return [...new Set(auxilios)];
};

const clasificarReclamo = ({ asunto = '', descripcion = '' } = {}) => {
  const texto = normalizar(`${asunto} ${descripcion}`);
  if (!texto) {
    throw new AiError(CODIGOS_IA.VALIDACION, 'Describí la incidencia para poder clasificarla.', {
      status: 400,
    });
  }

  const coincidencias = REGLAS_CATEGORIA
    .map((regla) => {
      const encontrados = regla.terminos.filter((termino) => coincide(texto, termino));
      return { ...regla, encontrados, puntaje: encontrados.length };
    })
    .filter((regla) => regla.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje);

  const regla = coincidencias[0];
  const categoria = regla?.categoria || 'OTRO';
  const prioridad = calcularPrioridad(texto, categoria);

  return {
    categoria,
    prioridad,
    justificacion: regla
      ? `Se detectaron términos de ${categoria.toLowerCase()}: ${regla.encontrados.join(', ')}.`
      : 'No se detectaron términos específicos; se propone OTRO.',
    primeros_auxilios: calcularPrimerosAuxilios(categoria, texto, prioridad),
  };
};

const serializarContrato = (contrato) => ({
  id: String(contrato._id),
  propiedad: typeof contrato.id_propiedad === 'object'
    ? contrato.id_propiedad.direccion || 'Propiedad'
    : 'Propiedad',
  fecha_inicio: contrato.fecha_inicio,
  fecha_fin: contrato.fecha_fin,
  monto_mensual: contrato.monto_mensual,
  dia_vencimiento: contrato.dia_vencimiento,
});

const serializarReclamo = (reclamo) => ({
  id: String(reclamo._id),
  id_contrato: String(reclamo.id_contrato?._id || reclamo.id_contrato || ''),
  propiedad: typeof reclamo.id_propiedad === 'object'
    ? reclamo.id_propiedad.direccion || 'Propiedad'
    : undefined,
  asunto: reclamo.asunto,
  descripcion: reclamo.descripcion,
  categoria: reclamo.categoria,
  prioridad: reclamo.prioridad,
  estado: reclamo.estado,
  fecha_creacion: reclamo.fecha_creacion,
});

const listarContratosVigentes = async (usuarioAutenticado, args = {}) => {
  const query = {};
  if (args.id_agrupamiento !== undefined) query.id_agrupamiento = args.id_agrupamiento;
  const respuesta = await ejecutarControlador(contratoController.listarContratos, {
    usuario: usuarioAutenticado,
    query,
    params: {},
    body: {},
  });
  const contratos = Array.isArray(respuesta) ? respuesta : [];
  return contratos
    .filter((contrato) => contrato.estado === 'VIGENTE')
    .map(serializarContrato);
};

const listarReclamos = async (usuarioAutenticado, args = {}) => {
  const query = {};
  if (args.id_agrupamiento !== undefined) query.id_agrupamiento = args.id_agrupamiento;
  const respuesta = await ejecutarControlador(reclamoController.listarReclamos, {
    usuario: usuarioAutenticado,
    query,
    params: {},
    body: {},
  });
  if (!Array.isArray(respuesta?.data)) {
    throw new AiError(CODIGOS_IA.INTERNO, 'La consulta de reclamos devolvió una respuesta inesperada.', {
      status: 500,
    });
  }
  return respuesta.data.map(serializarReclamo);
};

const validarCampos = (accion, args) => {
  const permitidos = new Set(['accion', ...CAMPOS_POR_ACCION[accion]]);
  const invalidos = Object.keys(args).filter((campo) => !permitidos.has(campo));
  if (invalidos.length > 0) {
    throw new AiError(
      CODIGOS_IA.VALIDACION,
      `La herramienta recibió campos no autorizados: ${invalidos.join(', ')}.`,
      { status: 400 },
    );
  }
};

const validarAgrupamientoDelContrato = async (usuarioAutenticado, idContrato, idAgrupamiento) => {
  if (!esObjectIdValido(String(idAgrupamiento))) {
    throw new AiError(CODIGOS_IA.VALIDACION, 'id_agrupamiento inválido.', { status: 400 });
  }
  const { propiedades, error } = await agrupamientoHelpers.resolverAlcanceAgrupamiento(
    idAgrupamiento,
    usuarioAutenticado,
  );
  if (error) {
    throw new AiError(
      error.status === 404 ? CODIGOS_IA.NO_ENCONTRADO : CODIGOS_IA.SIN_PERMISO,
      error.mensaje,
      { status: error.status || 403 },
    );
  }

  const idsPropiedades = propiedades.map((propiedad) => resolverId(propiedad._id));
  const pertenece = await Contrato.exists({
    _id: idContrato,
    id_propiedad: { $in: idsPropiedades },
  });
  if (!pertenece) {
    throw new AiError(CODIGOS_IA.VALIDACION, 'El contrato no pertenece al agrupamiento indicado.', {
      status: 400,
    });
  }
};

const crearReclamo = async (usuarioAutenticado, args) => {
  const { id, roles } = obtenerIdentidad(usuarioAutenticado);
  if (!id) {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'Se requiere una sesión autenticada.', {
      status: 401,
    });
  }
  if (!esInquilino(roles)) {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'Solo un inquilino autenticado puede crear un reclamo.', {
      status: 403,
    });
  }

  const {
    id_contrato,
    asunto,
    descripcion,
    categoria,
    prioridad,
    id_agrupamiento,
  } = args;
  if (!id_contrato || !asunto || !descripcion) {
    throw new AiError(
      CODIGOS_IA.VALIDACION,
      'id_contrato, asunto y descripcion son obligatorios para crear un reclamo.',
      { status: 400 },
    );
  }
  if (categoria !== undefined && !CATEGORIAS_RECLAMO.includes(categoria)) {
    throw new AiError(CODIGOS_IA.VALIDACION, 'La categoría del reclamo no es válida.', {
      status: 400,
    });
  }
  if (prioridad !== undefined && !PRIORIDADES_RECLAMO.includes(prioridad)) {
    throw new AiError(CODIGOS_IA.VALIDACION, 'La prioridad del reclamo no es válida.', {
      status: 400,
    });
  }
  if (id_agrupamiento !== undefined) {
    await validarAgrupamientoDelContrato(usuarioAutenticado, id_contrato, id_agrupamiento);
  }

  const propuesta = clasificarReclamo({ asunto, descripcion });
  const cuerpo = {
    id_contrato,
    asunto,
    descripcion,
    categoria: categoria || propuesta.categoria,
    prioridad: prioridad || propuesta.prioridad,
  };

  const respuesta = await ejecutarControlador(reclamoController.crearReclamo, {
    usuario: usuarioAutenticado,
    query: {},
    params: {},
    body: cuerpo,
  });
  if (!respuesta?.data) {
    throw new AiError(CODIGOS_IA.INTERNO, 'El reclamo no pudo confirmarse en el servidor.', {
      status: 500,
    });
  }

  return {
    creado: true,
    reclamo: serializarReclamo(respuesta.data),
    mensaje: respuesta.message || 'Reclamo registrado.',
    primeros_auxilios: propuesta.primeros_auxilios,
  };
};

const gestionarReclamos = async (usuarioAutenticado, args = {}) => {
  const { id } = obtenerIdentidad(usuarioAutenticado);
  if (!id) {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'Se requiere una sesión autenticada.', {
      status: 401,
    });
  }

  const accion = typeof args.accion === 'string' ? args.accion.trim().toUpperCase() : '';
  if (!ACCIONES.includes(accion)) {
    throw new AiError(CODIGOS_IA.VALIDACION, 'La acción de reclamos no es válida.', {
      status: 400,
    });
  }
  validarCampos(accion, args);

  switch (accion) {
    case 'LISTAR_CONTRATOS': {
      const { roles } = obtenerIdentidad(usuarioAutenticado);
      if (!esInquilino(roles)) {
        throw new AiError(
          CODIGOS_IA.SIN_PERMISO,
          'Solo un inquilino autenticado puede consultar sus contratos vigentes.',
          { status: 403 },
        );
      }
      return listarContratosVigentes(usuarioAutenticado, args);
    }
    case 'LISTAR_RECLAMOS':
      return listarReclamos(usuarioAutenticado, args);
    case 'CLASIFICAR':
      return clasificarReclamo({ asunto: args.asunto, descripcion: args.descripcion });
    case 'CREAR':
      return crearReclamo(usuarioAutenticado, args);
    default:
      throw new AiError(CODIGOS_IA.VALIDACION, 'La acción de reclamos no es válida.', {
        status: 400,
      });
  }
};

module.exports = {
  ACCIONES,
  CATEGORIAS_IA,
  CATEGORIAS_RECLAMO,
  PRIORIDADES_IA,
  PRIORIDADES_RECLAMO,
  clasificarReclamo,
  gestionarReclamos,
  listarContratosVigentes,
  listarReclamos,
  crearReclamo,
};
