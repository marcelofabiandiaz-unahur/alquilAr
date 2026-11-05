import type { Agrupamiento } from '../types';

export const AGRUPAMIENTOS_ACTUALIZAR_EVENTO = 'alquilar:agrupamientos-actualizar';

export function notificarAgrupamientosActualizados() {
  window.dispatchEvent(new Event(AGRUPAMIENTOS_ACTUALIZAR_EVENTO));
}

export function obtenerIdAgrupamiento(
  valor: string | { _id?: string } | null | undefined,
): string {
  if (!valor) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'object' && '_id' in valor) return String(valor._id || '');
  return '';
}

export function conAgrupamiento(ruta: string, idAgrupamiento?: string | null): string {
  if (!idAgrupamiento) return ruta;
  const [base, query = ''] = ruta.split('?');
  const params = new URLSearchParams(query);
  params.set('id_agrupamiento', idAgrupamiento);
  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
}

export function direccionAgrupamiento(agrupamiento: Agrupamiento): string {
  const { calle, numero, ciudad, provincia } = agrupamiento.direccion || {
    calle: '',
    numero: '',
    ciudad: '',
    provincia: '',
  };
  return [calle && numero ? `${calle} ${numero}` : calle, ciudad, provincia]
    .filter(Boolean)
    .join(', ');
}

export function nombreReferencia(
  referencia: string | { nombre?: string; apellido?: string; email?: string } | undefined,
): string {
  if (!referencia) return '—';
  if (typeof referencia === 'string') return referencia;
  const nombre = `${referencia.nombre || ''} ${referencia.apellido || ''}`.trim();
  return nombre || referencia.email || '—';
}
