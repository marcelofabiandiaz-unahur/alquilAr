import Card from '../ui/Card';
import PageHeader from '../ui/PageHeader';

const MESES = ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'];
const SERIES = [
  { label: 'Propietarios activos', values: [38, 41, 43, 46, 49, 52], color: '#7c3aed' },
  { label: 'Inquilinos activos', values: [62, 65, 69, 71, 76, 80], color: '#0284c7' },
  { label: 'Propiedades activas', values: [74, 77, 80, 84, 88, 92], color: '#059669' },
];

function puntosSerie(valores: number[]): string {
  return valores.map((valor, indice) => {
    const x = 36 + (indice * 718) / (valores.length - 1);
    const y = 250 - (valor / 100) * 210;
    return `${x},${y}`;
  }).join(' ');
}

export default function ReportesAdministradorPanel() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        subtitle="Evolución mensual de la cantidad activa al cierre de cada mes."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-900">Próximamente - Fuera del MVP</p>
            <p className="mt-1 text-xs text-amber-800">
              El gráfico es ilustrativo; todavía no representa datos reales del sistema.
            </p>
          </div>
          <span className="w-fit rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800">
            Mock
          </span>
        </div>

        <div className="p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap gap-x-6 gap-y-3">
            {SERIES.map((serie) => (
              <div key={serie.label} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: serie.color }} />
                {serie.label}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 800 310"
              role="img"
              aria-label="Mock de evolución mensual de propietarios, inquilinos y propiedades activas"
              className="min-w-[640px] w-full"
            >
              {[0, 25, 50, 75, 100].map((valor) => {
                const y = 250 - (valor / 100) * 210;
                return (
                  <g key={valor}>
                    <line x1="52" x2="770" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />
                    <text x="40" y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{valor}</text>
                  </g>
                );
              })}
              {MESES.map((mes, indice) => {
                const x = 52 + (indice * 718) / (MESES.length - 1);
                return (
                  <text key={mes} x={x} y="278" textAnchor="middle" fill="#64748b" fontSize="12">
                    {mes}
                  </text>
                );
              })}
              {SERIES.map((serie) => (
                <g key={serie.label}>
                  <polyline
                    points={puntosSerie(serie.values)}
                    fill="none"
                    stroke={serie.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform="translate(16 0)"
                  />
                  {serie.values.map((valor, indice) => {
                    const x = 36 + (indice * 718) / (serie.values.length - 1) + 16;
                    const y = 250 - (valor / 100) * 210;
                    return (
                      <circle
                        key={`${serie.label}-${MESES[indice]}`}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="white"
                        stroke={serie.color}
                        strokeWidth="2"
                      />
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            En la versión final, los valores mostrarán el total de cuentas activas con cada rol y de propiedades no inactivas al cierre de cada mes.
          </p>
        </div>
      </Card>
    </div>
  );
}
