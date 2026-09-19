const ESTADO_STYLES = {
  DISPONIBLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BORRADOR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ALQUILADA: 'bg-sky-50 text-sky-700 border-sky-200',
  VIGENTE: 'bg-sky-50 text-sky-700 border-sky-200',
  EN_MANTENIMIENTO: 'bg-amber-50 text-amber-700 border-amber-200',
  INACTIVA: 'bg-slate-100 text-slate-600 border-slate-200',
  FINALIZADO: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELADO: 'bg-red-50 text-red-700 border-red-200',
};

export function getEstadoClass(estado) {
  return ESTADO_STYLES[estado] || ESTADO_STYLES.INACTIVA;
}

export function formatMoneda(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor);
}
