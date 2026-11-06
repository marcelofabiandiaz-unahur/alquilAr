const pagoController = require('../controllers/pagoController');
const { obtenerIdentidad } = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');
const { ejecutarControlador } = require('../utils/controllerInvoker');
const { AiError, CODIGOS_IA } = require('../utils/aiErrors');

const ACCIONES = ['SALDOS', 'ANALIZAR_COMPROBANTE', 'RECORDATORIO_MORA'];

const CAMPOS_POR_ACCION = {
  SALDOS: ['id_agrupamiento'],
  ANALIZAR_COMPROBANTE: ['texto'],
  RECORDATORIO_MORA: ['id_agrupamiento'],
};

const MAX_TEXTO_COMPROBANTE = 5000;

const formateadorMoneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

const redondear = (valor) => Number((Number(valor) || 0).toFixed(2));

const normalizarMonto = (crudo) => {
  let valor = String(crudo || '').replace(/[^\d.,]/g, '').replace(/[.,]+$/, '');
  if (!valor) return null;

  const ultimaComa = valor.lastIndexOf(',');
  const ultimoPunto = valor.lastIndexOf('.');

  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const separadorDecimal = ultimaComa > ultimoPunto ? ',' : '.';
    const separadorMiles = separadorDecimal === ',' ? '.' : ',';
    valor = valor.split(separadorMiles).join('');
    if (separadorDecimal === ',') valor = valor.replace(',', '.');
  } else if (ultimaComa >= 0) {
    const decimales = valor.length - ultimaComa - 1;
    valor = decimales === 1 || decimales === 2
      ? valor.replace(',', '.')
      : valor.split(',').join('');
  } else if (ultimoPunto >= 0) {
    const decimales = valor.length - ultimoPunto - 1;
    if (decimales !== 1 && decimales !== 2) {
      valor = valor.split('.').join('');
    }
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? redondear(numero) : null;
};

const extraerMonto = (texto) => {
  const conSimbolo = /(?:ARS|AR\$|\$)\s*([\d][\d.,]*)/i.exec(texto);
  if (conSimbolo) return normalizarMonto(conSimbolo[1]);

  const conEtiqueta = /(?:total|importe|monto)\s*:?\s*(?:ARS|AR\$|\$)?\s*([\d][\d.,]*)/i.exec(texto);
  if (conEtiqueta) return normalizarMonto(conEtiqueta[1]);

  return null;
};

const construirFechaISO = (anio, mes, dia) => {
  const anioNumero = Number(anio) < 100 ? 2000 + Number(anio) : Number(anio);
  const mesNumero = Number(mes);
  const diaNumero = Number(dia);
  if (mesNumero < 1 || mesNumero > 12 || diaNumero < 1 || diaNumero > 31) return null;

  const fecha = new Date(Date.UTC(anioNumero, mesNumero - 1, diaNumero));
  if (
    fecha.getUTCFullYear() !== anioNumero
    || fecha.getUTCMonth() !== mesNumero - 1
    || fecha.getUTCDate() !== diaNumero
  ) {
    return null;
  }
  return fecha.toISOString().slice(0, 10);
};

const extraerFecha = (texto) => {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(texto);
  if (iso) return construirFechaISO(iso[1], iso[2], iso[3]);

  const dmy = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/.exec(texto);
  if (!dmy) return null;
  return construirFechaISO(dmy[3], dmy[2], dmy[1]);
};

const extraerDatosComprobante = (texto) => {
  const contenido = typeof texto === 'string' ? texto : '';
  const monto = extraerMonto(contenido);
  const fecha = extraerFecha(contenido);
  const camposDetectados = [monto !== null, fecha !== null].filter(Boolean).length;

  return {
    extraido: camposDetectados > 0,
    monto,
    moneda: monto !== null ? 'ARS' : null,
    fecha,
    confianza: camposDetectados === 2 ? 0.95 : camposDetectados === 1 ? 0.6 : 0,
    advertencia: camposDetectados === 2
      ? null
      : 'No se pudieron detectar todos los datos. Verificá el monto y la fecha manualmente.',
  };
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

const consultarSaldos = async (usuarioAutenticado, args = {}) => {
  const { id } = obtenerIdentidad(usuarioAutenticado);
  if (!id) {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'Se requiere una sesión autenticada.', {
      status: 401,
    });
  }

  const query = {};
  if (args.id_agrupamiento !== undefined) {
    if (!esObjectIdValido(String(args.id_agrupamiento))) {
      throw new AiError(CODIGOS_IA.VALIDACION, 'id_agrupamiento inválido.', { status: 400 });
    }
    query.id_agrupamiento = args.id_agrupamiento;
  }

  const respuesta = await ejecutarControlador(pagoController.listarPagos, {
    usuario: usuarioAutenticado,
    query,
    params: {},
    body: {},
  });

  const pagos = Array.isArray(respuesta?.data) ? respuesta.data : [];
  const ahora = new Date();

  const cuotas = pagos
    .filter((pago) => pago.estado !== 'PAGADO')
    .map((pago) => {
      const fecha = pago.fecha_vencimiento ? new Date(pago.fecha_vencimiento) : null;
      const fechaValida = fecha && !Number.isNaN(fecha.getTime());
      const atrasada = pago.estado === 'ATRASADO' || (fechaValida && fecha < ahora);
      return {
        id: String(pago._id),
        id_contrato: String(pago.id_contrato?._id || pago.id_contrato || ''),
        mes_correspondiente: pago.mes_correspondiente,
        monto: redondear(pago.monto_total),
        estado: pago.estado,
        fecha_vencimiento: fechaValida ? fecha.toISOString().slice(0, 10) : null,
        atrasada,
      };
    })
    .sort((a, b) => String(a.fecha_vencimiento || '').localeCompare(String(b.fecha_vencimiento || '')));

  const totalPendiente = redondear(cuotas.reduce((total, cuota) => total + cuota.monto, 0));
  const totalAtrasado = redondear(
    cuotas.filter((cuota) => cuota.atrasada).reduce((total, cuota) => total + cuota.monto, 0),
  );
  const proxima = cuotas.find((cuota) => cuota.fecha_vencimiento) || null;

  return {
    totalPendiente,
    totalAtrasado,
    proximoVencimiento: proxima?.fecha_vencimiento || null,
    cuotas,
    actualizadoEn: ahora.toISOString(),
  };
};

