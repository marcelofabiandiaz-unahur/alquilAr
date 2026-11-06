const aiAgrupamientoService = require('./aiAgrupamientoService');
const aiFinanzasService = require('./aiFinanzasService');
const { obtenerIdentidad, esInquilino } = require('../utils/operacionHelpers');
const { AiError, CODIGOS_IA } = require('../utils/aiErrors');

const INTENCIONES = Object.freeze({
  RESUMEN_EDIFICIO: 'RESUMEN_EDIFICIO',
  MIS_SALDOS: 'MIS_SALDOS',
});

const MAX_CUOTAS_DETALLE = 8;

const formateadorMoneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
});

const formatearMoneda = (valor) => formateadorMoneda.format(Number(valor) || 0);

const formatearFecha = (valor) => {
  if (!valor) return 'sin fecha';
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (coincidencia) return `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}`;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'sin fecha';
  return fecha.toLocaleDateString('es-AR', { timeZone: 'UTC' });
};

const formatearMes = (valor) => {
  const texto = String(valor || '').trim();
  if (!texto) return 'sin período';
  if (texto.toUpperCase() === 'DEPOSITO') return 'Depósito';
  const coincidencia = /^(\d{4})(\d{2})$/.exec(texto);
  if (coincidencia) return `${coincidencia[2]}/${coincidencia[1]}`;
  return texto;
};

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const formatearPeriodo = (valor) => {
  const coincidencia = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(valor || '').trim());
  if (!coincidencia) return 'el período actual';
  return `${MESES[Number(coincidencia[2]) - 1]} de ${coincidencia[1]}`;
};

const contextoDeAlcance = (resumen) => {
  if (resumen?.agrupamiento?.nombre) return `En el edificio ${resumen.agrupamiento.nombre}`;
  if (resumen?.alcance === 'GLOBAL') return 'En toda la plataforma';
  return 'En tus contratos';
};

const describirEstadoCuota = (cuota) => {
  if (cuota?.atrasada) return 'atrasada';
  const estado = String(cuota?.estado || '').trim().toLowerCase();
  return estado || 'pendiente';
};

const construirResumenEdificio = async (usuario, opciones = {}) => {
  const argumentos = {};
  if (opciones.id_agrupamiento) argumentos.id_agrupamiento = opciones.id_agrupamiento;
  if (opciones.periodo) argumentos.periodo = opciones.periodo;

  const resumen = await aiAgrupamientoService.consultarResumenAgrupamiento(usuario, argumentos);
  const periodo = formatearPeriodo(resumen?.periodo || opciones.periodo);
  const contexto = contextoDeAlcance(resumen);

  const sinMovimientos = !resumen?.agrupamiento
    && !Number(resumen?.totalEstimadoMes)
    && !Number(resumen?.totalCobradoMes)
    && !Number(resumen?.totalPendienteMes)
    && !Number(resumen?.reclamosAbiertos)
    && !Number(resumen?.reclamosUrgentes)
    && !resumen?.advertencia;

  if (sinMovimientos) {
    return `${contexto}, para ${periodo} no hay movimientos registrados. `
      + 'Si esperabas ver datos, revisá el período o consultá con la administración.';
  }

  const oraciones = [];
  oraciones.push(
    `${contexto}, para ${periodo} el total estimado es de `
    + `${formatearMoneda(resumen?.totalEstimadoMes)}.`,
  );
  oraciones.push(
    `Se cobraron ${formatearMoneda(resumen?.totalCobradoMes)} y quedan `
    + `${formatearMoneda(resumen?.totalPendienteMes)} pendientes.`,
  );

  const abiertos = Number(resumen?.reclamosAbiertos) || 0;
  const urgentes = typeof resumen?.reclamosUrgentes === 'number' ? resumen.reclamosUrgentes : null;
  if (abiertos === 0) {
    oraciones.push('No hay reclamos abiertos en este momento.');
  } else if (urgentes === null) {
    oraciones.push(`Hay ${abiertos} ${abiertos === 1 ? 'reclamo abierto' : 'reclamos abiertos'}.`);
  } else if (urgentes === 0) {
    oraciones.push(
      `Hay ${abiertos} ${abiertos === 1 ? 'reclamo abierto' : 'reclamos abiertos'}, `
      + 'ninguno urgente ni de prioridad alta.',
    );
  } else {
    oraciones.push(
      `Hay ${abiertos} ${abiertos === 1 ? 'reclamo abierto' : 'reclamos abiertos'}, `
      + `${urgentes} ${urgentes === 1 ? 'de ellos es urgente o de prioridad alta' : 'de ellos son urgentes o de prioridad alta'}.`,
    );
  }

  if (resumen?.advertencia) oraciones.push(resumen.advertencia);

  if (resumen?.agrupamiento) {
    const alquiladas = Number(resumen.unidadesAlquiladas) || 0;
    const totales = Number(resumen.unidadesTotales) || 0;
    const ocupacion = Number(resumen.tasaOcupacion) || 0;
    oraciones.push(
      `De ${totales} unidades, ${alquiladas} ${alquiladas === 1 ? 'está alquilada' : 'están alquiladas'}, `
      + `con una ocupación del ${ocupacion} %.`,
    );
  }

  oraciones.push('Solo incluyo la información que podés ver con tu rol.');
  return oraciones.join(' ');
};

