import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/apiClient';
import { formatMoneda } from '../../lib/estadoStyles';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import LoadingRow from '../ui/LoadingRow';
import Alert from '../ui/Alert';
import StatBadge from '../ui/StatBadge';
import Modal from '../ui/Modal';
import { btnPrimaryClass, btnGhostClass, inputClass, labelClass } from '../layout/dashboardStyles';
import type { FormEvent } from 'react';
import type { Contrato, Pago } from '../../types';

const PERIODO_INICIAL = new Date().toISOString().slice(0, 7);

function contratoLabel(contrato: string | Contrato): string {
  if (typeof contrato === 'string') return contrato;
  const propiedad = contrato?.id_propiedad;
  const direccion = typeof propiedad === 'object' ? propiedad?.direccion : '';
  const inquilino = contrato.id_inquilino;
  const email = typeof inquilino === 'object' ? inquilino.email : '';
  return `${direccion || 'Propiedad'} · ${email || contrato._id}`;
}

interface PagosPanelProps {
  token: string;
  esPropietario: boolean;
  esInquilino: boolean;
  esAdmin: boolean;
}

export default function PagosPanel({ token, esPropietario, esInquilino, esAdmin }: PagosPanelProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [accionId, setAccionId] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [contratoSeleccionado, setContratoSeleccionado] = useState('');
  const [periodo, setPeriodo] = useState(PERIODO_INICIAL);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [pagosData, contratosData] = await Promise.all([
        apiGet<Pago[]>('/api/pagos', token),
        apiGet<Contrato[]>('/api/contratos', token),
      ]);
      if (!Array.isArray(pagosData) || !Array.isArray(contratosData)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }
      setPagos(pagosData);
      setContratos(contratosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pagos.');
      setPagos([]);
      setContratos([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(cargar, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const crearPago = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setInfo('');
    try {
      await apiPost('/api/pagos', token, {
        id_contrato: contratoSeleccionado,
        mes_correspondiente: periodo,
      });
      setModalAbierto(false);
      setInfo('Pago registrado para el contrato y período seleccionados.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pago.');
    } finally {
      setGuardando(false);
    }
  };

  const cargarComprobante = async (pago: Pago) => {
    const comprobante = window.prompt('Pegá la URL HTTPS del comprobante de pago:');
    if (comprobante === null) return;
    setAccionId(pago._id);
    setError('');
    setInfo('');
    try {
      await apiPatch(`/api/pagos/${pago._id}/comprobante`, token, { comprobante_url: comprobante.trim() });
      setInfo('Comprobante enviado para revisión.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el comprobante.');
    } finally {
      setAccionId('');
    }
  };

  const confirmarPago = async (pago: Pago) => {
    setAccionId(pago._id);
    setError('');
    setInfo('');
    try {
      await apiPatch(`/api/pagos/${pago._id}/confirmar`, token, {});
      setInfo('Pago confirmado.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el pago.');
    } finally {
      setAccionId('');
    }
  };

  const eliminarPago = async (pago: Pago) => {
    if (!window.confirm('¿Eliminar este pago pendiente?')) return;
    setAccionId(pago._id);
    setError('');
    setInfo('');
    try {
      await apiDelete(`/api/pagos/${pago._id}`, token);
      setInfo('Pago eliminado.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el pago.');
    } finally {
      setAccionId('');
    }
  };

  const puedeRegistrar = esPropietario || esAdmin;
  const puedeSubir = esInquilino;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pagos"
        subtitle="Consultá vencimientos, registrá períodos y seguí los comprobantes"
        action={puedeRegistrar ? (
          <button type="button" onClick={() => setModalAbierto(true)} className={btnPrimaryClass}>
            + Registrar pago
          </button>
        ) : null}
      />
      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="success" onClose={() => setInfo('')}>{info}</Alert>}
      <Card className="p-4">
        <p className="text-sm text-slate-600">
          Los importes y vencimientos se calculan desde el contrato vigente; el período se registra con formato AAAA-MM.
        </p>
      </Card>
      {cargando ? (
        <LoadingRow label="Cargando pagos..." />
      ) : pagos.length === 0 ? (
        <EmptyState title="Sin pagos" description="Todavía no hay pagos asociados a tus contratos." />
      ) : (
        <DataTable
          columns={['Contrato', 'Período', 'Vencimiento', 'Importe', 'Estado', 'Comprobante', 'Acciones']}
          rows={pagos}
          renderRow={(pago) => (
            <tr key={pago._id} className="hover:bg-slate-50">
              <td className="p-4">{contratoLabel(pago.id_contrato)}</td>
              <td className="p-4">{pago.mes_correspondiente}</td>
              <td className="p-4">{pago.fecha_vencimiento ? new Date(pago.fecha_vencimiento).toLocaleDateString() : '—'}</td>
              <td className="p-4 font-semibold">{formatMoneda(pago.monto_total)}</td>
              <td className="p-4"><StatBadge estado={pago.estado} /></td>
              <td className="p-4">
                {pago.comprobante_url ? (
                  <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">Ver</a>
                ) : '—'}
              </td>
              <td className="p-4">
                {puedeSubir && pago.estado !== 'PAGADO' && (
                  <button type="button" disabled={accionId === pago._id} onClick={() => cargarComprobante(pago)} className={btnGhostClass}>
                    {accionId === pago._id ? 'Enviando...' : 'Cargar comprobante'}
                  </button>
                )}
                {puedeRegistrar && pago.estado !== 'PAGADO' && (
                  <div className="flex flex-wrap gap-1">
                    <button type="button" disabled={accionId === pago._id} onClick={() => confirmarPago(pago)} className={btnPrimaryClass}>
                      {accionId === pago._id ? 'Guardando...' : 'Confirmar'}
                    </button>
                    <button type="button" disabled={accionId === pago._id} onClick={() => eliminarPago(pago)} className="px-2 py-2 text-xs text-red-600 disabled:opacity-50">
                      Eliminar
                    </button>
                  </div>
                )}
              </td>
            </tr>
          )}
        />
      )}
      <Modal open={modalAbierto} title="Registrar pago mensual" onClose={() => setModalAbierto(false)}>
        <form onSubmit={crearPago} className="space-y-4">
          <div>
            <label className={labelClass}>Contrato</label>
            <select required value={contratoSeleccionado} onChange={(event) => setContratoSeleccionado(event.target.value)} className={inputClass}>
              <option value="">Seleccionar contrato vigente...</option>
              {contratos.filter((contrato) => contrato.estado === 'VIGENTE').map((contrato) => (
                <option key={contrato._id} value={contrato._id}>{contratoLabel(contrato)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Mes correspondiente</label>
            <input type="month" required value={periodo} onChange={(event) => setPeriodo(event.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalAbierto(false)} className={btnGhostClass}>Cancelar</button>
            <button type="submit" disabled={guardando || !contratoSeleccionado} className={btnPrimaryClass}>
              {guardando ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
