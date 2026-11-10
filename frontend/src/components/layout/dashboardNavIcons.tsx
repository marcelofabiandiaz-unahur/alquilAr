import type { ReactNode } from 'react';

const iconClass = 'h-[18px] w-[18px] shrink-0';

function Svg({ children, className = iconClass }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      {children}
    </svg>
  );
}

const DOLLAR_ICON = (
  <Svg>
    <path d="M15.5 8.5c-.7-.7-1.7-1.1-3.1-1.1-1.8 0-3 .9-3 2.2 0 3 6.2 1.5 6.2 4.8 0 1.4-1.2 2.4-3.2 2.4-1.4 0-2.6-.4-3.5-1.3M12.4 4.5v15" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ICONS: Record<string, ReactNode> = {
  inicio: (
    <Svg>
      <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-8.5z" strokeLinejoin="round" />
    </Svg>
  ),
  propiedades: (
    <Svg>
      <path d="M4 20V9l8-5 8 5v11" strokeLinejoin="round" />
      <path d="M9 20v-6h6v6" />
    </Svg>
  ),
  contratos: (
    <Svg>
      <path d="M7 4h10v16H7z" />
      <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
    </Svg>
  ),
  agrupamientos: (
    <Svg>
      <path d="M4 21V7l8-4 8 4v14" strokeLinejoin="round" />
      <path d="M9 21v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01" strokeLinecap="round" />
    </Svg>
  ),
  pagos: (
    <Svg>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </Svg>
  ),
  finanzas: DOLLAR_ICON,
  reportes: (
    <Svg>
      <path d="M5 19V5M5 19h14M9 15v-4M13 15V9M17 15v-2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  reclamos: (
    <Svg>
      <path d="M12 3 2.8 19h18.4L12 3z" strokeLinejoin="round" />
      <path d="M12 9v4m0 3h.01" strokeLinecap="round" />
    </Svg>
  ),
  historial: (
    <Svg>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" strokeLinecap="round" />
    </Svg>
  ),
  disponibilidad: (
    <Svg>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </Svg>
  ),
  propietarios: (
    <Svg>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2" />
      <path d="M3 19c0-3 3-5 6-5s6 2 6 5M14 19c0-2 2-3.5 4-3.5" strokeLinecap="round" />
    </Svg>
  ),
  usuarios: (
    <Svg>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" strokeLinecap="round" />
    </Svg>
  ),
  configuracion: (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
    </Svg>
  ),
  efectivo: DOLLAR_ICON,
  tendencia: (
    <Svg>
      <path d="M4 18l6-6 4 3 6-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 7h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  comprobante: (
    <Svg>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6M9 16h3" strokeLinecap="round" />
    </Svg>
  ),
  calendario: (
    <Svg>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4m8-4v4M4 10h16" strokeLinecap="round" />
    </Svg>
  ),
  megafono: (
    <Svg>
      <path d="M4 13V9a1 1 0 011-1h3l9-4v16l-9-4H5a1 1 0 01-1-1v-2z" strokeLinejoin="round" />
      <path d="M8 16l1.5 4H13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 9a4 4 0 010 4" strokeLinecap="round" />
    </Svg>
  ),
  llave: (
    <Svg>
      <circle cx="8" cy="8" r="4" />
      <path d="M11 11l9 9m-4-4 2-2m-5-1 2-2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  check: (
    <Svg>
      <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  alerta: (
    <Svg>
      <path d="M12 3 2.8 19h18.4L12 3z" strokeLinejoin="round" />
      <path d="M12 9v4m0 3h.01" strokeLinecap="round" />
    </Svg>
  ),
  pendiente: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  asistente: (
    <Svg>
      <path d="M12 3l2.5 6.5L21 11l-5 4.5L17 22l-5-3-5 3 1-6.5L3 11l6.5-1.5L12 3z" strokeLinejoin="round" />
    </Svg>
  ),
};

export function NavIcon({ id, className }: { id: string; className?: string }) {
  const icon = ICONS[id] ?? ICONS.inicio;
  if (!className) return icon;
  return <span className={className} aria-hidden>{icon}</span>;
}