const construirMisSaldos = async (usuario, opciones = {}) => {
  const argumentos = {};
  if (opciones.id_agrupamiento) argumentos.id_agrupamiento = opciones.id_agrupamiento;

  const saldos = await aiFinanzasService.consultarSaldos(usuario, argumentos);
  const { roles } = obtenerIdentidad(usuario);
  const inquilino = esInquilino(roles);

  const cuotas = Array.isArray(saldos?.cuotas) ? saldos.cuotas : [];
  if (cuotas.length === 0) {
    return inquilino
      ? 'No tenés pagos pendientes registrados en este momento. '
        + 'Si hiciste un pago hace poco, puede tardar un rato en reflejarse.'
      : 'No hay pagos pendientes en tus contratos en este momento.';
  }

  const totalPendiente = formatearMoneda(saldos?.totalPendiente);
  const totalAtrasado = formatearMoneda(saldos?.totalAtrasado);

  const oraciones = [];
  oraciones.push(inquilino
    ? `Tenés un total pendiente de ${totalPendiente}.`
    : `En tus contratos hay un total pendiente de ${totalPendiente}.`);

  if (Number(saldos?.totalAtrasado) > 0) {
    oraciones.push(
      `De ese total, ${totalAtrasado} `
      + `${Number(saldos.totalAtrasado) === Number(saldos.totalPendiente) ? 'está atrasado' : 'están atrasados'}.`,
    );
  } else {
    oraciones.push('No hay montos atrasados.');
  }

  if (saldos?.proximoVencimiento) {
    oraciones.push(`El próximo vencimiento es el ${formatearFecha(saldos.proximoVencimiento)}.`);
  }

  const visibles = cuotas.slice(0, MAX_CUOTAS_DETALLE);
  const detalle = visibles.map((cuota) => (
    `La cuota de ${formatearMes(cuota.mes_correspondiente)} es de ${formatearMoneda(cuota.monto)}, `
    + `vence el ${formatearFecha(cuota.fecha_vencimiento)} y figura como ${describirEstadoCuota(cuota)}.`
  )).join(' ');
  if (detalle) oraciones.push(detalle);

  if (cuotas.length > visibles.length) {
    oraciones.push(
      `Además, hay ${cuotas.length - visibles.length} cuotas más que no detallo `
      + 'para no hacer la respuesta demasiado larga.',
    );
  }

  oraciones.push('Si ya hiciste el pago, avisale a la administración para que lo registren.');
  return oraciones.join(' ');
};

const ejecutarIntencion = async (intencion, usuario, opciones = {}) => {
  const { id } = obtenerIdentidad(usuario);
  if (!id) {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'Necesitás iniciar sesión para usar el asistente.', {
      status: 401,
      detalleTecnico: 'intención sin identidad autenticada',
    });
  }

  switch (intencion) {
    case INTENCIONES.RESUMEN_EDIFICIO:
      return { role: 'assistant', content: await construirResumenEdificio(usuario, opciones) };
    case INTENCIONES.MIS_SALDOS:
      return { role: 'assistant', content: await construirMisSaldos(usuario, opciones) };
    default:
      throw new AiError(CODIGOS_IA.VALIDACION, 'La consulta predefinida no es válida.', {
        status: 400,
        detalleTecnico: `intención desconocida: ${intencion}`,
      });
  }
};

module.exports = {
  INTENCIONES,
  MAX_CUOTAS_DETALLE,
  ejecutarIntencion,
  construirResumenEdificio,
  construirMisSaldos,
  formatearFecha,
  formatearMoneda,
};
