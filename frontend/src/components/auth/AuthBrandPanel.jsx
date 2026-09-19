import logoAlquilar from '../../assets/logo-alquilar.jpg';

const FEATURES = [
  'Propiedades y contratos centralizados',
  'Roles: propietario, inquilino y administrador',
  'Pagos y reclamos (próximamente)',
];

const TAGS = ['Propiedades', 'Contratos', 'Pagos'];

export default function AuthBrandPanel({ compact = false }) {
  return (
    <div
      className={`relative flex w-full flex-col justify-between bg-[#14213D] text-white overflow-hidden ${
        compact ? 'p-6' : 'p-10 lg:p-14'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/25 via-transparent to-slate-950/80 pointer-events-none" />

      <div className="relative z-10 space-y-8">
        <div className="inline-block bg-white px-3 py-2 rounded-xl shadow-lg">
          <img
            src={logoAlquilar}
            alt="AlquilAR"
            className={`block object-contain ${compact ? 'h-10' : 'h-14 lg:h-16'}`}
          />
        </div>

        {!compact && (
          <>
            <span className="block w-fit text-[10px] font-bold uppercase tracking-widest text-emerald-300/90 border border-emerald-500/30 rounded-full px-3 py-1">
              Plataforma de gestión de alquileres
            </span>

            <div className="space-y-4">
              <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                De la propiedad al contrato, en un solo lugar.
              </h1>
              <p className="text-slate-300 text-sm lg:text-base max-w-md leading-relaxed">
                Gestioná alquileres con roles claros, contratos trazables y una experiencia pensada para propietarios e inquilinos.
              </p>
            </div>

            <ul className="space-y-4">
              {FEATURES.map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    ✓
                  </span>
                  <span className="text-sm text-slate-200">{text}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {compact && (
          <p className="text-slate-300 text-sm">Gestión digital de alquileres</p>
        )}
      </div>

      {!compact && (
        <div className="relative z-10 flex flex-wrap gap-2 pt-8">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className="text-xs font-medium text-slate-300 border border-slate-600/60 rounded-full px-3 py-1"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
