import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/apiClient';
import { formatMoneda } from '../../lib/estadoStyles';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import StatBadge from '../ui/StatBadge';
import LoadingRow from '../ui/LoadingRow';
import Alert from '../ui/Alert';
import type { Contrato, Pago, Reclamo, RolesDashboard } from '../../types';

interface HistorialPanelProps {
  token: string;
  roles: RolesDashboard;
}

type PestañaDetalle = 'realizados' | 'cuotas' | 'reclamos';

function convertirFecha(fecha?: string): Date | null {
  if (!fecha) return null;
  const soloFecha = fecha.slice(0, 10);
  const resultado = /^\d{4}-\d{2}-\d{2}$/.test(soloFecha)
    ? new Date(`${soloFecha}T12:00:00`)
    : new Date(fecha);
  return Number.isNaN(resultado.getTime()) ? null : resultado;
}

function fechaVisible(fecha?: string): string {
  const fechaConvertida = convertirFecha(fecha);
  return fechaConvertida ? fechaConvertida.toLocaleDateString('es-AR') : 'Sin fecha';
}

function inquilinoLabel(contrato: Contrato): string {
  const inquilino = contrato.id_inquilino;
  if (typeof inquilino === 'string') return '';
  return [inquilino.nombre, inquilino.apellido].filter(Boolean).join(' ') || inquilino.email || '';
}

function obtenerIdContrato(referencia: string | Contrato): string {
  return typeof referencia === 'string' ? referencia : referencia?._id || '';
}

function obtenerDireccion(contrato: Contrato): string {
  const propiedad = contrato.id_propiedad;
  return typeof propiedad === 'object' ? propiedad.direccion || 'Propiedad sin dirección' : 'Propiedad';
}

function obtenerDetallePropiedad(contrato: Contrato): string {
  const propiedad = contrato.id_propiedad;
  if (typeof propiedad !== 'object') return '';
  return [propiedad.tipo, propiedad.ambientes ? `${propiedad.ambientes} ambientes` : '']
    .filter(Boolean)
    .join(' · ');
}

function mesesEntre(inicio: Date, fin: Date): number {
  const diferencia = (fin.getFullYear() - inicio.getFullYear()) * 12
    + fin.getMonth() - inicio.getMonth();
  return Math.max(0, diferencia - (fin.getDate() < inicio.getDate() ? 1 : 0));
}

function etiquetaPeriodo(pago: Pago): string {
  if (pago.mes_correspondiente === 'DEPOSITO') return 'Depósito';
  if (/^\d{6}$/.test(pago.mes_correspondiente)) {
    return `Alquiler ${pago.mes_correspondiente.slice(0, 4)}-${pago.mes_correspondiente.slice(4)}`;
  }
  return `Alquiler ${pago.mes_correspondiente}`;
}

function ordenarPorVencimiento(pagos: Pago[]): Pago[] {
  return [...pagos].sort((a, b) => {
    const fechaA = convertirFecha(a.fecha_vencimiento)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const fechaB = convertirFecha(b.fecha_vencimiento)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return fechaA - fechaB;
  });
}

