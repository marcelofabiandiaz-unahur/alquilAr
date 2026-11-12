import { btnPrimaryClass } from '../layout/dashboardStyles';
import type { AuthUsuario } from '../../types';

interface DashboardWelcomeProps {
  usuario: AuthUsuario;
  subtitulo?: string;
  onVerFinanzas?: () => void;
  onVerPropiedades?: () => void;
  mostrarAcciones?: boolean;
}

const btnSecondaryClass =
  'px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors';

export default function DashboardWelcome({
  usuario,
  subtitulo = 'Esto es lo que está pasando con tus alquileres y contratos hoy.',
  onVerFinanzas,
  onVerPropiedades,
  mostrarAcciones = true,
}: DashboardWelcomeProps) {
  const tieneAcciones = Boolean(onVerFinanzas || onVerPropiedades);

  return (
    <section className="mb-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl lg:text-3xl font-bold text-violet-950 tracking-tight">
            Hola de nuevo, {usuario.nombre}
          </h1>
          <p className="text-slate-600 text-base max-w-xl">
            {subtitulo}
          </p>
        </div>

        {mostrarAcciones && tieneAcciones && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {onVerFinanzas && (
              <button type="button" onClick={onVerFinanzas} className={btnSecondaryClass}>
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
