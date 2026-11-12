import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../../lib/apiClient';
import { formatMoneda } from '../../lib/estadoStyles';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import LoadingRow from '../ui/LoadingRow';
import Alert from '../ui/Alert';
import StatBadge from '../ui/StatBadge';
import ComprobantePagoLink from './ComprobantePagoLink';
import { btnPrimaryClass } from '../layout/dashboardStyles';
import { conAgrupamiento } from '../../lib/agrupamientos';
import {
  cuotasPendientesEsteMes,
  pagosCobradosEsteMes,
  proximasCuotasPendientes,
} from '../../lib/resumenFinanciero';
import type { FiltroCobros, Pago } from '../../types';

interface CobrosPanelProps {
  token: string;
  idAgrupamiento?: string;
  embedded?: boolean;
  filtro: FiltroCobros;
  setFiltro: (filtro: FiltroCobros) => void;
}

function obtenerComprobantes(pago: Pago): string[] {
  return [...new Set([...(pago.comprobantes || []), ...(pago.comprobante_url ? [pago.comprobante_url] : [])])];
}

function conceptoPago(pago: Pago): string {
  return pago.mes_correspondiente === 'DEPOSITO' ? 'Depósito' : 'Alquiler';
}

function periodoVisible(pago: Pago): string {
  if (pago.mes_correspondiente === 'DEPOSITO') return '—';
  if (/^\d{6}$/.test(pago.mes_correspondiente)) {
    return `${pago.mes_correspondiente.slice(0, 4)}-${pago.mes_correspondiente.slice(4)}`;
  }
  return pago.mes_correspondiente;
}

function identificadorContrato(pago: Pago): { direccion: string; fechas: string } {
  if (!pago.id_contrato || typeof pago.id_contrato === 'string') {
    return { direccion: 'Contrato', fechas: '' };
  }
  const propiedad = pago.id_contrato.id_propiedad;
  const direccion = typeof propiedad === 'object' ? propiedad.direccion || 'Contrato' : 'Contrato';
  const formatoFecha = (fecha?: string) => {
    if (!fecha) return '';
    const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return '';
    return new Intl.DateTimeFormat('es-AR').format(new Date(anio, mes - 1, dia));
  };
  const inicio = formatoFecha(pago.id_contrato.fecha_inicio);
  const fin = formatoFecha(pago.id_contrato.fecha_fin);
  return {
    direccion,
    fechas: inicio || fin ? `${inicio || '—'} – ${fin || 'Sin fecha de fin'}` : '',
  };
}

