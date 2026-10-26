import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../ui/PageHeader';
import MetricCard from '../ui/MetricCard';
import LoadingRow from '../ui/LoadingRow';
import CobrosPanel from '../pagos/CobrosPanel';
import GastosPanel from '../gastos/GastosPanel';
import { apiGet } from '../../lib/apiClient';
import { formatMoneda } from '../../lib/estadoStyles';
import type { Gasto, Pago } from '../../types';

type TabFinanzas = 'cobros' | 'gastos';

interface FinanzasPanelProps {
  token: string;
  esPropietario: boolean;
  esInquilino: boolean;
  esAdmin: boolean;
  tabInicial?: TabFinanzas;
}

export default function FinanzasPanel({
  token,
  esPropietario,
  esInquilino,
  esAdmin,
  tabInicial = 'cobros',
}: FinanzasPanelProps) {
  const [tab, setTab] = useState<TabFinanzas>(tabInicial);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargandoKpi, setCargandoKpi] = useState(true);

  const cargarKpis = useCallback(async () => {
    setCargandoKpi(true);
    try {
      const [pagosData, gastosData] = await Promise.all([
        apiGet<Pago[]>('/api/pagos', token),
        apiGet<Gasto[]>('/api/gastos', token),
      ]);
      setPagos(Array.isArray(pagosData) ? pagosData : []);
      setGastos(Array.isArray(gastosData) ? gastosData : []);
    } catch {
      setPagos([]);
      setGastos([]);
    } finally {
      setCargandoKpi(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void cargarKpis(), 0);
    return () => clearTimeout(timer);
  }, [cargarKpis]);

  const kpis = useMemo(() => {
    const aCobrar = pagos
      .filter((p) => ['PENDIENTE', 'ATRASADO', 'INGRESADO'].includes(p.estado))
      .reduce((t, p) => t + p.monto_total, 0);
    const cobrado = pagos
      .filter((p) => p.estado === 'PAGADO')
      .reduce((t, p) => t + p.monto_total, 0);
    const porValidar = pagos.filter((p) => p.estado === 'INGRESADO').length;
    const totalGastos = gastos.reduce((t, g) => t + g.monto_total, 0);
    return { aCobrar, cobrado, porValidar, totalGastos };
  }, [pagos, gastos]);

  const tabClass = (activo: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
      activo
        ? 'bg-violet-600 text-white shadow-sm'
        : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
    }`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        subtitle="Seguimiento de cobros, pagos recibidos y gastos por propiedad"
      />

      {cargandoKpi ? (
        <LoadingRow label="Cargando resumen financiero..." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <MetricCard label="A cobrar" value={formatMoneda(kpis.aCobrar)} icon="efectivo" variant="violet" />
          <MetricCard label="Cobrado" value={formatMoneda(kpis.cobrado)} icon="check" variant="emerald" />
          <MetricCard label="Por validar" value={kpis.porValidar} icon="comprobante" variant="blue" />
          <MetricCard label="Gastos registrados" value={formatMoneda(kpis.totalGastos)} icon="comprobante" variant="amber" />
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200 pb-1">
        <button type="button" className={tabClass(tab === 'cobros')} onClick={() => setTab('cobros')}>
          Cobros
        </button>
        <button type="button" className={tabClass(tab === 'gastos')} onClick={() => setTab('gastos')}>
          Gastos
        </button>
      </div>

      {tab === 'cobros' ? (
        <CobrosPanel token={token} embedded />
      ) : (
        <GastosPanel
          token={token}
          esPropietario={esPropietario}
          esInquilino={esInquilino}
          esAdmin={esAdmin}
          embedded
        />
      )}
    </div>
  );
}