const analizarComprobante = async (usuarioAutenticado, args = {}) => {
  const { id } = obtenerIdentidad(usuarioAutenticado);
  if (!id) {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'Se requiere una sesión autenticada.', {
      status: 401,
    });
  }

  const texto = typeof args.texto === 'string' ? args.texto.trim() : '';
  if (!texto) {
    return {
      extraido: false,
      monto: null,
      moneda: null,
      fecha: null,
      confianza: 0,
      motivo: 'Pegá el texto del comprobante para poder extraer el monto y la fecha.',
    };
  }
  if (texto.length > MAX_TEXTO_COMPROBANTE) {
    throw new AiError(
      CODIGOS_IA.VALIDACION,
      `El texto del comprobante no puede superar los ${MAX_TEXTO_COMPROBANTE} caracteres.`,
      { status: 400 },
    );
  }

  return extraerDatosComprobante(texto);
};

const redactarRecordatorioMora = async (usuarioAutenticado, args = {}) => {
  const saldos = await consultarSaldos(usuarioAutenticado, args);
  const cuotasVencidas = saldos.cuotas.filter((cuota) => cuota.atrasada);

  if (cuotasVencidas.length === 0) {
    return {
      generar: false,
      mensaje: 'No registrás deudas vencidas para recordar en este momento.',
      totalAtrasado: 0,
      cuotas: [],
    };
  }

  const detalle = cuotasVencidas
    .map((cuota) => `- ${cuota.mes_correspondiente}: ${formateadorMoneda.format(cuota.monto)} (venció el ${cuota.fecha_vencimiento || 'sin fecha'})`)
    .join('\n');

  const texto = [
    'Hola. Te recordamos que registrás un saldo pendiente:',
    detalle,
    '',
    `Total vencido: ${formateadorMoneda.format(saldos.totalAtrasado)}.`,
    'Por favor, regularizá tu situación o comunicate con la administración si ya realizaste el pago.',
  ].join('\n');

  return {
    generar: true,
    texto,
    totalAtrasado: saldos.totalAtrasado,
    cuotas: cuotasVencidas,
    advertencia: 'Este texto es un borrador. El asistente no envía mensajes ni notificaciones.',
  };
};

const gestionarFinanzas = async (usuarioAutenticado, args = {}) => {
  const { id } = obtenerIdentidad(usuarioAutenticado);
  if (!id) {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'Se requiere una sesión autenticada.', {
      status: 401,
    });
  }

  const accion = typeof args.accion === 'string' ? args.accion.trim().toUpperCase() : '';
  if (!ACCIONES.includes(accion)) {
    throw new AiError(CODIGOS_IA.VALIDACION, 'La acción de finanzas no es válida.', {
      status: 400,
    });
  }
  validarCampos(accion, args);

  switch (accion) {
    case 'SALDOS':
      return consultarSaldos(usuarioAutenticado, args);
    case 'ANALIZAR_COMPROBANTE':
      return analizarComprobante(usuarioAutenticado, args);
    case 'RECORDATORIO_MORA':
      return redactarRecordatorioMora(usuarioAutenticado, args);
    default:
      throw new AiError(CODIGOS_IA.VALIDACION, 'La acción de finanzas no es válida.', {
        status: 400,
      });
  }
};

module.exports = {
  ACCIONES,
  CAMPOS_POR_ACCION,
  gestionarFinanzas,
  consultarSaldos,
  analizarComprobante,
  redactarRecordatorioMora,
  extraerDatosComprobante,
};
