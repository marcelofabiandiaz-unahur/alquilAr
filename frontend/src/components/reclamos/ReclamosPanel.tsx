import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch, apiPost } from '../../lib/apiClient';
import PageHeader from '../ui/PageHeader';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import LoadingRow from '../ui/LoadingRow';
import Alert from '../ui/Alert';
import StatBadge from '../ui/StatBadge';
import Modal from '../ui/Modal';
import { btnPrimaryClass, btnGhostClass, inputClass, labelClass } from '../layout/dashboardStyles';
import { CATEGORIAS_RECLAMO, PRIORIDADES_RECLAMO } from '../../lib/reclamoOpciones';
import type { CategoriaReclamo, PrioridadReclamo } from '../../lib/reclamoOpciones';
import { conAgrupamiento } from '../../lib/agrupamientos';
import type { FormEvent } from 'react';
import type { Contrato, FiltroReclamos, Reclamo } from '../../types';

interface ReclamoForm {
  id_contrato: string;
  asunto: string;
  descripcion: string;
  categoria: CategoriaReclamo;
  prioridad: PrioridadReclamo;
}

const FORM_INICIAL: ReclamoForm = { id_contrato: '', asunto: '', descripcion: '', categoria: 'MANTENIMIENTO', prioridad: 'MEDIA' };
const ESTADOS = ['PENDIENTE', 'EN_PROCESO', 'RESUELTO'];

function direccion(reclamo: Reclamo): string {
  const propiedad = reclamo.id_propiedad;
  if (typeof propiedad === 'object' && propiedad.direccion) return propiedad.direccion;
  const contrato = reclamo.id_contrato;
  if (typeof contrato === 'object' && typeof contrato.id_propiedad === 'object') {
    return contrato.id_propiedad.direccion || '—';
  }
  return '—';
}

interface ReclamosPanelProps {
  token: string;
  esPropietario: boolean;
  esInquilino: boolean;
  esAdmin: boolean;
  idAgrupamiento?: string;
  filtro: FiltroReclamos;
  setFiltro: (filtro: FiltroReclamos) => void;
}

