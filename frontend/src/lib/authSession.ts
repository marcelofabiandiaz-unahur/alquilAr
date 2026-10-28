import type { AuthUsuario, Role } from '../types';

const ROLES_VALIDOS: Role[] = ['USUARIO', 'INQUILINO', 'PROPIETARIO', 'ADMINISTRADOR'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function mapearPerfilAAuthUsuario(perfil: unknown): AuthUsuario | null {
  if (!isRecord(perfil)) return null;

  const nombre = typeof perfil.nombre === 'string' ? perfil.nombre : '';
  const apellido = typeof perfil.apellido === 'string' ? perfil.apellido : '';
  const email = typeof perfil.email === 'string' ? perfil.email : '';
  const roles = Array.isArray(perfil.roles)
    ? perfil.roles.filter((rol): rol is Role => (
      typeof rol === 'string' && ROLES_VALIDOS.some((rolValido) => rolValido === rol)
    ))
    : [];

  if (!nombre || !email || roles.length === 0) return null;

  const _id = perfil._id != null ? String(perfil._id) : undefined;

  return { _id, nombre, apellido, email, roles };
}
