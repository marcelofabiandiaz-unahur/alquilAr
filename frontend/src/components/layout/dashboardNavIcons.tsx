import type { ReactNode } from 'react';

const iconClass = 'h-[18px] w-[18px] shrink-0';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      {children}
    </svg>
  );
}

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
  pagos: (
    <Svg>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </Svg>
  ),
  finanzas: (
    <Svg>
      <path d="M12 3v18M7 8h6a3 3 0 010 6H7a3 3 0 000 6h10" strokeLinecap="round" />
    </Svg>
  ),
  reportes: (
    <Svg>
      <path d="M5 19V5M5 19h14M9 15v-4M13 15V9M17 15v-2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  reclamos: (
    <Svg>
      <path d="M12 3a7 7 0 017 7c0 5-7 11-7 11S5 15 5 10a7 7 0 017-7z" />
      <circle cx="12" cy="10" r="2" fill="currentColor" stroke="none" />
    </Svg>
  ),
  historial: (
    <Svg>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" strokeLinecap="round" />
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
  asistente: (
    <Svg>
      <path d="M12 3l2.5 6.5L21 11l-5 4.5L17 22l-5-3-5 3 1-6.5L3 11l6.5-1.5L12 3z" strokeLinejoin="round" />
    </Svg>
  ),
};

export function navIconFor(id: string): ReactNode {
  return ICONS[id] ?? ICONS.inicio;
}
