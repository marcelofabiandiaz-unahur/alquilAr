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
import type { Pago } from '../../types';

interface CobrosPanelProps {
  token: string;
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

export default function CobrosPanel({ token }: CobrosPanelProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [accionId, setAccionId] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiGet<Pago[]>('/api/pagos', token);
      if (!Array.isArray(data)) throw new Error('El backend devolvió una respuesta inesperada.');
      setPagos(data);
    } catch (err) {
      setPagos([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los cobros.');
    } finally {
      setCargando(false);
    }
  }, [token]);

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

  return (
    <div className="space-y-6">
      <PageHeader title="Cobros" subtitle="Revisá los comprobantes enviados y confirmá los pagos recibidos" />
      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="success" onClose={() => setInfo('')}>{info}</Alert>}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Cobros para validar ({porValidar.length})
        </h2>
        {cargando ? (
          <LoadingRow label="Cargando cobros..." />
        ) : porValidar.length === 0 ? (
          <EmptyState title="Sin cobros para validar" description="Los comprobantes enviados por los inquilinos aparecerán aquí." />
        ) : (
          <DataTable
            columns={['Concepto', 'Período', 'Vencimiento', 'Importe', 'Estado', 'Comprobante', 'Acción']}
            rows={porValidar}
            renderRow={(pago) => (
              <tr key={pago._id} className="hover:bg-slate-50">
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
            )}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Pagos confirmados ({confirmados.length})
        </h2>
        {cargando ? (
          <LoadingRow label="Cargando pagos confirmados..." />
        ) : confirmados.length === 0 ? (
          <EmptyState title="Sin pagos confirmados" description="Los cobros confirmados aparecerán aquí." />
        ) : (
          <DataTable
            columns={['Concepto', 'Período', 'Fecha de pago', 'Importe', 'Estado', 'Comprobante']}
            rows={confirmados}
            renderRow={(pago) => (
              <tr key={pago._id} className="hover:bg-slate-50">
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
            )}
          />
        )}
      </section>

      <Card className="p-4">
        <p className="text-sm text-slate-600">
          Un pago pasa a estar para validar cuando el inquilino carga su comprobante. Confirmarlo lo mueve a pagos confirmados.
        </p>
      </Card>
    </div>
  );
}
