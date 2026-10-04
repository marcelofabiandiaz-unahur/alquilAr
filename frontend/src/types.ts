import type { Dispatch, SetStateAction } from 'react';

export type Role = 'USUARIO' | 'INQUILINO' | 'PROPIETARIO' | 'ADMINISTRADOR';

export interface Usuario {
  _id: string;
  nombre: string;
  apellido: string;
  email: string;
  roles: Role[];
  dni?: string;
  cbu_alias?: string;
  cuit_cuil?: string;
  solicitud_propietario?: {
    cbu_alias: string;
    cuit_cuil: string;
    estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
    solicitada_en?: string;
  };
}

export interface UsuarioReferencia {
  _id?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  dni?: string;
  roles?: Role[];
}

export interface PropiedadReferencia {
  _id: string;
  direccion?: string;
  tipo?: string;
  ambientes?: number;
  estado?: string;
  id_propietario?: string | Usuario | {
    cbu_alias?: string;
    cuit_cuil?: string;
  };
}

export interface AuthUsuario {
  _id?: string;
  nombre: string;
  apellido: string;
  email: string;
  roles: Role[];
}

export interface Propiedad {
  _id: string;
  id_propietario?: string | Usuario;
  direccion: string;
  tipo: string;
  ambientes: number;
  descripcion?: string;
  estado: string;
  valor_base: number;
  fotos: string[];
}

export interface Garante {
  nombre?: string;
  telefono?: string;
  recibo?: string;
}

export interface Contrato {
  _id: string;
  id_propiedad: string | PropiedadReferencia;
  id_inquilino: string | UsuarioReferencia;
  fecha_inicio: string;
  fecha_fin?: string;
  monto_mensual: number;
  dia_vencimiento: number;
  estado: string;
  garante?: Garante;
}

export interface Pago {
  _id: string;
  id_contrato: string | Contrato;
  mes_correspondiente: string;
  monto_total: number;
  fecha_vencimiento: string;
  fecha_pago?: string;
  estado: string;
  comprobante_url?: string;
  comprobantes?: string[];
}

export interface Gasto {
  _id: string;
  id_propiedad: string | PropiedadReferencia;
  fecha_emision: string;
  monto_total: number;
  tipo: string;
  estado_pago: string;
  proveedor?: string;
  comprobantes: string[];
}

export interface Reclamo {
  _id: string;
  id_contrato: string | Contrato;
  id_propiedad: string | PropiedadReferencia;
  id_inquilino: string | UsuarioReferencia;
  asunto: string;
  descripcion: string;
  prioridad: string;
  categoria: string;
  estado: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface AuthContextValue {
  usuario: AuthUsuario | null;
  token: string | null;
  cargando: boolean;
  loginGlobal: (usuario: AuthUsuario, token: string) => void;
  logoutGlobal: () => void;
}

export interface RolesDashboard {
  esUsuarioBase: boolean;
  esInquilino: boolean;
  esPropietario: boolean;
  esAdministrador: boolean;
}

export interface ResumenDashboard {
  aCobrar: number;
  cobrado: number;
  cobrosParaValidar: number;
  atrasados: number;
  reclamosAbiertos: number;
  contratosPorVencer: number;
  propiedadesDisponibles: number;
  propiedadesAlquiladas: number;
  contratos: number;
}

export interface ContratoForm {
  id_propiedad: string;
  email_inquilino: string;
  fecha_inicio: string;
  fecha_fin?: string;
  monto_mensual: number;
  dia_vencimiento: number;
  estado: string;
  garante: Garante;
}

export interface DashboardProps {
  usuario: AuthUsuario;
  token: string;
  roles: RolesDashboard;
  setSeccionActiva: Dispatch<SetStateAction<string>>;
}
