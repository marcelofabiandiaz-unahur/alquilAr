import { btnPrimaryClass } from '../layout/dashboardStyles';
import type { AuthUsuario } from '../../types';

interface DashboardWelcomeProps {
  usuario: AuthUsuario;
  onVerFinanzas?: () => void;
  onVerPropiedades?: () => void;
  mostrarAcciones?: boolean;
}

export default function DashboardWelcome({
  usuario,
  onVerFinanzas,
  onVerPropiedades,
  mostrarAcciones = true,
}: DashboardWelcomeProps) {
  return (
    <section className="mb-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-bold text-violet-950 tracking-tight">
            Hola de nuevo, {usuario.nombre}
          </h1>
          <p className="text-slate-600 text-base max-w-xl">
            Esto es lo que está pasando con tus alquileres y contratos hoy.
          </p>
        </div>

        {mostrarAcciones && (onVerFinanzas || onVerPropiedades) && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {onVerFinanzas && (
              <button
                type="button"
                onClick={onVerFinanzas}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Ver finanzas
              </button>
            )}
            {onVerPropiedades && (
              <button type="button" onClick={onVerPropiedades} className={btnPrimaryClass}>
                + Propiedades
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
