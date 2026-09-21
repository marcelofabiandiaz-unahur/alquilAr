import { useState, useRef, useEffect } from 'react';
import logoAlquilar from '../../assets/logo-alquilar.jpg';

const NAV_GROUPS = [
  {
    label: 'General',
    items: [{ id: 'inicio', label: 'Inicio' }],
  },
  {
    label: 'Operación',
    items: [
      { id: 'buscar', label: 'Buscar alquileres', show: (r) => r.esUsuarioBase },
      { id: 'mis-alquileres', label: 'Mis alquileres', show: (r) => r.esInquilino },
      { id: 'propiedades', label: 'Mis propiedades', show: (r) => r.esPropietario },
      { id: 'contratos', label: 'Contratos', show: (r) => r.esInquilino || r.esPropietario },
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

function ChevronIcon({ className = '' }) {
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

function MailIcon({ className = '' }) {
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

function LogoutIcon({ className = '' }) {
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

function NavButton({ id, label, active, onClick }) {
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

export default function DashboardLayout({
  usuario,
  logoutGlobal,
  seccionActiva,
  setSeccionActiva,
  roles,
  children,
}) {
  const [usuarioExpandido, setUsuarioExpandido] = useState(false);
  const panelRef = useRef(null);
  const iniciales = `${usuario.nombre[0]}${usuario.apellido[0]}`.toUpperCase();

  useEffect(() => {
    if (!usuarioExpandido) return;

    const cerrarSiClickFuera = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setUsuarioExpandido(false);
      }
    };

    const cerrarConEscape = (event) => {
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
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold text-emerald-300">
              {iniciales}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
