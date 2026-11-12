import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import LoadingRow from '../ui/LoadingRow';
import Alert from '../ui/Alert';
import StatBadge from '../ui/StatBadge';
import { btnSecondaryClass } from '../layout/dashboardStyles';
import { apiGet } from '../../lib/apiClient';
import { conAgrupamiento, obtenerIdAgrupamiento } from '../../lib/agrupamientos';
import { formatMoneda } from '../../lib/estadoStyles';
import type {
  Agrupamiento,
  Contrato,
  Gasto,
  Pago,
  Propiedad,
} from '../../types';

interface ReportesPanelProps {
  token: string;
  onIrAFinanzas?: () => void;
  idAgrupamiento?: string;
}

interface TotalesAlquiler {
  cobrado: number;
  gastos: number;
  atrasado: number;
  cuotasAtrasadas: number;
}

interface FilaReporte {
  id: string;
  nombre: string;
  agrupamiento: boolean;
  propiedades: Array<{ propiedad: Propiedad; totales: TotalesAlquiler }>;
  totales: TotalesAlquiler;
}

function fechaValida(fecha?: string): Date | null {
  if (!fecha) return null;
  const soloFecha = fecha.slice(0, 10);
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(soloFecha)
    ? new Date(`${soloFecha}T12:00:00`)
    : new Date(fecha);
  return Number.isNaN(valor.getTime()) ? null : valor;
}

