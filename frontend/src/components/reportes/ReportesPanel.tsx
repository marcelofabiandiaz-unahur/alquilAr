import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import LoadingRow from '../ui/LoadingRow';
import Alert from '../ui/Alert';
import { btnSecondaryClass } from '../layout/dashboardStyles';
import { apiGet } from '../../lib/apiClient';
import { formatMoneda } from '../../lib/estadoStyles';
import type { Gasto, Pago } from '../../types';

interface ReportesPanelProps {
  token: string;
  onIrAFinanzas?: () => void;
}

function mesClave(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ReportesPanel({ token, onIrAFinanzas }: ReportesPanelProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [pagosData, gastosData] = await Promise.all([
        apiGet<Pago[]>('/api/pagos', token),
        apiGet<Gasto[]>('/api/gastos', token),
      ]);
      setPagos(Array.isArray(pagosData) ? pagosData : []);
      setGastos(Array.isArray(gastosData) ? gastosData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes.');
      setPagos([]);
      setGastos([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const resumen = useMemo(() => {
    const cobrado = pagos
      .filter((p) => p.estado === 'PAGADO')
      .reduce((t, p) => t + p.monto_total, 0);
    const pendiente = pagos
      .filter((p) => ['PENDIENTE', 'ATRASADO', 'INGRESADO'].includes(p.estado))
      .reduce((t, p) => t + p.monto_total, 0);
    const totalGastos = gastos.reduce((t, g) => t + g.monto_total, 0);
    return { cobrado, pendiente, totalGastos };
  }, [pagos, gastos]);

  const porMes = useMemo(() => {
    const map = new Map<string, { cobrado: number; gastos: number }>();
    pagos
      .filter((p) => p.estado === 'PAGADO')
      .forEach((p) => {
        const clave = mesClave(p.fecha_vencimiento);
        const row = map.get(clave) ?? { cobrado: 0, gastos: 0 };
        row.cobrado += p.monto_total;
        map.set(clave, row);
      });
    gastos.forEach((g) => {
      const clave = mesClave(g.fecha_emision);
      const row = map.get(clave) ?? { cobrado: 0, gastos: 0 };
      row.gastos += g.monto_total;
      map.set(clave, row);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [pagos, gastos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        subtitle="Resumen financiero a partir de cobros y gastos registrados"
        action={
          onIrAFinanzas ? (
            <button type="button" className={btnSecondaryClass} onClick={onIrAFinanzas}>
              Ver en Finanzas
            </button>
          ) : null
        }
      />

      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}

      {cargando ? (
        <LoadingRow label="Generando reportes..." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <MetricCard label="Total cobrado" value={formatMoneda(resumen.cobrado)} icon="✓" variant="emerald" />
            <MetricCard label="Pendiente de cobro" value={formatMoneda(resumen.pendiente)} icon="⏳" variant="violet" />
            <MetricCard label="Gastos" value={formatMoneda(resumen.totalGastos)} icon="🧾" variant="amber" />
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Últimos meses</h2>
            </div>
            {porMes.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">No hay movimientos para mostrar.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-3 font-semibold">Período</th>
                    <th className="px-5 py-3 font-semibold">Cobrado</th>
                    <th className="px-5 py-3 font-semibold">Gastos</th>
                  </tr>
                </thead>
                <tbody>
                  {porMes.map(([mes, datos]) => (
                    <tr key={mes} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-[#14213D]">{mes}</td>
                      <td className="px-5 py-3 text-emerald-700">{formatMoneda(datos.cobrado)}</td>
                      <td className="px-5 py-3 text-slate-700">{formatMoneda(datos.gastos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <p className="text-xs text-slate-400">
            Exportación PDF y gráficos avanzados quedan para una iteración posterior.
          </p>
        </>
      )}
    </div>
  );
}