export default function CobrosPanel({
  token,
  idAgrupamiento = '',
  embedded = false,
  filtro,
  setFiltro,
}: CobrosPanelProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [accionId, setAccionId] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiGet<Pago[]>(
        conAgrupamiento('/api/pagos', idAgrupamiento),
        token,
      );
      if (!Array.isArray(data)) throw new Error('El backend devolvió una respuesta inesperada.');
      setPagos(data);
    } catch (err) {
      setPagos([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los cobros.');
    } finally {
      setCargando(false);
    }
  }, [token, idAgrupamiento]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const confirmarCobro = async (pago: Pago) => {
    setAccionId(pago._id);
    setError('');
    setInfo('');
    try {
      await apiPatch(`/api/pagos/${pago._id}/confirmar`, token, {});
      setInfo('Cobro confirmado.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el cobro.');
    } finally {
      setAccionId('');
    }
  };

  const porValidar = pagos.filter((pago) => pago.estado === 'INGRESADO' && obtenerComprobantes(pago).length > 0);
  const confirmados = pagos.filter((pago) => pago.estado === 'PAGADO');
  const confirmadosEsteMes = pagosCobradosEsteMes(pagos);
  const pendientes = pagos.filter((pago) => pago.estado === 'PENDIENTE');
  const pendientesEsteMes = cuotasPendientesEsteMes(pagos);
  const proximasCuotas = proximasCuotasPendientes(pagos);
  const atrasados = pagos.filter((pago) => pago.estado === 'ATRASADO');
  const etiquetasFiltro: Record<FiltroCobros, string> = {
    TODOS: 'Todos',
    PENDIENTE: 'Pendientes',
    MES_ACTUAL: 'Este mes',
    PROXIMAS: 'Próximas cuotas',
    ATRASADO: 'Atrasados',
    INGRESADO: 'Por validar',
    PAGADO: 'Cobrados',
    COBRADO_MES: 'Cobrado este mes',
  };
  const mostrarValidar = filtro === 'TODOS' || filtro === 'INGRESADO';
  const mostrarConfirmados = filtro === 'TODOS' || filtro === 'PAGADO' || filtro === 'COBRADO_MES';
  const filasConfirmadas = filtro === 'COBRADO_MES' ? confirmadosEsteMes : confirmados;
  const renderPagosAbiertos = (titulo: string, filas: Pago[], vacio: string) => (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
        {titulo} ({filas.length})
      </h2>
      {cargando ? (
        <LoadingRow label="Cargando cobros pendientes..." />
      ) : filas.length === 0 && !error ? (
        <EmptyState
          title={`Sin ${vacio}`}
          description={vacio.includes('atrasados')
            ? 'No hay cuotas vencidas para mostrar.'
            : vacio.includes('próximas')
              ? 'No hay cuotas futuras pendientes para contratos vigentes.'
              : vacio.includes('este mes')
                ? 'No hay cuotas pendientes con vencimiento este mes.'
                : 'No hay cuotas pendientes para mostrar.'}
        />
      ) : (
        <DataTable
          columns={['Contrato / propiedad', 'Concepto', 'Período', 'Vencimiento', 'Importe', 'Estado']}
          rows={filas}
          renderRow={(pago) => {
            const contrato = identificadorContrato(pago);
            return (
              <tr key={pago._id} className="hover:bg-slate-50">
                <td className="p-4">
                  <div className="font-medium text-slate-800">{contrato.direccion}</div>
                  {contrato.fechas && <div className="mt-1 text-xs text-slate-500">{contrato.fechas}</div>}
                </td>
                <td className="p-4">{conceptoPago(pago)}</td>
                <td className="p-4">{periodoVisible(pago)}</td>
                <td className="p-4">{pago.fecha_vencimiento ? new Date(pago.fecha_vencimiento).toLocaleDateString() : '—'}</td>
                <td className="p-4 font-semibold">{formatMoneda(pago.monto_total)}</td>
                <td className="p-4"><StatBadge estado={pago.estado} /></td>
              </tr>
            );
          }}
        />
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader title="Cobros" subtitle="Revisá los comprobantes enviados y confirmá los pagos recibidos" />
      )}
      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="success" onClose={() => setInfo('')}>{info}</Alert>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar cobros">
        {(['TODOS', 'PENDIENTE', 'MES_ACTUAL', 'PROXIMAS', 'ATRASADO', 'INGRESADO', 'PAGADO', 'COBRADO_MES'] as FiltroCobros[]).map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={filtro === opcion}
            onClick={() => setFiltro(opcion)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              filtro === opcion
                ? 'border-violet-700 bg-violet-700 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {etiquetasFiltro[opcion]}
          </button>
        ))}
      </div>

      {(filtro === 'TODOS' || filtro === 'PENDIENTE') && renderPagosAbiertos(
        'Cobros pendientes',
        pendientes,
        'cobros pendientes',
      )}
      {filtro === 'MES_ACTUAL' && renderPagosAbiertos(
        'A cobrar este mes',
        pendientesEsteMes,
        'cobros pendientes este mes',
      )}
      {filtro === 'PROXIMAS' && renderPagosAbiertos(
        'Próximas cuotas (una por contrato vigente)',
        proximasCuotas,
        'próximas cuotas',
      )}
      {(filtro === 'TODOS' || filtro === 'ATRASADO') && renderPagosAbiertos(
        'Cobros atrasados',
        atrasados,
        'cobros atrasados',
      )}

      {mostrarValidar && <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Cobros para validar ({porValidar.length})
        </h2>
        {cargando ? (
          <LoadingRow label="Cargando cobros..." />
        ) : porValidar.length === 0 && !error ? (
          <EmptyState title="Sin cobros para validar" description="Los comprobantes enviados por los inquilinos aparecerán aquí." />
        ) : (
          <DataTable
            columns={['Contrato / propiedad', 'Concepto', 'Período', 'Vencimiento', 'Importe', 'Estado', 'Comprobante', 'Acción']}
            rows={porValidar}
            renderRow={(pago) => {
              const contrato = identificadorContrato(pago);
              return (
              <tr key={pago._id} className="hover:bg-slate-50">
                <td className="p-4">
                  <div className="font-medium text-slate-800">{contrato.direccion}</div>
                  {contrato.fechas && <div className="mt-1 text-xs text-slate-500">{contrato.fechas}</div>}
                </td>
                <td className="p-4">{conceptoPago(pago)}</td>
                <td className="p-4">{periodoVisible(pago)}</td>
                <td className="p-4">{pago.fecha_vencimiento ? new Date(pago.fecha_vencimiento).toLocaleDateString() : '—'}</td>
                <td className="p-4 font-semibold">{formatMoneda(pago.monto_total)}</td>
                <td className="p-4"><StatBadge estado={pago.estado} /></td>
                <td className="p-4">
                  {obtenerComprobantes(pago).length ? (
                    <div className="flex flex-col gap-1">
                      {obtenerComprobantes(pago).map((_url, index) => (
                        <ComprobantePagoLink
                          key={`${pago._id}-${index}`}
                          token={token}
                          pagoId={pago._id}
                          indice={index}
                          label={`Comprobante ${index + 1}`}
                        />
                      ))}
                    </div>
                  ) : '—'}
                </td>
                <td className="p-4">
                  <button
                    type="button"
                    disabled={accionId === pago._id}
                    onClick={() => void confirmarCobro(pago)}
                    className={btnPrimaryClass}
                  >
                    {accionId === pago._id ? 'Confirmando...' : 'Confirmar'}
                  </button>
                </td>
              </tr>
              );
            }}
          />
        )}
      </section>}

      {mostrarConfirmados && <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
          {filtro === 'COBRADO_MES' ? 'Cobrado este mes' : 'Pagos confirmados'} ({filasConfirmadas.length})
        </h2>
        {cargando ? (
          <LoadingRow label="Cargando pagos confirmados..." />
        ) : filasConfirmadas.length === 0 && !error ? (
          <EmptyState
            title={filtro === 'COBRADO_MES' ? 'Sin cobros este mes' : 'Sin pagos confirmados'}
            description={filtro === 'COBRADO_MES'
              ? 'No hay pagos confirmados durante el mes actual.'
              : 'Los cobros confirmados aparecerán aquí.'}
          />
        ) : (
          <DataTable
            columns={['Contrato / propiedad', 'Concepto', 'Período', 'Fecha de pago', 'Importe', 'Estado', 'Comprobante']}
            rows={filasConfirmadas}
            renderRow={(pago) => {
              const contrato = identificadorContrato(pago);
              return (
              <tr key={pago._id} className="hover:bg-slate-50">
                <td className="p-4">
                  <div className="font-medium text-slate-800">{contrato.direccion}</div>
                  {contrato.fechas && <div className="mt-1 text-xs text-slate-500">{contrato.fechas}</div>}
                </td>
                <td className="p-4">{conceptoPago(pago)}</td>
                <td className="p-4">{periodoVisible(pago)}</td>
                <td className="p-4">{pago.fecha_pago ? new Date(pago.fecha_pago).toLocaleDateString() : '—'}</td>
                <td className="p-4 font-semibold">{formatMoneda(pago.monto_total)}</td>
                <td className="p-4"><StatBadge estado={pago.estado} /></td>
                <td className="p-4">
                  {obtenerComprobantes(pago).length ? (
                    <div className="flex flex-col gap-1">
                      {obtenerComprobantes(pago).map((_url, index) => (
                        <ComprobantePagoLink
                          key={`${pago._id}-${index}`}
                          token={token}
                          pagoId={pago._id}
                          indice={index}
                          label={`Ver ${index + 1}`}
                        />
                      ))}
                    </div>
                  ) : '—'}
                </td>
              </tr>
              );
            }}
          />
        )}
      </section>}

      <Card className="p-4">
        <p className="text-sm text-slate-600">
          Un pago pasa a estar para validar cuando el inquilino carga su comprobante. Confirmarlo lo mueve a pagos confirmados.
        </p>
      </Card>
    </div>
  );
}