function claveMes(fecha?: string): string | null {
  const valor = fechaValida(fecha);
  if (!valor) return null;
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}`;
}

function mesActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function idPropiedad(valor: Contrato['id_propiedad'] | Gasto['id_propiedad']): string {
  return typeof valor === 'string' ? valor : valor?._id || '';
}

function sumarTotales(filas: Array<{ totales: TotalesAlquiler }>): TotalesAlquiler {
  return filas.reduce((total, fila) => ({
    cobrado: total.cobrado + fila.totales.cobrado,
    gastos: total.gastos + fila.totales.gastos,
    atrasado: total.atrasado + fila.totales.atrasado,
    cuotasAtrasadas: total.cuotasAtrasadas + fila.totales.cuotasAtrasadas,
  }), { cobrado: 0, gastos: 0, atrasado: 0, cuotasAtrasadas: 0 });
}

export default function ReportesPanel({
  token,
  onIrAFinanzas,
  idAgrupamiento = '',
}: ReportesPanelProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [agrupamientos, setAgrupamientos] = useState<Agrupamiento[]>([]);
  const [periodo, setPeriodo] = useState(mesActual);
  const [filasExpandidas, setFilasExpandidas] = useState<Set<string>>(() => new Set());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [pagosData, gastosData, contratosData, propiedadesData, agrupamientosData] = await Promise.all([
        apiGet<Pago[]>(conAgrupamiento('/api/pagos', idAgrupamiento), token),
        apiGet<Gasto[]>(conAgrupamiento('/api/gastos', idAgrupamiento), token),
        apiGet<Contrato[]>(conAgrupamiento('/api/contratos', idAgrupamiento), token),
        apiGet<Propiedad[]>(conAgrupamiento('/api/propiedades', idAgrupamiento), token),
        apiGet<Agrupamiento[]>('/api/agrupamientos', token),
      ]);
      if (![pagosData, gastosData, contratosData, propiedadesData, agrupamientosData].every(Array.isArray)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }
      setPagos(pagosData);
      setGastos(gastosData);
      setContratos(contratosData);
      setPropiedades(propiedadesData);
      setAgrupamientos(agrupamientosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes.');
      setPagos([]);
      setGastos([]);
      setContratos([]);
      setPropiedades([]);
      setAgrupamientos([]);
    } finally {
      setCargando(false);
    }
  }, [token, idAgrupamiento]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const reporte = useMemo(() => {
    const contratosVigentes = contratos.filter((contrato) => contrato.estado === 'VIGENTE');
    const idsContratosVigentes = new Set(contratosVigentes.map((contrato) => contrato._id));
    const idsPropiedadesVigentes = new Set(contratosVigentes.map((contrato) => idPropiedad(contrato.id_propiedad)));
    const totalesPorPropiedad = new Map<string, TotalesAlquiler>();
    idsPropiedadesVigentes.forEach((id) => {
      totalesPorPropiedad.set(id, { cobrado: 0, gastos: 0, atrasado: 0, cuotasAtrasadas: 0 });
    });
    pagos.forEach((pago) => {
      if (typeof pago.id_contrato === 'string') return;
      const contrato = pago.id_contrato;
      if (!idsContratosVigentes.has(contrato._id)) return;
      const propiedadId = idPropiedad(contrato.id_propiedad);
      const total = totalesPorPropiedad.get(propiedadId);
      if (!total) return;
      if (pago.estado === 'PAGADO' && claveMes(pago.fecha_pago) === periodo) total.cobrado += pago.monto_total;
      if (pago.estado === 'ATRASADO') {
        total.atrasado += pago.monto_total;
        total.cuotasAtrasadas += 1;
      }
    });
    gastos.forEach((gasto) => {
      const propiedadId = idPropiedad(gasto.id_propiedad);
      const total = totalesPorPropiedad.get(propiedadId);
      if (total && claveMes(gasto.fecha_emision) === periodo) total.gastos += gasto.monto_total;
    });

    const propiedadesActivas = propiedades.filter((propiedad) => idsPropiedadesVigentes.has(propiedad._id));
    const filasPorGrupo = new Map<string, FilaReporte>();
    const filas: FilaReporte[] = [];
    propiedadesActivas.forEach((propiedad) => {
      const totales = totalesPorPropiedad.get(propiedad._id)
        || { cobrado: 0, gastos: 0, atrasado: 0, cuotasAtrasadas: 0 };
      const grupoId = obtenerIdAgrupamiento(propiedad.id_agrupamiento);
      if (!grupoId) {
        filas.push({
          id: propiedad._id,
          nombre: propiedad.direccion,
          agrupamiento: false,
          propiedades: [{ propiedad, totales }],
          totales,
        });
        return;
      }
      const agrupamiento = agrupamientos.find((item) => item._id === grupoId);
      let fila = filasPorGrupo.get(grupoId);
      if (!fila) {
        fila = {
          id: grupoId,
          nombre: agrupamiento?.nombre || 'Agrupamiento',
          agrupamiento: true,
          propiedades: [],
          totales: { cobrado: 0, gastos: 0, atrasado: 0, cuotasAtrasadas: 0 },
        };
        filasPorGrupo.set(grupoId, fila);
        filas.push(fila);
      }
      fila.propiedades.push({ propiedad, totales });
      fila.totales = sumarTotales(fila.propiedades);
    });

    const totalesVigentes = [...totalesPorPropiedad.values()].reduce((total, propiedad) => ({
      cobrado: total.cobrado + propiedad.cobrado,
      gastos: total.gastos + propiedad.gastos,
      atrasado: total.atrasado + propiedad.atrasado,
      cuotasAtrasadas: total.cuotasAtrasadas + propiedad.cuotasAtrasadas,
    }), { cobrado: 0, gastos: 0, atrasado: 0, cuotasAtrasadas: 0 });

    return {
      cobradoPeriodo: totalesVigentes.cobrado,
      gastosPeriodo: totalesVigentes.gastos,
      balancePeriodo: totalesVigentes.cobrado - totalesVigentes.gastos,
      atrasadoTotal: totalesVigentes.atrasado,
      atrasadosCantidad: totalesVigentes.cuotasAtrasadas,
      filas,
    };
  }, [pagos, gastos, contratos, propiedades, agrupamientos, periodo]);

  const alternarFila = (id: string) => {
    setFilasExpandidas((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  };

  const nombrePeriodo = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
    .format(new Date(`${periodo}-15T12:00:00`));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        subtitle="Resumen de cobros y gastos de tus alquileres vigentes"
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label htmlFor="reporte-periodo" className="mb-1 block text-xs font-medium text-slate-500">
                Período del resumen
              </label>
              <input
                id="reporte-periodo"
                type="month"
                value={periodo}
                onChange={(event) => setPeriodo(event.target.value || mesActual())}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              />
            </div>
            <p className="text-sm text-slate-500 capitalize">{nombrePeriodo}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Cobrado en el período" value={formatMoneda(reporte.cobradoPeriodo)} icon="check" variant="emerald" />
            <MetricCard label="Gastos del período" value={formatMoneda(reporte.gastosPeriodo)} icon="comprobante" variant="amber" />
            <MetricCard label="Balance del período" value={formatMoneda(reporte.balancePeriodo)} icon="tendencia" variant={reporte.balancePeriodo >= 0 ? 'blue' : 'rose'} />
            <MetricCard
              label="Atrasado actualmente"
              value={formatMoneda(reporte.atrasadoTotal)}
              icon="alerta"
              variant="rose"
              hint={`${reporte.atrasadosCantidad} cuotas`}
            />
          </div>

          <Card className="max-w-full overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                Alquileres vigentes · {nombrePeriodo}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Cobros según fecha de pago; gastos según fecha de emisión. Los atrasos reflejan el estado actual.
              </p>
            </div>
            {reporte.filas.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">No hay alquileres vigentes para mostrar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[58rem] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3 font-semibold">Agrupamiento / propiedad</th>
                      <th className="px-5 py-3 font-semibold">Cobrado</th>
                      <th className="px-5 py-3 font-semibold">Gastos</th>
                      <th className="px-5 py-3 font-semibold">Balance</th>
                      <th className="px-5 py-3 font-semibold">Atrasado</th>
                      <th className="px-5 py-3 font-semibold">Cuotas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.filas.map((fila) => {
                      const expandida = filasExpandidas.has(fila.id);
                      const tieneDetalle = fila.agrupamiento;
                      return (
                        <Fragment key={fila.id}>
                          <tr key={fila.id} className="border-b border-slate-50 last:border-0">
                            <td className="px-5 py-3">
                              {tieneDetalle ? (
                                <button
                                  type="button"
                                  aria-expanded={expandida}
                                  onClick={() => alternarFila(fila.id)}
                                  className="flex items-center gap-2 text-left font-semibold text-[var(--brand-navy)] hover:text-violet-700"
                                >
                                  <span aria-hidden="true">{expandida ? '−' : '+'}</span>
                                  {fila.nombre}
                                  <span className="text-xs font-normal text-slate-400">
                                    ({fila.propiedades.length} propiedades)
                                  </span>
                                </button>
                              ) : (
                                <div className="font-semibold text-[var(--brand-navy)]">
                                  {fila.nombre}
                                  {fila.agrupamiento && fila.propiedades.length === 1 && (
                                    <span className="ml-2 text-xs font-normal text-slate-400">
                                      {fila.propiedades[0].propiedad.direccion}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3 text-emerald-700">{formatMoneda(fila.totales.cobrado)}</td>
                            <td className="px-5 py-3 text-slate-700">{formatMoneda(fila.totales.gastos)}</td>
                            <td className="px-5 py-3 font-semibold text-slate-800">
                              {formatMoneda(fila.totales.cobrado - fila.totales.gastos)}
                            </td>
                            <td className="px-5 py-3 text-rose-700">{formatMoneda(fila.totales.atrasado)}</td>
                            <td className="px-5 py-3">
                              {fila.totales.cuotasAtrasadas > 0
                                ? <StatBadge estado={`${fila.totales.cuotasAtrasadas} cuotas`} />
                                : '0'}
                            </td>
                          </tr>
                          {tieneDetalle && expandida && fila.propiedades.map(({ propiedad, totales }) => (
                            <tr key={`${fila.id}-${propiedad._id}`} className="border-b border-slate-50 bg-slate-50/70">
                              <td className="px-5 py-3 pl-12 text-slate-600">{propiedad.direccion}</td>
                              <td className="px-5 py-3 text-emerald-700">{formatMoneda(totales.cobrado)}</td>
                              <td className="px-5 py-3 text-slate-700">{formatMoneda(totales.gastos)}</td>
                              <td className="px-5 py-3 font-semibold text-slate-800">
                                {formatMoneda(totales.cobrado - totales.gastos)}
                              </td>
                              <td className="px-5 py-3 text-rose-700">{formatMoneda(totales.atrasado)}</td>
                              <td className="px-5 py-3">
                                {totales.cuotasAtrasadas > 0
                                  ? <StatBadge estado={`${totales.cuotasAtrasadas} cuotas`} />
                                  : '0'}
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
