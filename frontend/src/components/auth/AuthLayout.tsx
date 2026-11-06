import AuthBrandPanel from './AuthBrandPanel';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const mostrarFormularioInicial = (
    typeof location.state === 'object'
    && location.state !== null
    && 'mostrarFormularioMovil' in location.state
    && location.state.mostrarFormularioMovil === true
  );
  const [mostrarFormularioMovil, setMostrarFormularioMovil] = useState(mostrarFormularioInicial);
  const enRegistro = location.pathname === '/registro';

  const abrirInicioSesion = () => {
    if (enRegistro) {
      navigate('/', { state: { mostrarFormularioMovil: true } });
      return;
    }
    setMostrarFormularioMovil(true);
  };

  const abrirRegistro = () => {
    if (enRegistro) {
      setMostrarFormularioMovil(true);
      return;
    }
    navigate('/registro', { state: { mostrarFormularioMovil: true } });
  };

  return (
    <div className="grid min-h-dvh min-w-0 font-sans md:grid-cols-2">
      <div className="hidden min-w-0 w-full md:flex">
        <AuthBrandPanel />
      </div>

      <div className={`${mostrarFormularioMovil ? 'flex' : 'hidden'} min-h-dvh min-w-0 flex-col bg-[#1b1345] text-white md:flex md:min-h-0`}>
        <div className="px-6 pt-5 md:hidden">
          <button
            type="button"
            onClick={() => setMostrarFormularioMovil(false)}
            className="inline-flex items-center gap-2 rounded-lg py-2 text-sm font-medium text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5m0 0 7 7m-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Volver
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            {(title || subtitle) && (
              <div className="mb-8">
                {title && (
                  <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
                )}
                {subtitle && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{subtitle}</p>
                )}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>

      <div className={`${mostrarFormularioMovil ? 'hidden' : 'flex'} min-h-dvh min-w-0 flex-col bg-[#f8fafc] md:hidden`}>
        <AuthBrandPanel
          compact
          compactActions={(
            <div className="relative z-10 grid w-full gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={abrirInicioSesion}
                className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={abrirRegistro}
                className="w-full rounded-lg border border-teal-700 bg-white/80 px-4 py-3 text-sm font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                Registrarse
              </button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
