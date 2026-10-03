import type { Contrato, Gasto, Pago, Propiedad, Reclamo, ResumenDashboard } from '../types';

const PROPIEDADES_DISPONIBLES: Propiedad[] = [
  {
    _id: 'mock-propiedad-1',
    direccion: 'Av. Rivadavia 2450, CABA',
    tipo: 'Departamento',
    ambientes: 2,
    valor_base: 385000,
    estado: 'DISPONIBLE',
    descripcion: 'Departamento luminoso, cercano a subte y comercios.',
    fotos: [],
  },
  {
    _id: 'mock-propiedad-2',
    direccion: 'Belgrano 820, Ramos Mejía',
    tipo: 'PH',
    ambientes: 3,
    valor_base: 470000,
    estado: 'DISPONIBLE',
    descripcion: 'PH con patio y espacio para escritorio.',
    fotos: [],
  },
  {
    _id: 'mock-propiedad-3',
    direccion: 'Mitre 115, Morón',
    tipo: 'Casa',
    ambientes: 4,
    valor_base: 620000,
    estado: 'DISPONIBLE',
    descripcion: 'Casa familiar con terraza y cochera.',
    fotos: [],
  },
];

const GASTOS_INICIALES: Gasto[] = [
  {
    _id: 'mock-gasto-1',
    id_propiedad: PROPIEDADES_DISPONIBLES[0],
    fecha_emision: '2026-09-08',
    monto_total: 58400,
    tipo: 'EXPENSAS',
    estado_pago: 'PENDIENTE',
    proveedor: 'Administración Rivadavia',
    comprobantes: [],
  },
  {
    _id: 'mock-gasto-2',
    id_propiedad: PROPIEDADES_DISPONIBLES[1],
    fecha_emision: '2026-09-05',
    monto_total: 26700,
    tipo: 'MANTENIMIENTO',
    estado_pago: 'PAGADO',
    proveedor: 'Servicios del Oeste',
    comprobantes: [],
  },
  {
    _id: 'mock-gasto-3',
    id_propiedad: PROPIEDADES_DISPONIBLES[2],
    fecha_emision: '2026-08-28',
    monto_total: 41200,
    tipo: 'SERVICIO',
    estado_pago: 'ATRASADO',
    proveedor: 'Aguas Bonaerenses',
    comprobantes: [],
  },
];

const PAGOS_INICIALES: Pick<Pago, '_id' | 'estado' | 'monto_total'>[] = [
  { _id: 'mock-pago-1', estado: 'PAGADO', monto_total: 385000 },
  { _id: 'mock-pago-2', estado: 'PENDIENTE', monto_total: 470000 },
  { _id: 'mock-pago-3', estado: 'ATRASADO', monto_total: 310000 },
];

const RECLAMOS_INICIALES: Pick<Reclamo, '_id' | 'estado'>[] = [
  { _id: 'mock-reclamo-1', estado: 'PENDIENTE' },
  { _id: 'mock-reclamo-2', estado: 'EN_PROCESO' },
  { _id: 'mock-reclamo-3', estado: 'RESUELTO' },
];

const CONTRATOS_INICIALES: Contrato[] = [
  {
    _id: 'mock-contrato-1',
    id_propiedad: PROPIEDADES_DISPONIBLES[0],
    id_inquilino: { nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com' },
    fecha_inicio: '2026-02-01',
    fecha_fin: '2027-01-31',
    monto_mensual: 385000,
    dia_vencimiento: 10,
    estado: 'VIGENTE',
  },
  {
    _id: 'mock-contrato-2',
    id_propiedad: PROPIEDADES_DISPONIBLES[1],
    id_inquilino: { nombre: 'Luis', apellido: 'Gómez', email: 'luis@example.com' },
    fecha_inicio: '2025-04-15',
    fecha_fin: '2026-04-14',
    monto_mensual: 320000,
    dia_vencimiento: 5,
    estado: 'FINALIZADO',
  },
];

const resolver = <T,>(data: T): Promise<T> => Promise.resolve(data);

export function obtenerGastosMock(): Promise<Gasto[]> {
  return resolver(GASTOS_INICIALES.map((gasto) => ({ ...gasto })));
}

export function obtenerPropiedadesDisponiblesMock(): Promise<Propiedad[]> {
  return resolver(PROPIEDADES_DISPONIBLES.map((propiedad) => ({ ...propiedad })));
}

export function obtenerHistorialMock(): Promise<Contrato[]> {
  return resolver(CONTRATOS_INICIALES.map((contrato) => ({ ...contrato })));
}

export function obtenerResumenMock(): Promise<Omit<ResumenDashboard, 'contratos'>> {
  const aCobrar = PAGOS_INICIALES
    .filter((pago) => pago.estado !== 'PAGADO')
    .reduce((total, pago) => total + pago.monto_total, 0);
  const cobrado = PAGOS_INICIALES
    .filter((pago) => pago.estado === 'PAGADO')
    .reduce((total, pago) => total + pago.monto_total, 0);
  const atrasados = PAGOS_INICIALES.filter((pago) => pago.estado === 'ATRASADO').length;
  const reclamosAbiertos = RECLAMOS_INICIALES.filter((reclamo) => reclamo.estado !== 'RESUELTO').length;

  return resolver({
    aCobrar,
    cobrado,
    atrasados,
    reclamosAbiertos,
    contratosPorVencer: 1,
    propiedadesDisponibles: PROPIEDADES_DISPONIBLES.length,
  });
}