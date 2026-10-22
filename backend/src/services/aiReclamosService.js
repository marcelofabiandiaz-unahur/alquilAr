const contratoController = require('../controllers/contratoController');
const reclamoController = require('../controllers/reclamoController');
const { obtenerIdentidad, esInquilino } = require('../utils/operacionHelpers');

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
const ACCIONES = ['LISTAR_CONTRATOS', 'LISTAR_RECLAMOS', 'CLASIFICAR', 'CREAR'];

const CAMPOS_POR_ACCION = {
  LISTAR_CONTRATOS: [],
  LISTAR_RECLAMOS: [],
  CLASIFICAR: ['asunto', 'descripcion'],
  CREAR: ['id_contrato', 'asunto', 'descripcion', 'categoria', 'prioridad'],
};

const PRIORIDAD_BASE = {
  GAS: 'ALTA',
  ELECTRICIDAD: 'MEDIA',
  PLOMERIA: 'MEDIA',
  ESTRUCTURAL: 'ALTA',
  SEGURIDAD: 'ALTA',
  SERVICIOS: 'BAJA',
  MANTENIMIENTO: 'BAJA',
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
    categoria: 'GAS',
    terminos: normalizarTerminos([
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
    ]),
  },
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
      'escalera',
      'pared',
      'cielo raso',
    ]),
  },
  {
    categoria: 'SEGURIDAD',
    terminos: normalizarTerminos([
      'robo',
      'robaron',
      'me robaron',
      'cerradura',
      'inseguridad',
      'alarma',
      'intruso',
      'porton',
      'rejas',
      'vidrio roto',
      'ventana rota',
    ]),
  },
  {
    categoria: 'SERVICIOS',
    terminos: normalizarTerminos([
      'ascensor',
      'portero',
      'porteria',
      'limpieza',
      'basura',
      'expensas',
      'administracion',
      'internet',
      'jardin',
      'palier',
      'ruido',
      'vecinos',
    ]),
  },
  {
    categoria: 'MANTENIMIENTO',
    terminos: normalizarTerminos([
      'mantenimiento',
      'pintura',
      'pintar',
      'reparacion',
      'arreglo',
      'rotura',
      'cambio de',
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
  'me robaron',
  'intruso',
  'sin gas',
  'sin luz',
]);

const TERMINOS_ALTOS = normalizarTerminos([
  'perdida de agua',
  'fuga de agua',
  'pierde agua',
  'no tengo agua',
  'no hay agua',
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

const tieneAlguno = (texto, terminos) => terminos.some((termino) => coincide(texto, termino));

const calcularPrioridad = (texto, categoria) => {
  if (tieneAlguno(texto, TERMINOS_URGENTES)) return 'URGENTE';
  if (tieneAlguno(texto, TERMINOS_ALTOS)) return 'ALTA';
  if (tieneAlguno(texto, TERMINOS_BAJOS)) return 'BAJA';
  return PRIORIDAD_BASE[categoria] || 'MEDIA';
};

const clasificarReclamo = ({ asunto = '', descripcion = '' } = {}) => {
  const texto = normalizar(`${asunto} ${descripcion}`);
  if (!texto) throw new Error('Describí la incidencia para poder clasificarla.');

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
  };
};

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
    throw new Error(
      responseBody?.message
      || responseBody?.mensaje
      || responseBody?.error
      || 'No se pudo completar la operación solicitada.',
    );
  }
  return responseBody;
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

const listarContratosVigentes = async (usuarioAutenticado) => {
  const respuesta = await ejecutarControlador(contratoController.listarContratos, {
    usuario: usuarioAutenticado,
    query: {},
    params: {},
    body: {},
  });
  const contratos = Array.isArray(respuesta) ? respuesta : [];
  return contratos
    .filter((contrato) => contrato.estado === 'VIGENTE')
    .map(serializarContrato);
};

const listarReclamos = async (usuarioAutenticado) => {
  const respuesta = await ejecutarControlador(reclamoController.listarReclamos, {
    usuario: usuarioAutenticado,
    query: {},
    params: {},
    body: {},
  });
  if (!Array.isArray(respuesta?.data)) {
    throw new Error('La consulta de reclamos devolvió una respuesta inesperada.');
  }
  return respuesta.data.map(serializarReclamo);
};

const validarCampos = (accion, args) => {
  const permitidos = new Set(['accion', ...CAMPOS_POR_ACCION[accion]]);
  const invalidos = Object.keys(args).filter((campo) => !permitidos.has(campo));
  if (invalidos.length > 0) {
    throw new Error(`La herramienta recibió campos no autorizados: ${invalidos.join(', ')}.`);
  }
};

const crearReclamo = async (usuarioAutenticado, args) => {
  const { id, roles } = obtenerIdentidad(usuarioAutenticado);
  if (!id) throw new Error('Se requiere una sesión autenticada.');
  if (!esInquilino(roles)) {
    throw new Error('Solo un inquilino autenticado puede crear un reclamo.');
  }

  const {
    id_contrato,
    asunto,
    descripcion,
    categoria,
    prioridad,
  } = args;
  if (!id_contrato || !asunto || !descripcion) {
    throw new Error('id_contrato, asunto y descripcion son obligatorios para crear un reclamo.');
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
    throw new Error('El reclamo no pudo confirmarse en el servidor.');
  }

  return {
    creado: true,
    reclamo: serializarReclamo(respuesta.data),
    mensaje: respuesta.message || 'Reclamo registrado.',
  };
};

const gestionarReclamos = async (usuarioAutenticado, args = {}) => {
  const { id } = obtenerIdentidad(usuarioAutenticado);
  if (!id) throw new Error('Se requiere una sesión autenticada.');

  const accion = typeof args.accion === 'string' ? args.accion.trim().toUpperCase() : '';
  if (!ACCIONES.includes(accion)) {
    throw new Error('La acción de reclamos no es válida.');
  }
  validarCampos(accion, args);

  switch (accion) {
    case 'LISTAR_CONTRATOS': {
      const { roles } = obtenerIdentidad(usuarioAutenticado);
      if (!esInquilino(roles)) {
        throw new Error('Solo un inquilino autenticado puede consultar sus contratos vigentes.');
      }
      return listarContratosVigentes(usuarioAutenticado);
    }
    case 'LISTAR_RECLAMOS':
      return listarReclamos(usuarioAutenticado);
    case 'CLASIFICAR':
      return clasificarReclamo({ asunto: args.asunto, descripcion: args.descripcion });
    case 'CREAR':
      return crearReclamo(usuarioAutenticado, args);
    default:
      throw new Error('La acción de reclamos no es válida.');
  }
};

module.exports = {
  ACCIONES,
  CATEGORIAS_RECLAMO,
  PRIORIDADES_RECLAMO,
  clasificarReclamo,
  gestionarReclamos,
  listarContratosVigentes,
  listarReclamos,
  crearReclamo,
};
