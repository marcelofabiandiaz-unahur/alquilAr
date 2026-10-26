import logoAlquilar from '../../assets/logo-alquilar.png';

const BENEFICIOS = [
  'Propiedades y contratos centralizados',
  'Pagos y reclamos',
  'Gestión de contratos y alquileres',
  'Seguimiento de pagos y comprobantes',
  'Asistente IA para consultas sobre contratos y pagos',
  'Consulta de contratos vigentes y creación de reclamos',
];

export default function AuthBrandPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section
      aria-label="AlquilAR, plataforma de gestión de alquileres"
      className={`relative flex min-w-0 w-full flex-col justify-between overflow-hidden bg-[#f8fafc] text-[#14213d] ${
        compact ? 'min-h-48 gap-8 px-6 py-7' : 'min-h-screen px-10 py-10 lg:px-14 lg:py-12'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-100/70 via-transparent to-teal-50/90" />
      <div className="relative z-10">
        <img
          src={logoAlquilar}
          alt="AlquilAR"
          className={`block w-auto object-contain ${compact ? 'h-12' : 'h-16 lg:h-[4.5rem]'}`}
        />
      </div>

      <div className={`relative z-10 min-w-0 ${compact ? 'w-full space-y-3' : 'max-w-2xl space-y-6'}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-800">
          Plataforma de gestión de alquileres
        </p>
        <h1 className={`font-bold leading-tight tracking-tight ${compact ? 'text-2xl' : 'text-4xl lg:text-5xl'}`}>
          Gestioná propiedades, contratos, pagos y reclamos desde una sola plataforma.
        </h1>
        <p className={`max-w-xl leading-relaxed text-slate-700 ${compact ? 'text-xs' : 'text-base lg:text-lg'}`}>
          AlquilAR, una empresa argentina que simplifica la gestión de alquileres
        </p>
      </div>

      <div
        className={`auth-marquee relative z-10 min-w-0 w-full overflow-hidden py-3 ${
          compact ? 'max-w-full' : 'max-w-2xl'
        }`}
        aria-label="Beneficios y funciones de AlquilAR"
      >
        <div className="auth-marquee__track" aria-hidden="true">
          {[...BENEFICIOS, ...BENEFICIOS].map((beneficio, index) => (
            <span key={`${beneficio}-${index}`} className="auth-marquee__item">
              {beneficio}
              <span className="mx-5 text-teal-700" aria-hidden="true">·</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
