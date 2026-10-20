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

export function formatearTendenciaPct(actual: number, anterior: number): string | undefined {
  if (actual === 0 && anterior === 0) return undefined;
  if (anterior === 0) return '↗ —';
  const pct = ((actual - anterior) / anterior) * 100;
  const flecha = pct >= 0 ? '↗' : '↘';
  const signo = pct > 0 ? '+' : '';
  return `${flecha} ${signo}${pct.toFixed(1)}%`;
}
