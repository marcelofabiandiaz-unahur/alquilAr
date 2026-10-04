import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import logoAlquilar from '../../assets/logo-alquilar.jpg';
import { apiGet } from '../../lib/apiClient';
import type { AuthUsuario, Pago, RolesDashboard, Usuario } from '../../types';
import SolicitudPropietario from './SolicitudPropietario';

interface Notificacion {
  id: string;
  titulo: string;
  detalle: string;
  seccion?: string;
  volverAIniciarSesion?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  show?: (roles: RolesDashboard) => boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'General',
    items: [{ id: 'inicio', label: 'Inicio' }],
  },
  {
    label: 'Operación',
    items: [
      { id: 'buscar', label: 'Buscar alquileres', show: (r) => r.esUsuarioBase },
      { id: 'propiedades', label: 'Mis propiedades', show: (r) => r.esPropietario },
      { id: 'contratos', label: 'Contratos', show: (r) => r.esInquilino || r.esPropietario },
      { id: 'pagos', label: 'Pagos', show: (r) => r.esInquilino },
      { id: 'cobros', label: 'Cobros', show: (r) => r.esPropietario || r.esAdministrador },
      { id: 'gastos', label: 'Gastos', show: (r) => r.esPropietario || r.esAdministrador },
      { id: 'reclamos', label: 'Reclamos', show: (r) => r.esInquilino || r.esPropietario || r.esAdministrador },
      { id: 'historial', label: 'Historial', show: (r) => r.esInquilino || r.esPropietario },
    ],
  },
  {
    label: 'Administración',
    items: [
      { id: 'usuarios', label: 'Usuarios', show: (r) => r.esAdministrador },
      { id: 'configuracion', label: 'Configuración', show: (r) => r.esAdministrador },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      {
        id: 'asistente',
        label: 'Asistente IA',
        show: (r) => r.esInquilino || r.esPropietario || r.esAdministrador,
      },
    ],
  },
];

