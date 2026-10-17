import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/apiClient';
import { subirArchivo } from '../../lib/cloudinary';
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
import type { ChangeEvent, FormEvent } from 'react';
import type { Gasto, Propiedad, PropiedadReferencia } from '../../types';

interface GastoForm {
  id_propiedad: string;
  fecha_emision: string;
  monto_total: string;
  tipo: string;
  estado_pago: string;
  proveedor: string;
  comprobantes: string[];
}

const FORM_INICIAL: GastoForm = {
  id_propiedad: '',
  fecha_emision: new Date().toISOString().slice(0, 10),
  monto_total: '',
  tipo: 'MANTENIMIENTO',
  estado_pago: 'PENDIENTE',
  proveedor: '',
  comprobantes: [],
};

const ESTADOS = ['TODOS', 'PENDIENTE', 'PAGADO', 'ATRASADO'];
const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

interface GastosPanelProps {
  token: string;
  esPropietario: boolean;
  esInquilino: boolean;
  esAdmin: boolean;
}

function propiedadDeGasto(gasto: Gasto): PropiedadReferencia | null {
  return typeof gasto.id_propiedad === 'object' ? gasto.id_propiedad : null;
}

function idPropiedadDeGasto(gasto: Gasto): string {
  return typeof gasto.id_propiedad === 'string' ? gasto.id_propiedad : gasto.id_propiedad?._id || '';
}

function fechaLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function mostrarFecha(fecha: string): string {
  if (!fecha) return '';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR').format(new Date(anio, mes - 1, dia));
}

