export const CATEGORIAS_RECLAMO = [
  'PLOMERIA',
  'ELECTRICIDAD',
  'GAS',
  'ESTRUCTURAL',
  'MANTENIMIENTO',
  'SERVICIOS',
  'SEGURIDAD',
  'OTRO',
] as const;

export const PRIORIDADES_RECLAMO = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'] as const;

export type CategoriaReclamo = (typeof CATEGORIAS_RECLAMO)[number];
export type PrioridadReclamo = (typeof PRIORIDADES_RECLAMO)[number];
