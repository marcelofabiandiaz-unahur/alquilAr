import type { Pago } from '../types';

export function claveMesDesdeFecha(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function claveMesActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

export function fechaLocal(iso?: string): Date | null {
  if (!iso) return null;
  const soloFecha = iso.slice(0, 10);
  const resultado = /^\d{4}-\d{2}-\d{2}$/.test(soloFecha)
    ? new Date(`${soloFecha}T12:00:00`)
    : new Date(iso);
  return Number.isNaN(resultado.getTime()) ? null : resultado;
}

export function cuotasPendientesEsteMes(pagos: Pago[], fechaReferencia = new Date()): Pago[] {
  const hoy = new Date(fechaReferencia);
  hoy.setHours(0, 0, 0, 0);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  finMes.setHours(23, 59, 59, 999);

  return pagos.filter((pago) => {
    const fecha = fechaLocal(pago.fecha_vencimiento);
    return pago.estado === 'PENDIENTE' && fecha && fecha >= hoy && fecha <= finMes;
  });
}

export function proximasCuotasPendientes(pagos: Pago[], fechaReferencia = new Date()): Pago[] {
  const hoy = new Date(fechaReferencia);
  hoy.setHours(0, 0, 0, 0);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  finMes.setHours(23, 59, 59, 999);
  const porContrato = new Map<string, Pago>();

  pagos.forEach((pago) => {
    if (pago.estado !== 'PENDIENTE' || !pago.id_contrato || typeof pago.id_contrato === 'string') return;
    if (pago.id_contrato.estado !== 'VIGENTE') return;
    const fecha = fechaLocal(pago.fecha_vencimiento);
    if (!fecha || fecha <= finMes) return;

    const contratoId = pago.id_contrato._id;
    const pagoActual = porContrato.get(contratoId);
    const fechaActual = pagoActual ? fechaLocal(pagoActual.fecha_vencimiento) : null;
    if (!fechaActual || fecha < fechaActual) porContrato.set(contratoId, pago);
  });

  return [...porContrato.values()].sort((a, b) =>
    (fechaLocal(a.fecha_vencimiento)?.getTime() ?? Number.MAX_SAFE_INTEGER)
    - (fechaLocal(b.fecha_vencimiento)?.getTime() ?? Number.MAX_SAFE_INTEGER));
}

export function claveMesAnterior(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function claveMesDePago(pago: Pago): string | null {
  if (pago.mes_correspondiente !== 'DEPOSITO' && /^\d{6}$/.test(pago.mes_correspondiente)) {
    return pago.mes_correspondiente;
  }
  if (pago.fecha_pago) return claveMesDesdeFecha(pago.fecha_pago);
  if (pago.fecha_vencimiento) return claveMesDesdeFecha(pago.fecha_vencimiento);
  return null;
}

export function ingresoCobradoEnMes(pagos: Pago[], claveMes: string): number {
  return pagos
    .filter((p) => p.estado === 'PAGADO')
    .reduce((total, pago) => {
      const clave = claveMesDePago(pago);
      return clave === claveMes ? total + pago.monto_total : total;
    }, 0);
}

export function pagosCobradosEsteMes(pagos: Pago[], fechaReferencia = new Date()): Pago[] {
  const anio = fechaReferencia.getFullYear();
  const mes = fechaReferencia.getMonth();
  return pagos.filter((pago) => {
    if (pago.estado !== 'PAGADO' || !pago.fecha_pago) return false;
    const fechaPago = new Date(pago.fecha_pago);
    return !Number.isNaN(fechaPago.getTime())
      && fechaPago.getFullYear() === anio
      && fechaPago.getMonth() === mes;
  });
}

export function cobradoEnMesPorFechaPago(pagos: Pago[], fechaReferencia = new Date()): number {
  return pagosCobradosEsteMes(pagos, fechaReferencia)
    .reduce((total, pago) => total + pago.monto_total, 0);
}

export function formatearTendenciaPct(actual: number, anterior: number): string | undefined {
  if (actual === 0 && anterior === 0) return undefined;
  if (anterior === 0) return '↗ —';
  const pct = ((actual - anterior) / anterior) * 100;
  const flecha = pct >= 0 ? '↗' : '↘';
  const signo = pct > 0 ? '+' : '';
  return `${flecha} ${signo}${pct.toFixed(1)}%`;
}
