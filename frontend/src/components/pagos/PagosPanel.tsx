import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiUploadMany } from '../../lib/apiClient';
import { formatMoneda } from '../../lib/estadoStyles';
import PageHeader from '../ui/PageHeader';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import LoadingRow from '../ui/LoadingRow';
import Alert from '../ui/Alert';
import StatBadge from '../ui/StatBadge';
import Modal from '../ui/Modal';
import ComprobantePagoLink from './ComprobantePagoLink';
import { btnPrimaryClass, btnGhostClass, inputClass, labelClass } from '../layout/dashboardStyles';
import { conAgrupamiento } from '../../lib/agrupamientos';
import type { FormEvent } from 'react';
import type {
  Contrato,
  FiltroContratosPagos,
  FiltroPagos,
  Pago,
} from '../../types';

interface DatosBancariosPropietario {
  cbu_alias?: string;
  cuit_cuil?: string;
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

function fechaContratoVisible(fecha?: string): string {
  if (!fecha) return '';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return '';
  return new Intl.DateTimeFormat('es-AR').format(new Date(anio, mes - 1, dia));
}

function identificadorContrato(pago: Pago): { direccion: string; periodo: string } {
  if (!pago.id_contrato || typeof pago.id_contrato === 'string') {
    return { direccion: 'Contrato', periodo: '' };
  }
  const propiedad = pago.id_contrato.id_propiedad;
  const direccion = typeof propiedad === 'object' ? propiedad.direccion || 'Contrato' : 'Contrato';
  const inicio = fechaContratoVisible(pago.id_contrato.fecha_inicio);
  const fin = fechaContratoVisible(pago.id_contrato.fecha_fin);
  const periodo = inicio || fin ? `${inicio || '—'} – ${fin || 'Sin fecha de fin'}` : '';
  return { direccion, periodo };
}

interface GrupoPagosContrato {
  contrato: Contrato;
  pagos: Pago[];
}

function agruparPagosPorContrato(pagos: Pago[], estado: 'VIGENTE' | 'FINALIZADO'): GrupoPagosContrato[] {
  const grupos = new Map<string, GrupoPagosContrato>();
  for (const pago of pagos) {
    if (!pago.id_contrato || typeof pago.id_contrato === 'string') continue;
    const contrato = pago.id_contrato;
    if (contrato.estado !== estado) continue;

    const grupo = grupos.get(contrato._id);
    if (grupo) {
      grupo.pagos.push(pago);
    } else {
      grupos.set(contrato._id, { contrato, pagos: [pago] });
    }
  }
  return [...grupos.values()];
}

function obtenerDatosBancarios(pago: Pago): DatosBancariosPropietario | null {
  if (typeof pago.id_contrato !== 'object') return null;
  const propiedad = pago.id_contrato.id_propiedad;
  if (typeof propiedad !== 'object') return null;
  const propietario = propiedad.id_propietario;
  return propietario && typeof propietario === 'object' ? propietario : null;
}

interface PagosPanelProps {
  token: string;
  esPropietario: boolean;
  esInquilino: boolean;
  esAdmin: boolean;
  idAgrupamiento?: string;
  filtro: FiltroPagos;
  setFiltro: (filtro: FiltroPagos) => void;
}

export default function PagosPanel({
  token,
  esPropietario,
  esInquilino,
  esAdmin,
  idAgrupamiento = '',
  filtro,
  setFiltro,
}: PagosPanelProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [filtroContrato, setFiltroContrato] = useState<FiltroContratosPagos>('VIGENTE');
  const [cargando, setCargando] = useState(true);
  const [accionId, setAccionId] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pagoEditandoComprobantes, setPagoEditandoComprobantes] = useState<Pago | null>(null);
  const [pagoVerCBU, setPagoVerCBU] = useState<Pago | null>(null);
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<File[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const pagosData = await apiGet<Pago[]>(
        conAgrupamiento('/api/pagos', idAgrupamiento),
        token,
      );
      if (!Array.isArray(pagosData)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }
      setPagos(pagosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pagos.');
      setPagos([]);
    } finally {
      setCargando(false);
    }
  }, [token, idAgrupamiento]);

  useEffect(() => {
    const timer = setTimeout(cargar, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const cargarComprobante = async (pago: Pago) => {
    setError('');
    setInfo('');
    setArchivosSeleccionados([]);
    setPagoEditandoComprobantes(pago);
  };

  const subirComprobantes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pagoEditandoComprobantes || archivosSeleccionados.length === 0) return;
    const existentes = obtenerComprobantes(pagoEditandoComprobantes);
    if (existentes.length + archivosSeleccionados.length > 5) {
      setError('Se permiten hasta 5 comprobantes por pago.');
      return;
    }
    setAccionId(pagoEditandoComprobantes._id);
    setError('');
    setInfo('');
    try {
      await apiUploadMany<{ comprobantes: string[] }>(
        `/api/pagos/${pagoEditandoComprobantes._id}/comprobantes`,
        token,
        archivosSeleccionados,
      );
      setPagoEditandoComprobantes(null);
      setArchivosSeleccionados([]);
      setInfo('Comprobantes enviados para revisión.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron enviar los comprobantes.');
    } finally {
      setAccionId('');
    }
  };

  const quitarComprobante = async (pago: Pago, url: string) => {
    setAccionId(pago._id);
    setError('');
    setInfo('');
    try {
      const actualizado = await apiDelete<Pago & { advertencia?: string }>(
        `/api/pagos/${pago._id}/comprobantes`,
        token,
        { comprobante_url: url },
      );
      setInfo(actualizado.advertencia || 'Comprobante quitado del pago.');
      setPagoEditandoComprobantes(actualizado);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar el comprobante.');
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

  const puedeSubir = esInquilino;
  const ordenarPorVencimiento = (lista: Pago[]) => [...lista].sort((a, b) => {
    const vencimientoA = new Date(a.fecha_vencimiento).getTime();
    const vencimientoB = new Date(b.fecha_vencimiento).getTime();
    if (Number.isNaN(vencimientoA)) return Number.isNaN(vencimientoB) ? 0 : 1;
    if (Number.isNaN(vencimientoB)) return -1;
    return vencimientoA - vencimientoB;
  });
  const pagosFiltrados = filtro === 'TODOS'
    ? pagos
    : pagos.filter((pago) => pago.estado === filtro);
  const contratosVisibles = agruparPagosPorContrato(pagosFiltrados, filtroContrato);
  const cantidadPagosVisibles = contratosVisibles
    .reduce((total, grupo) => total + grupo.pagos.length, 0);
  const nombreFiltro: Record<FiltroPagos, string> = {
    TODOS: 'Todos los pagos',
    PENDIENTE: 'Pendientes',
    ATRASADO: 'Vencidos',
    PAGADO: 'Pagados',
  };
  const estadoContratoVisible = filtroContrato === 'VIGENTE' ? 'vigentes' : 'finalizados';
  const descripcionSinPagos = filtro === 'TODOS'
    ? `No hay pagos asociados a contratos ${estadoContratoVisible}.`
    : `No hay pagos ${nombreFiltro[filtro].toLowerCase()} en contratos ${estadoContratoVisible}.`;
  const datosBancariosPago = pagoVerCBU ? obtenerDatosBancarios(pagoVerCBU) : null;
  const renderTabla = (lista: Pago[]) => (
    <DataTable
      columns={['Concepto', 'Período', 'Vencimiento', 'Importe', 'Estado', 'Comprobante', 'Acciones']}
      rows={lista}
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
            {puedeSubir && pago.estado !== 'PAGADO' && (
              <button type="button" disabled={accionId === pago._id} onClick={() => cargarComprobante(pago)} className={btnGhostClass}>
                {obtenerComprobantes(pago).length ? 'Editar comprobantes' : 'Informar pago'}
              </button>
            )}
            {esPropietario || esAdmin ? (
              pago.estado === 'INGRESADO' && (
                <div className="flex flex-wrap gap-1">
                  <button type="button" disabled={accionId === pago._id} onClick={() => confirmarPago(pago)} className={btnPrimaryClass}>
                    {accionId === pago._id ? 'Guardando...' : 'Confirmar'}
                  </button>
                  <button type="button" disabled={accionId === pago._id} onClick={() => eliminarPago(pago)} className="px-2 py-2 text-xs text-red-600 disabled:opacity-50">
                    Eliminar
                  </button>
                </div>
              )
            ) : null}
          </td>
        </tr>
      )}
    />
  );
  const renderGrupoContrato = (grupo: GrupoPagosContrato) => {
    const pagoReferencia = grupo.pagos[0];
    const { direccion, periodo } = identificadorContrato(pagoReferencia);
    const encabezado = (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-[var(--brand-navy)]">{direccion}</h3>
          {periodo && <p className="mt-1 text-xs text-slate-500">Contrato: {periodo}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {grupo.pagos.length} {grupo.pagos.length === 1 ? 'cuota' : 'cuotas'}
          </p>
        </div>
        {puedeSubir && (
          <button type="button" onClick={() => setPagoVerCBU(pagoReferencia)} className={btnGhostClass}>
            Ver CBU
          </button>
        )}
      </div>
    );
    const tabla = renderTabla(ordenarPorVencimiento(grupo.pagos));

    return (
      <section key={grupo.contrato._id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        {encabezado}
        {tabla}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pagos"
        subtitle={puedeSubir
          ? 'Consultá tus cuotas, vencimientos e informá tus pagos'
          : 'Consultá las cuotas y vencimientos generados desde los contratos'}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar pagos">
          {(['TODOS', 'PENDIENTE', 'ATRASADO', 'PAGADO'] as FiltroPagos[]).map((opcion) => (
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
              {nombreFiltro[opcion]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2" role="group" aria-label="Filtrar por estado del contrato">
          <span className="text-sm font-medium text-slate-600">Contrato</span>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
            {(['VIGENTE', 'FINALIZADO'] as FiltroContratosPagos[]).map((opcion) => (
              <button
                key={opcion}
                type="button"
                aria-pressed={filtroContrato === opcion}
                onClick={() => setFiltroContrato(opcion)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
                  filtroContrato === opcion
                    ? 'bg-white text-violet-800 shadow-sm ring-1 ring-slate-200/70'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {opcion === 'VIGENTE' ? 'Vigentes' : 'Finalizados'}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="success" onClose={() => setInfo('')}>{info}</Alert>}
      {cargando ? (
        <LoadingRow label="Cargando pagos..." />
      ) : cantidadPagosVisibles === 0 && !error ? (
        <EmptyState title="Sin pagos" description={descripcionSinPagos} />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">
              Contratos {filtroContrato === 'VIGENTE' ? 'vigentes' : 'finalizados'}
            </h2>
            {contratosVisibles.length > 0 ? (
              <div className="space-y-4">
                {contratosVisibles.map((grupo) => renderGrupoContrato(grupo))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {descripcionSinPagos}
              </p>
            )}
          </section>
        </div>
      )}
      <Modal open={Boolean(pagoVerCBU)} title="Datos para transferir" onClose={() => setPagoVerCBU(null)}>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-slate-600">Alias / CBU</dt>
            <dd className="mt-1 text-slate-900">{datosBancariosPago?.cbu_alias || 'No informado'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">CUIT / CUIL</dt>
            <dd className="mt-1 text-slate-900">{datosBancariosPago?.cuit_cuil || 'No informado'}</dd>
          </div>
        </dl>
      </Modal>
      <Modal
        open={Boolean(pagoEditandoComprobantes)}
        title="Informar pago y comprobantes"
        onClose={() => {
          if (!accionId) {
            setPagoEditandoComprobantes(null);
            setArchivosSeleccionados([]);
          }
        }}
      >
        {pagoEditandoComprobantes && (
          <form onSubmit={subirComprobantes} className="space-y-4">
            <p className="text-sm text-slate-600">
              Podés adjuntar hasta 5 archivos PDF, JPG, PNG o WEBP (máximo 5 MB cada uno). Podrás editar los comprobantes hasta que el propietario confirme el pago.
            </p>
            {obtenerComprobantes(pagoEditandoComprobantes).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Comprobantes cargados</h3>
                {obtenerComprobantes(pagoEditandoComprobantes).map((url, index) => (
                  <div key={`${url}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                    <ComprobantePagoLink
                      token={token}
                      pagoId={pagoEditandoComprobantes._id}
                      indice={index}
                      label={`Comprobante ${index + 1}`}
                    />
                    <button
                      type="button"
                      disabled={Boolean(accionId)}
                      onClick={() => void quitarComprobante(pagoEditandoComprobantes, url)}
                      className="shrink-0 text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label htmlFor="comprobantes-pago" className={labelClass}>Agregar archivos</label>
              <input
                id="comprobantes-pago"
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={Boolean(accionId)}
                className={inputClass}
                onChange={(event) => {
                  const nuevos = Array.from(event.target.files || []);
                  const total = obtenerComprobantes(pagoEditandoComprobantes).length
                    + archivosSeleccionados.length
                    + nuevos.length;
                  const invalidos = nuevos.filter((file) =>
                    !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)
                    || file.size > 5 * 1024 * 1024);
                  if (invalidos.length > 0) {
                    setError('Cada archivo debe ser PDF, JPG, PNG o WEBP y pesar hasta 5 MB.');
                  } else if (total > 5) {
                    setError('Se permiten hasta 5 comprobantes por pago.');
                  } else {
                    setError('');
                    setArchivosSeleccionados((actuales) => [...actuales, ...nuevos]);
                  }
                  event.target.value = '';
                }}
              />
            </div>
            {archivosSeleccionados.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Nuevos archivos</h3>
                {archivosSeleccionados.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 text-sm text-slate-600">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setArchivosSeleccionados((actuales) => actuales.filter((_, i) => i !== index))}
                      className="shrink-0 text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={btnGhostClass}
                disabled={Boolean(accionId)}
                onClick={() => {
                  setPagoEditandoComprobantes(null);
                  setArchivosSeleccionados([]);
                }}
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={Boolean(accionId) || archivosSeleccionados.length === 0}
                className={btnPrimaryClass}
              >
                {accionId ? 'Subiendo...' : 'Cargar comprobantes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