function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M2.5 4.5h11v7h-11v-7z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 5.5L8 9l5.5-3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M6 2.5H4.5a1 1 0 00-1 1V12.5a1 1 0 001 1H6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M10.5 11l2.5-3-2.5-3M13 8H6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavButton({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-emerald-50 text-[#14213D] font-semibold border border-emerald-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}

interface DashboardLayoutProps {
  usuario: AuthUsuario;
  logoutGlobal: () => void;
  seccionActiva: string;
  setSeccionActiva: (id: string) => void;
  roles: RolesDashboard;
  token: string;
  children: ReactNode;
}

export default function DashboardLayout({
  usuario,
  logoutGlobal,
  seccionActiva,
  setSeccionActiva,
  roles,
  token,
  children,
}: DashboardLayoutProps) {
  const [usuarioExpandido, setUsuarioExpandido] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const [errorNotificaciones, setErrorNotificaciones] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const notificacionesRef = useRef<HTMLDivElement>(null);
  const iniciales = `${usuario.nombre[0]}${usuario.apellido[0]}`.toUpperCase();

  useEffect(() => {
    let activa = true;
    const cargarNotificaciones = async () => {
      const nuevas: Notificacion[] = [];
      const errores: string[] = [];

      if (roles.esAdministrador) {
        try {
          const usuarios = await apiGet<Usuario[]>('/api/usuarios', token);
          if (!Array.isArray(usuarios)) throw new Error('Respuesta inválida del servidor.');
          nuevas.push(...usuarios
            .filter((usr) => usr.solicitud_propietario?.estado === 'PENDIENTE')
            .map((usr) => ({
              id: `solicitud-${usr._id}`,
              titulo: 'Solicitud para publicar propiedad',
              detalle: `${usr.nombre} ${usr.apellido} · ${usr.email}`,
              seccion: 'usuarios',
            })));
        } catch (error) {
          errores.push(error instanceof Error ? error.message : 'No se pudieron consultar las solicitudes.');
        }
      }

      if (!roles.esAdministrador && (roles.esUsuarioBase || roles.esInquilino)) {
        try {
          const respuesta = await apiGet<{ solicitud: Usuario['solicitud_propietario'] | null }>(
            '/api/usuarios/solicitud-propietario',
            token,
          );
          if (respuesta.solicitud?.estado === 'APROBADA') {
            nuevas.push({
              id: 'solicitud-propietario-aprobada',
              titulo: 'Solicitud de propietario aprobada',
              detalle: 'Volvé a iniciar sesión para activar tu nuevo rol.',
              volverAIniciarSesion: true,
            });
          }
        } catch (error) {
          errores.push(error instanceof Error ? error.message : 'No se pudo consultar tu solicitud de propietario.');
        }
      }

      if (roles.esInquilino) {
        try {
          const pagos = await apiGet<Pago[]>('/api/pagos', token);
          if (!Array.isArray(pagos)) throw new Error('Respuesta inválida al consultar los pagos.');
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const finSemana = new Date(hoy);
          finSemana.setDate(finSemana.getDate() + 7);

          nuevas.push(...pagos.flatMap((pago) => {
            if (!['PENDIENTE', 'ATRASADO'].includes(pago.estado)) return [];
            const vencimiento = new Date(pago.fecha_vencimiento);
            if (Number.isNaN(vencimiento.getTime())) return [];
            vencimiento.setHours(0, 0, 0, 0);
            const fechaVisible = vencimiento.toLocaleDateString();
            const periodo = pago.mes_correspondiente === 'DEPOSITO'
              ? 'Depósito'
              : `Alquiler ${pago.mes_correspondiente}`;

            if (pago.estado === 'ATRASADO' || vencimiento < hoy) {
              return [{
                id: `pago-vencido-${pago._id}`,
                titulo: 'Tenés un pago vencido',
                detalle: `${periodo} · venció el ${fechaVisible}`,
                seccion: 'pagos',
              }];
            }
            if (vencimiento >= hoy && vencimiento <= finSemana) {
              return [{
                id: `pago-proximo-${pago._id}`,
                titulo: 'Pago próximo a vencer',
                detalle: `${periodo} · vence el ${fechaVisible}`,
                seccion: 'pagos',
              }];
            }
            return [];
          }));
        } catch (error) {
          errores.push(error instanceof Error ? error.message : 'No se pudieron consultar los pagos.');
        }
      }

      if (activa) {
        setNotificaciones(nuevas);
        setErrorNotificaciones(errores.join(' '));
      }
    };

    const actualizarNotificaciones = () => {
      void cargarNotificaciones();
    };

    window.addEventListener('alquilar:notificaciones-actualizar', actualizarNotificaciones);
    void cargarNotificaciones();
    const intervalo = window.setInterval(() => void cargarNotificaciones(), 60_000);
    return () => {
      activa = false;
      window.clearInterval(intervalo);
      window.removeEventListener('alquilar:notificaciones-actualizar', actualizarNotificaciones);
    };
  }, [roles.esAdministrador, roles.esInquilino, roles.esUsuarioBase, token]);

  useEffect(() => {
    if (!notificacionesAbiertas) return undefined;
    const cerrarSiClickFuera = (event: globalThis.MouseEvent) => {
      if (notificacionesRef.current && event.target instanceof Node && !notificacionesRef.current.contains(event.target)) {
        setNotificacionesAbiertas(false);
      }
    };
    const cerrarConEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setNotificacionesAbiertas(false);
    };
    document.addEventListener('mousedown', cerrarSiClickFuera);
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarSiClickFuera);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [notificacionesAbiertas]);

  useEffect(() => {
    if (!usuarioExpandido) return;

    const cerrarSiClickFuera = (event: globalThis.MouseEvent) => {
      if (panelRef.current && event.target instanceof Node && !panelRef.current.contains(event.target)) {
        setUsuarioExpandido(false);
      }
    };

    const cerrarConEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setUsuarioExpandido(false);
    };

    document.addEventListener('mousedown', cerrarSiClickFuera);
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarSiClickFuera);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [usuarioExpandido]);

  const manejarLogout = () => {
    setUsuarioExpandido(false);
    logoutGlobal();
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="inline-block bg-white px-2 py-1.5 rounded-lg border border-slate-100 shadow-sm">
            <img src={logoAlquilar} alt="AlquilAR" className="block h-9 object-contain" />
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">Gestión de alquileres</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.show || item.show(roles));
            if (items.length === 0) return null;

            return (
              <div key={group.label}>
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavButton
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      active={seccionActiva === item.id}
                      onClick={setSeccionActiva}
                    />
                  ))}
                </div>
                {group.label === 'Operación'
                  && (roles.esUsuarioBase || roles.esInquilino)
                  && !roles.esPropietario
                  && !roles.esAdministrador
                  && <SolicitudPropietario token={token} />}
              </div>
            );
          })}
        </nav>

        <div ref={panelRef} className="relative p-4 border-t border-slate-100">
          <div
            role="menu"
            aria-hidden={!usuarioExpandido}
            className={`absolute bottom-full left-4 right-4 mb-2 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 transition-all duration-200 origin-bottom z-10 ${
              usuarioExpandido
                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                : 'opacity-0 translate-y-1 scale-[0.98] pointer-events-none'
            }`}
          >
            <div className="px-3 py-3 space-y-1">
              {usuario.email && (
                <div className="flex items-start gap-2.5 px-1 py-2">
                  <MailIcon className="text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Email
                    </p>
                    <p className="text-xs text-slate-700 truncate" title={usuario.email}>
                      {usuario.email}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={manejarLogout}
                  className="w-full flex items-center gap-2.5 px-1 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogoutIcon className="shrink-0" />
                  Cerrar sesión
                </button>
              </div>
            </div>

            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white border-r border-b border-slate-200"
              aria-hidden
            />
          </div>

          <button
            type="button"
            onClick={() => setUsuarioExpandido((prev) => !prev)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border bg-slate-50 hover:bg-slate-100/80 transition-all duration-200 text-left ${
              usuarioExpandido
                ? 'border-emerald-200 ring-1 ring-emerald-100 shadow-sm'
                : 'border-slate-100'
            }`}
            aria-expanded={usuarioExpandido}
            aria-haspopup="menu"
          >
            <div className="w-10 h-10 rounded-full bg-[#14213D] flex items-center justify-center text-xs font-bold text-emerald-300 shrink-0">
              {iniciales}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-[#14213D]">
                {usuario.nombre} {usuario.apellido}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">
                {usuario.roles.join(' · ')}
              </p>
            </div>
            <ChevronIcon
              className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                usuarioExpandido ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-[#14213D] text-white flex items-center justify-between px-6 shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wide">AlquilAR</span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden sm:inline text-xs text-slate-300">Plataforma de gestión de alquileres</span>
          </div>
          <div className="flex items-center gap-3">
            {(roles.esAdministrador || roles.esInquilino || roles.esUsuarioBase) && (
              <div ref={notificacionesRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotificacionesAbiertas((abiertas) => !abiertas)}
                  aria-label={`Notificaciones. ${notificaciones.length} avisos.`}
                  aria-expanded={notificacionesAbiertas}
                  aria-haspopup="dialog"
                  title={`${notificaciones.length} notificaciones`}
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  {notificaciones.length > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {notificaciones.length > 9 ? '9+' : notificaciones.length}
                    </span>
                  )}
                </button>
                {notificacionesAbiertas && (
                  <div
                    role="dialog"
                    aria-label="Notificaciones"
                    className="absolute right-0 top-full z-30 mt-3 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <h2 className="text-sm font-semibold text-[#14213D]">Notificaciones</h2>
                      <span className="text-xs text-slate-500">{notificaciones.length} avisos</span>
                    </div>
                    {errorNotificaciones && (
                      <p role="alert" className="border-b border-slate-100 p-4 text-sm text-red-600">{errorNotificaciones}</p>
                    )}
                    {notificaciones.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">No hay notificaciones pendientes.</p>
                    ) : (
                      <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notificaciones.map((notificacion) => (
                          <li key={notificacion.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setNotificacionesAbiertas(false);
                                if (notificacion.volverAIniciarSesion) {
                                  logoutGlobal();
                                  return;
                                }
                                if (notificacion.seccion) setSeccionActiva(notificacion.seccion);
                              }}
                              className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50"
                            >
                              <span className="block text-sm font-semibold text-slate-800">
                                {notificacion.titulo}
                              </span>
                              <span className="mt-1 block truncate text-xs text-slate-600">
                                {notificacion.detalle}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
