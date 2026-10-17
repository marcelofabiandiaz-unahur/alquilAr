import { Link } from 'react-router-dom';
import logoAlquilar from './assets/logo-alquilar.jpg';
import DisponibilidadPanel from './components/propiedades/DisponibilidadPanel';
import { linkClass } from './components/auth/authStyles';

export default function Catalogo() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link to="/catalogo" className="flex items-center gap-2 shrink-0">
            <img src={logoAlquilar} alt="AlquilAR" className="h-9 w-auto rounded" />
            <span className="font-semibold text-slate-800 hidden sm:inline">AlquilAR</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className={linkClass}>
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              Registrarse
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <DisponibilidadPanel />
      </main>
    </div>
  );
}