function ListaPagos({ pagos, titulo }: { pagos: Pago[]; titulo: string }) {
  if (pagos.length === 0) {
    return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{titulo}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Concepto</th>
            <th className="px-4 py-3 font-semibold">Vencimiento</th>
            <th className="px-4 py-3 font-semibold">Importe</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            {pagos.some((pago) => pago.fecha_pago) && (
              <th className="px-4 py-3 font-semibold">Fecha de pago</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {pagos.map((pago) => (
            <tr key={pago._id}>
              <td className="px-4 py-3">{etiquetaPeriodo(pago)}</td>
              <td className="px-4 py-3">{fechaVisible(pago.fecha_vencimiento)}</td>
              <td className="px-4 py-3 font-semibold">{formatMoneda(pago.monto_total)}</td>
              <td className="px-4 py-3"><StatBadge estado={pago.estado} /></td>
              {pagos.some((item) => item.fecha_pago) && (
                <td className="px-4 py-3">{fechaVisible(pago.fecha_pago)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HistorialPanel({ token, roles }: HistorialPanelProps) {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [contratoSeleccionado, setContratoSeleccionado] = useState<Contrato | null>(null);
  const [pestaña, setPestaña] = useState<PestañaDetalle>('realizados');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [contratosData, pagosData, reclamosData] = await Promise.all([
        apiGet<Contrato[]>('/api/contratos', token),
        apiGet<Pago[]>('/api/pagos', token),
        apiGet<Reclamo[]>('/api/reclamos', token),
      ]);
      if (![contratosData, pagosData, reclamosData].every(Array.isArray)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }
      setContratos(contratosData);
      setPagos(pagosData);
      setReclamos(reclamosData);
    } catch (err) {
      setContratos([]);
      setPagos([]);
      setReclamos([]);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  useEffect(() => {
    if (!contratoSeleccionado) return undefined;
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContratoSeleccionado(null);
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => document.removeEventListener('keydown', cerrarConEscape);
  }, [contratoSeleccionado]);

  const contratosOrdenados = useMemo(() => [...contratos]
    .filter((contrato) => ['VIGENTE', 'FINALIZADO'].includes(contrato.estado))
    .sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime()), [contratos]);
  const vigentes = contratosOrdenados.filter((contrato) => contrato.estado === 'VIGENTE');
  const finalizados = contratosOrdenados.filter((contrato) => contrato.estado === 'FINALIZADO');

  const pagosContrato = contratoSeleccionado
    ? pagos.filter((pago) => obtenerIdContrato(pago.id_contrato) === contratoSeleccionado._id)
    : [];
  const pagosRealizados = ordenarPorVencimiento(pagosContrato.filter((pago) => pago.estado === 'PAGADO'));
  const cuotasFuturas = ordenarPorVencimiento(pagosContrato.filter((pago) => pago.estado !== 'PAGADO'));
  const reclamosContrato = contratoSeleccionado
    ? reclamos
      .filter((reclamo) => obtenerIdContrato(reclamo.id_contrato) === contratoSeleccionado._id)
      .sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime())
    : [];

  const inicio = contratoSeleccionado ? convertirFecha(contratoSeleccionado.fecha_inicio) : null;
  const fin = contratoSeleccionado ? convertirFecha(contratoSeleccionado.fecha_fin) : null;
  const fechaReferencia = fin && fin < new Date() ? fin : new Date();
  const duracionMeses = inicio && fin ? mesesEntre(inicio, fin) : 0;
  const mesesTranscurridos = inicio
    ? Math.min(duracionMeses || mesesEntre(inicio, fechaReferencia), mesesEntre(inicio, fechaReferencia))
    : 0;
  const progreso = duracionMeses > 0 ? Math.min(100, (mesesTranscurridos / duracionMeses) * 100) : 0;
  const pestañas: { id: PestañaDetalle; label: string; cantidad: number }[] = [
    { id: 'realizados', label: roles.esPropietario ? 'Cobranzas' : 'Pagos realizados', cantidad: pagosRealizados.length },
    { id: 'cuotas', label: 'Cuotas futuras', cantidad: cuotasFuturas.length },
    { id: 'reclamos', label: 'Reclamos', cantidad: reclamosContrato.length },
  ];

  const renderListaContratos = (lista: Contrato[], vacio: string) => (
    lista.length === 0 ? (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        {vacio}
      </p>
    ) : (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {lista.map((contrato) => (
          <button
            key={contrato._id}
            type="button"
            onClick={() => {
              setContratoSeleccionado(contrato);
              setPestaña('realizados');
            }}
            className="text-left"
          >
            <Card className="h-full p-5 transition hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#14213D]">{obtenerDireccion(contrato)}</h3>
                  {obtenerDetallePropiedad(contrato) && (
                    <p className="mt-1 text-sm text-slate-500">{obtenerDetallePropiedad(contrato)}</p>
                  )}
                  {roles.esPropietario && inquilinoLabel(contrato) && (
                    <p className="mt-2 text-sm text-slate-600">Inquilino: {inquilinoLabel(contrato)}</p>
                  )}
                </div>
                <StatBadge estado={contrato.estado} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Inicio</p>
                  <p className="mt-1 font-medium text-slate-700">{fechaVisible(contrato.fecha_inicio)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Finalización</p>
                  <p className="mt-1 font-medium text-slate-700">{fechaVisible(contrato.fecha_fin)}</p>
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold text-emerald-700">Ver detalle del alquiler →</p>
            </Card>
          </button>
        ))}
      </div>
    )
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Historial de alquileres"
        subtitle="Consultá los alquileres vigentes y finalizados y sus movimientos asociados"
      />

      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {cargando ? (
        <LoadingRow label="Cargando historial..." />
      ) : contratosOrdenados.length === 0 ? (
        <EmptyState title="Sin historial" description="Todavía no hay alquileres vigentes ni finalizados para mostrar." />
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#14213D]">Alquileres vigentes</h2>
              <span className="text-sm text-slate-500">{vigentes.length}</span>
            </div>
            {renderListaContratos(vigentes, 'No hay alquileres vigentes.')}
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#14213D]">Alquileres finalizados</h2>
              <span className="text-sm text-slate-500">{finalizados.length}</span>
            </div>
            {renderListaContratos(finalizados, 'No hay alquileres finalizados.')}
          </section>
        </>
      )}

      {contratoSeleccionado && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Cerrar detalle del alquiler"
            onClick={() => setContratoSeleccionado(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="detalle-alquiler-titulo"
            className="absolute inset-y-3 right-3 flex w-[calc(100%-1.5rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Detalle del alquiler</p>
                <h2 id="detalle-alquiler-titulo" className="mt-1 text-xl font-bold text-[#14213D]">
                  {obtenerDireccion(contratoSeleccionado)}
                </h2>
                {roles.esPropietario && inquilinoLabel(contratoSeleccionado) && (
                  <p className="mt-1 text-sm text-slate-500">Inquilino: {inquilinoLabel(contratoSeleccionado)}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setContratoSeleccionado(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
              <section className="space-y-4 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-[#14213D]">Duración del contrato</h3>
                  <StatBadge estado={contratoSeleccionado.estado} />
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Fecha de inicio</dt>
                    <dd className="mt-1 font-semibold text-slate-800">{fechaVisible(contratoSeleccionado.fecha_inicio)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Fecha de finalización</dt>
                    <dd className="mt-1 font-semibold text-slate-800">{fechaVisible(contratoSeleccionado.fecha_fin)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Duración</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {duracionMeses} {duracionMeses === 1 ? 'mes' : 'meses'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Monto mensual</dt>
                    <dd className="mt-1 font-semibold text-emerald-700">{formatMoneda(contratoSeleccionado.monto_mensual)}</dd>
                  </div>
                </dl>
                <div>
                  <div className="mb-2 flex justify-between text-xs text-slate-500">
                    <span>Meses transcurridos</span>
                    <span>{mesesTranscurridos} de {duracionMeses}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Progreso del contrato en meses"
                    aria-valuemin={0}
                    aria-valuemax={duracionMeses || 1}
                    aria-valuenow={mesesTranscurridos}
                    className="h-3 overflow-hidden rounded-full bg-slate-100"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${progreso}%` }}
                    />
                  </div>
                </div>
              </section>

              <section>
                <div role="tablist" aria-label="Información del alquiler" className="flex overflow-x-auto border-b border-slate-200">
                  {pestañas.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={pestaña === item.id}
                      onClick={() => setPestaña(item.id)}
                      className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
                        pestaña === item.id
                          ? 'border-emerald-500 text-emerald-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {item.label} ({item.cantidad})
                    </button>
                  ))}
                </div>
                <div role="tabpanel" className="pt-4">
                  {pestaña === 'realizados' && (
                    <ListaPagos
                      pagos={pagosRealizados}
                      titulo={roles.esPropietario ? 'Todavía no hay cobranzas confirmadas.' : 'Todavía no hay pagos realizados.'}
                    />
                  )}
                  {pestaña === 'cuotas' && (
                    <ListaPagos
                      pagos={cuotasFuturas}
                      titulo="No hay cuotas pendientes para este alquiler."
                    />
                  )}
                  {pestaña === 'reclamos' && (
                    reclamosContrato.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No hay reclamos asociados a este alquiler.</p>
                    ) : (
                      <ul className="space-y-3">
                        {reclamosContrato.map((reclamo) => (
                          <li key={reclamo._id} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-[#14213D]">{reclamo.asunto}</h3>
                                <p className="mt-1 text-sm text-slate-600">{reclamo.descripcion}</p>
                              </div>
                              <StatBadge estado={reclamo.estado} />
                            </div>
                            <p className="mt-3 text-xs text-slate-500">
                              {reclamo.categoria} · {reclamo.prioridad} · {fechaVisible(reclamo.fecha_creacion)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