export default function ReclamosPanel({
  token,
  esPropietario,
  esInquilino,
  esAdmin,
  idAgrupamiento = '',
  filtro,
  setFiltro,
}: ReclamosPanelProps) {
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [accionId, setAccionId] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<ReclamoForm>(FORM_INICIAL);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [reclamosData, contratosData] = await Promise.all([
        apiGet<Reclamo[]>(conAgrupamiento('/api/reclamos', idAgrupamiento), token),
        esInquilino
          ? apiGet<Contrato[]>(conAgrupamiento('/api/contratos', idAgrupamiento), token)
          : Promise.resolve([] as Contrato[]),
      ]);
      if (!Array.isArray(reclamosData) || !Array.isArray(contratosData)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }
      setReclamos(reclamosData);
      setContratos(contratosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los reclamos.');
      setReclamos([]);
      setContratos([]);
    } finally {
      setCargando(false);
    }
  }, [token, esInquilino, idAgrupamiento]);

  useEffect(() => {
    const timer = setTimeout(cargar, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const crear = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setInfo('');
    try {
      await apiPost('/api/reclamos', token, form);
      setForm(FORM_INICIAL);
      setModalAbierto(false);
      setInfo('Reclamo registrado.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el reclamo.');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (reclamo: Reclamo, estado: string) => {
    setAccionId(reclamo._id);
    setError('');
    setInfo('');
    try {
      await apiPatch(`/api/reclamos/${reclamo._id}/estado`, token, { estado });
      setInfo('Estado del reclamo actualizado.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el reclamo.');
    } finally {
      setAccionId('');
    }
  };

  const puedeGestionar = esPropietario || esAdmin;
  const puedeCrear = esInquilino;
  const reclamosFiltrados = reclamos.filter((reclamo) => {
    if (filtro === 'TODOS') return true;
    if (filtro === 'ABIERTOS') return reclamo.estado !== 'RESUELTO' && reclamo.estado !== 'CANCELADO';
    return reclamo.estado === 'RESUELTO' || reclamo.estado === 'CANCELADO';
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reclamos"
        subtitle="Reportá incidencias del contrato y seguí su resolución"
        action={puedeCrear ? (
          <button type="button" onClick={() => setModalAbierto(true)} className={btnPrimaryClass}>+ Nuevo reclamo</button>
        ) : null}
      />
      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="success" onClose={() => setInfo('')}>{info}</Alert>}
      <div className="inline-flex max-w-full flex-wrap rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner" role="group" aria-label="Filtrar reclamos">
        {(['TODOS', 'ABIERTOS', 'RESUELTOS'] as FiltroReclamos[]).map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={filtro === opcion}
            onClick={() => setFiltro(opcion)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
              filtro === opcion
                ? 'bg-white text-violet-800 shadow-sm ring-1 ring-slate-200/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {opcion === 'TODOS' ? 'Todos' : opcion === 'ABIERTOS' ? 'Abiertos' : 'Cerrados'}
          </button>
        ))}
      </div>
      {cargando ? (
        <LoadingRow label="Cargando reclamos..." />
      ) : reclamos.length === 0 && !error ? (
        <EmptyState title="Sin reclamos" description="No hay reclamos disponibles para tu cuenta." />
      ) : (
      reclamosFiltrados.length === 0 ? (
        <EmptyState title="Sin reclamos en este estado" description="No hay reclamos que coincidan con el filtro seleccionado." />
      ) : <DataTable
        columns={['Propiedad', 'Asunto', 'Categoría', 'Prioridad', 'Creado', 'Estado', 'Acciones']}
        rows={reclamosFiltrados}
          renderRow={(reclamo) => (
            <tr key={reclamo._id} className="hover:bg-slate-50">
              <td className="p-4">{direccion(reclamo)}</td>
              <td className="p-4">
                <p className="font-medium">{reclamo.asunto}</p>
                <p className="text-xs text-slate-500 max-w-xs truncate">{reclamo.descripcion}</p>
              </td>
              <td className="p-4">{reclamo.categoria}</td>
              <td className="p-4">{reclamo.prioridad}</td>
              <td className="p-4">{reclamo.fecha_creacion ? new Date(reclamo.fecha_creacion).toLocaleDateString() : '—'}</td>
              <td className="p-4"><StatBadge estado={reclamo.estado} /></td>
              <td className="p-4">
                {puedeGestionar && reclamo.estado !== 'RESUELTO' && (
                  <select
                    aria-label={`Actualizar estado de ${reclamo.asunto}`}
                    disabled={accionId === reclamo._id}
                    value={reclamo.estado}
                    onChange={(event) => cambiarEstado(reclamo, event.target.value)}
                    className={inputClass}
                  >
                    {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                )}
              </td>
            </tr>
          )}
        />
      )}
      <Modal open={modalAbierto} title="Nuevo reclamo" onClose={() => setModalAbierto(false)}>
        <form onSubmit={crear} className="space-y-4">
          <div>
            <label className={labelClass}>Contrato vigente</label>
            <select required value={form.id_contrato} onChange={(event) => setForm({ ...form, id_contrato: event.target.value })} className={inputClass}>
              <option value="">Seleccionar...</option>
              {contratos.filter((contrato) => contrato.estado === 'VIGENTE').map((contrato) => (
                <option key={contrato._id} value={contrato._id}>
                  {(typeof contrato.id_propiedad === 'object' ? contrato.id_propiedad.direccion : '') || contrato._id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Asunto</label>
            <input required maxLength={120} value={form.asunto} onChange={(event) => setForm({ ...form, asunto: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea required maxLength={3000} rows={4} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Categoría</label>
              <select value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value as CategoriaReclamo })} className={inputClass}>
                {CATEGORIAS_RECLAMO.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Prioridad</label>
              <select value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value as PrioridadReclamo })} className={inputClass}>
                {PRIORIDADES_RECLAMO.map((prioridad) => <option key={prioridad} value={prioridad}>{prioridad}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalAbierto(false)} className={btnGhostClass}>Cancelar</button>
            <button type="submit" disabled={guardando || !form.id_contrato} className={btnPrimaryClass}>
              {guardando ? 'Enviando...' : 'Enviar reclamo'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
