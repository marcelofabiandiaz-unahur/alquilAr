import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../ui/PageHeader';
import MetricCard from '../ui/MetricCard';
import LoadingRow from '../ui/LoadingRow';
import CobrosPanel from '../pagos/CobrosPanel';
import GastosPanel from '../gastos/GastosPanel';
import { apiGet } from '../../lib/apiClient';
import { conAgrupamiento } from '../../lib/agrupamientos';
import { formatMoneda } from '../../lib/estadoStyles';
import type { FiltroCobros, Gasto, Pago } from '../../types';

type TabFinanzas = 'cobros' | 'gastos';

interface FinanzasPanelProps {
  token: string;
  esPropietario: boolean;
  esInquilino: boolean;
  esAdmin: boolean;
  tabInicial?: TabFinanzas;
  idAgrupamiento?: string;
  filtrarGastosMesActual?: boolean;
  filtroCobros: FiltroCobros;
  setFiltroCobros: (filtro: FiltroCobros) => void;
}

export default function FinanzasPanel({
  token,
  esPropietario,
  esInquilino,
  esAdmin,
  tabInicial = 'cobros',
  idAgrupamiento = '',
  filtrarGastosMesActual = false,
  filtroCobros,
  setFiltroCobros,
}: FinanzasPanelProps) {
  const [tab, setTab] = useState<TabFinanzas>(tabInicial);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargandoKpi, setCargandoKpi] = useState(true);

  const cargarKpis = useCallback(async () => {
    setCargandoKpi(true);
    try {
      const [pagosData, gastosData] = await Promise.all([
        apiGet<Pago[]>(conAgrupamiento('/api/pagos', idAgrupamiento), token),
        apiGet<Gasto[]>(conAgrupamiento('/api/gastos', idAgrupamiento), token),
      ]);
      setPagos(Array.isArray(pagosData) ? pagosData : []);
      setGastos(Array.isArray(gastosData) ? gastosData : []);
    } catch {
      setPagos([]);
      setGastos([]);
    } finally {
      setCargandoKpi(false);
    }
  }, [token, idAgrupamiento]);

  useEffect(() => {
    const timer = setTimeout(() => void cargarKpis(), 0);
    return () => clearTimeout(timer);
  }, [cargarKpis]);

  const kpis = useMemo(() => {
    const pendientes = pagos
      .filter((pago) => pago.estado === 'PENDIENTE')
      .reduce((total, pago) => total + pago.monto_total, 0);
    const atrasado = pagos
      .filter((p) => p.estado === 'ATRASADO')
      .reduce((t, p) => t + p.monto_total, 0);
    const cobrado = pagos
      .filter((p) => p.estado === 'PAGADO')
      .reduce((t, p) => t + p.monto_total, 0);
    const porValidar = pagos.filter((p) => p.estado === 'INGRESADO').length;
    const totalGastos = gastos.reduce((t, g) => t + g.monto_total, 0);
    return { pendientes, cobrado, atrasado, porValidar, totalGastos };
  }, [pagos, gastos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        subtitle="Seguimiento de cobros, pagos recibidos y gastos por propiedad"
      />

      {!(esPropietario && !esAdmin) && (cargandoKpi ? (
        <LoadingRow label="Cargando resumen financiero..." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <MetricCard label="Pendiente" value={formatMoneda(kpis.pendientes)} icon="efectivo" variant="violet" />
          <MetricCard label="Atrasado" value={formatMoneda(kpis.atrasado)} icon="alerta" variant="rose" />
          <MetricCard label="Cobrado" value={formatMoneda(kpis.cobrado)} icon="check" variant="emerald" />
          <MetricCard label="Por validar" value={kpis.porValidar} icon="comprobante" variant="blue" />
          <MetricCard label="Gastos registrados" value={formatMoneda(kpis.totalGastos)} icon="comprobante" variant="amber" />
        </div>
      ))}

      <div className="flex">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner" role="group" aria-label="Sección de finanzas">
          <button
            type="button"
            aria-pressed={tab === 'cobros'}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              tab === 'cobros'
                ? 'bg-white text-violet-800 shadow-sm ring-1 ring-slate-200/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setTab('cobros')}
          >
            Cobros
          </button>
          <button
            type="button"
            aria-pressed={tab === 'gastos'}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              tab === 'gastos'
                ? 'bg-white text-violet-800 shadow-sm ring-1 ring-slate-200/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setTab('gastos')}
          >
            Gastos
          </button>
        </div>
      </div>

      {tab === 'cobros' ? (
        <CobrosPanel
          token={token}
          idAgrupamiento={idAgrupamiento}
          embedded
          filtro={filtroCobros}
          setFiltro={setFiltroCobros}
        />
      ) : (
        <GastosPanel
          token={token}
          esPropietario={esPropietario}
          esInquilino={esInquilino}
          esAdmin={esAdmin}
          idAgrupamiento={idAgrupamiento}
          filtrarMesActual={filtrarGastosMesActual}
          embedded
        />
      )}
    </div>
  );
}