function DateRangePicker({
  desde,
  hasta,
  onChange,
}: {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
}) {
  const hoy = new Date();
  const [abierto, setAbierto] = useState(false);
  const [mesVisible, setMesVisible] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const inicioMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
  const desplazamiento = (inicioMes.getDay() + 6) % 7;
  const dias = Array.from({ length: 42 }, (_, indice) =>
    new Date(mesVisible.getFullYear(), mesVisible.getMonth(), indice - desplazamiento + 1),
  );
  const etiqueta = desde && hasta
    ? `${mostrarFecha(desde)} – ${mostrarFecha(hasta)}`
    : desde
      ? `Desde ${mostrarFecha(desde)} – elegí hasta`
      : 'Seleccionar rango de fechas';

  const seleccionarFecha = (fecha: Date) => {
    const valor = fechaLocal(fecha);
    if (!desde || hasta || valor < desde) {
      onChange(valor, '');
      return;
    }
    onChange(desde, valor);
    setAbierto(false);
  };

  return (
    <div className="relative min-w-0">
      <span className="mb-1 block text-xs text-slate-500">Período de emisión</span>
      <button
        type="button"
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
        aria-label="Seleccionar rango de fechas"
        aria-expanded={abierto}
        onClick={() => setAbierto((actual) => !actual)}
      >
        <span className={desde ? 'text-slate-900' : 'text-slate-500'}>{etiqueta}</span>
        <span aria-hidden="true">▦</span>
      </button>
      {abierto && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:w-80">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
              aria-label="Mes anterior"
              onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <p className="font-semibold capitalize text-slate-800">
              {new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(mesVisible)}
            </p>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
              aria-label="Mes siguiente"
              onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
            {DIAS_SEMANA.map((dia) => <span key={dia} className="py-2">{dia}</span>)}
          </div>
          <div className="grid grid-cols-7 text-center text-sm">
            {dias.map((fecha) => {
              const valor = fechaLocal(fecha);
              const seleccionada = valor === desde || valor === hasta;
              const enRango = desde && hasta && valor > desde && valor < hasta;
              const otroMes = fecha.getMonth() !== mesVisible.getMonth();
              return (
                <button
                  key={valor}
                  type="button"
                  aria-label={mostrarFecha(valor)}
                  aria-pressed={seleccionada}
                  className={`my-0.5 h-9 rounded-lg ${
                    seleccionada
                      ? 'bg-emerald-500 font-semibold text-white'
                      : enRango
                        ? 'bg-emerald-50 text-emerald-800'
                        : otroMes
                          ? 'text-slate-300 hover:bg-slate-100'
                          : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => seleccionarFecha(fecha)}
                >
                  {fecha.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">
              {!desde ? 'Elegí la fecha inicial' : !hasta ? 'Elegí la fecha final' : etiqueta}
            </span>
            <button
              type="button"
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
              onClick={() => {
                onChange('', '');
                setAbierto(false);
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GastosPanel({ token, esPropietario, esInquilino, esAdmin }: GastosPanelProps) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroPropiedad, setFiltroPropiedad] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<GastoForm>(FORM_INICIAL);
  const [gastoEditando, setGastoEditando] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [accionId, setAccionId] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const puedeGestionar = esPropietario || esAdmin;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filtroPropiedad) params.set('id_propiedad', filtroPropiedad);
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      if (filtroEstado !== 'TODOS') params.set('estado_pago', filtroEstado);
      const queryString = params.toString();
      const query = queryString ? `?${queryString}` : '';
      const [gastosData, propiedadesData] = await Promise.all([
        apiGet<Gasto[]>(`/api/gastos${query}`, token),
        puedeGestionar ? apiGet<Propiedad[]>('/api/propiedades', token) : Promise.resolve([] as Propiedad[]),
      ]);
      if (!Array.isArray(gastosData) || !Array.isArray(propiedadesData)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }
      setGastos(gastosData);
      setPropiedades(propiedadesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los gastos.');
      setGastos([]);
      setPropiedades([]);
    } finally {
      setCargando(false);
    }
  }, [token, puedeGestionar, filtroPropiedad, desde, hasta, filtroEstado]);

  useEffect(() => {
    const timer = setTimeout(cargar, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const gastosFiltrados = gastos;

  const abrirNuevo = () => {
    setGastoEditando('');
    setForm({ ...FORM_INICIAL, id_propiedad: propiedades[0]?._id || '' });
    setModalAbierto(true);
  };

  const abrirEdicion = (gasto: Gasto) => {
    setGastoEditando(gasto._id);
    setForm({
      id_propiedad: idPropiedadDeGasto(gasto),
      fecha_emision: String(gasto.fecha_emision || '').slice(0, 10),
      monto_total: String(gasto.monto_total),
      tipo: gasto.tipo || 'MANTENIMIENTO',
      estado_pago: gasto.estado_pago || 'PENDIENTE',
      proveedor: gasto.proveedor || '',
      comprobantes: gasto.comprobantes || [],
    });
    setModalAbierto(true);
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setInfo('');
    const cuerpo = {
      fecha_emision: form.fecha_emision,
      monto_total: Number(form.monto_total),
      tipo: form.tipo.trim(),
      estado_pago: form.estado_pago,
      proveedor: form.proveedor.trim(),
      comprobantes: form.comprobantes,
    };
    try {
      if (gastoEditando) {
        await apiPut(`/api/gastos/${gastoEditando}`, token, cuerpo);
        setInfo('Gasto actualizado.');
      } else {
        await apiPost('/api/gastos', token, { ...cuerpo, id_propiedad: form.id_propiedad });
        setInfo('Gasto registrado.');
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el gasto.');
    } finally {
      setGuardando(false);
    }
  };

  const subirComprobante = async (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    try {
      const url = await subirArchivo(archivo, 'gastos', { permitirPdf: true });
      setForm((actual) => ({ ...actual, comprobantes: [...actual.comprobantes, url] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el comprobante.');
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async (gasto: Gasto) => {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    setAccionId(gasto._id);
    setError('');
    setInfo('');
    try {
      await apiDelete(`/api/gastos/${gasto._id}`, token);
      setInfo('Gasto eliminado.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el gasto.');
    } finally {
      setAccionId('');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gastos"
        subtitle="Consultá los gastos asociados a tus propiedades y sus comprobantes"
        action={puedeGestionar ? (
          <button type="button" onClick={abrirNuevo} className={btnPrimaryClass}>+ Nuevo gasto</button>
        ) : null}
      />
      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="success" onClose={() => setInfo('')}>{info}</Alert>}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <p className="text-sm text-slate-600">
          {esInquilino && !puedeGestionar
            ? 'Consulta de gastos de propiedades con contrato vigente.'
            : 'Filtrá por estado y período de emisión.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            aria-label="Filtrar gastos por propiedad"
            className={inputClass}
            value={filtroPropiedad}
            onChange={(event) => setFiltroPropiedad(event.target.value)}
          >
            <option value="">Todas las propiedades</option>
            {propiedades.map((propiedad) => (
              <option key={propiedad._id} value={propiedad._id}>{propiedad.direccion}</option>
            ))}
            {!puedeGestionar && [...new Map(gastos.map((gasto) => [
              idPropiedadDeGasto(gasto),
              propiedadDeGasto(gasto),
            ])).values()].map((propiedad) => propiedad && (
              <option key={propiedad._id} value={propiedad._id}>{propiedad.direccion || propiedad._id}</option>
            ))}
          </select>
          <select
            className={inputClass}
            value={filtroEstado}
            onChange={(event) => setFiltroEstado(event.target.value)}
            aria-label="Filtrar gastos por estado"
          >
            {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
          </select>
          <DateRangePicker desde={desde} hasta={hasta} onChange={(inicio, fin) => {
            setDesde(inicio);
            setHasta(fin);
          }} />
        </div>
      </Card>
      {cargando ? (
        <LoadingRow label="Cargando gastos..." />
      ) : gastosFiltrados.length === 0 ? (
        <EmptyState title="Sin gastos" description="No hay gastos para los filtros seleccionados." />
      ) : (
        <DataTable
          columns={['Propiedad', 'Tipo', 'Emisión', 'Proveedor', 'Importe', 'Estado', 'Comprobantes', ...(puedeGestionar ? ['Acciones'] : [])]}
          rows={gastosFiltrados}
          renderRow={(gasto) => (
            <tr key={gasto._id} className="hover:bg-slate-50">
              <td className="p-4">{propiedadDeGasto(gasto)?.direccion || '—'}</td>
              <td className="p-4">{gasto.tipo}</td>
              <td className="p-4">{String(gasto.fecha_emision || '').slice(0, 10)}</td>
              <td className="p-4">{gasto.proveedor || '—'}</td>
              <td className="p-4 font-semibold">{formatMoneda(gasto.monto_total)}</td>
              <td className="p-4"><StatBadge estado={gasto.estado_pago} /></td>
              <td className="p-4">
                {(gasto.comprobantes || []).length
                  ? gasto.comprobantes.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-2 text-emerald-700 underline">
                      Ver {index + 1}
                    </a>
                  ))
                  : '—'}
              </td>
              {puedeGestionar && (
                <td className="p-4 whitespace-nowrap">
                  <button type="button" onClick={() => abrirEdicion(gasto)} className={btnGhostClass}>Editar</button>
                  <button type="button" disabled={accionId === gasto._id} onClick={() => eliminar(gasto)} className="px-2 py-2 text-sm text-red-600 disabled:opacity-50">
                    {accionId === gasto._id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </td>
              )}
            </tr>
          )}
        />
      )}
      <Modal open={modalAbierto} title={gastoEditando ? 'Editar gasto' : 'Nuevo gasto'} onClose={() => setModalAbierto(false)}>
        <form onSubmit={guardar} className="space-y-4">
          {!gastoEditando && (
            <div>
              <label className={labelClass}>Propiedad</label>
              <select required className={inputClass} value={form.id_propiedad} onChange={(event) => setForm({ ...form, id_propiedad: event.target.value })}>
                <option value="">Seleccionar...</option>
                {propiedades.filter((propiedad) => propiedad.estado !== 'INACTIVA').map((propiedad) => (
                  <option key={propiedad._id} value={propiedad._id}>{propiedad.direccion}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Fecha de emisión</label>
              <input type="date" required className={inputClass} value={form.fecha_emision} onChange={(event) => setForm({ ...form, fecha_emision: event.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Importe total</label>
              <input type="number" min="0" step="0.01" required className={inputClass} value={form.monto_total} onChange={(event) => setForm({ ...form, monto_total: event.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tipo</label>
              <input required maxLength={80} className={inputClass} value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Estado de pago</label>
              <select className={inputClass} value={form.estado_pago} onChange={(event) => setForm({ ...form, estado_pago: event.target.value })}>
                {ESTADOS.slice(1).map((estado) => <option key={estado} value={estado}>{estado}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Proveedor</label>
            <input maxLength={120} className={inputClass} value={form.proveedor} onChange={(event) => setForm({ ...form, proveedor: event.target.value })} />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Comprobantes</label>
            {form.comprobantes.map((url, index) => (
              <div key={url} className="flex items-center gap-3 text-sm">
                <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-emerald-700 underline">Comprobante {index + 1}</a>
                <button type="button" onClick={() => setForm({ ...form, comprobantes: form.comprobantes.filter((_, i) => i !== index) })} className="text-red-600">Quitar</button>
              </div>
            ))}
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={subiendo} onChange={subirComprobante} className={inputClass} />
            <p className="text-xs text-slate-500">{subiendo ? 'Subiendo comprobante...' : 'JPG, PNG, WEBP o PDF · máximo 5 MB'}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalAbierto(false)} className={btnGhostClass}>Cancelar</button>
            <button type="submit" disabled={guardando || subiendo} className={btnPrimaryClass}>
              {guardando ? 'Guardando...' : 'Guardar gasto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
