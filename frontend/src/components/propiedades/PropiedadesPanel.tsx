import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/apiClient';
import { formatMoneda } from '../../lib/estadoStyles';
import PageHeader from '../ui/PageHeader';
import StatBadge from '../ui/StatBadge';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import LoadingRow from '../ui/LoadingRow';
import Modal from '../ui/Modal';
import Card from '../ui/Card';
import DataTable from '../ui/DataTable';
import PhotoDropzone from './PhotoDropzone';
import PropertyPhotoCarousel from './PropertyPhotoCarousel';
import {
  inputClass,
  labelClass,
  btnPrimaryClass,
  btnSecondaryClass,
  btnGhostClass,
} from '../layout/dashboardStyles';
import type { FormEvent } from 'react';
import type {
  Agrupamiento,
  Contrato,
  FiltroPropiedades,
  Propiedad,
  Usuario,
} from '../../types';
import {
  conAgrupamiento,
  direccionAgrupamiento,
  obtenerIdAgrupamiento,
} from '../../lib/agrupamientos';

interface PropiedadForm {
  direccion: string;
  tipo: string;
  ambientes: string;
  valor_base: string;
  descripcion: string;
  estado: string;
  fotos: string[];
  id_agrupamiento: string;
  unidad: string;
}

const FORM_VACIO: PropiedadForm = {
  direccion: '',
  tipo: 'Departamento',
  ambientes: '2',
  valor_base: '',
  descripcion: '',
  estado: 'DISPONIBLE',
  fotos: [],
  id_agrupamiento: '',
  unidad: '',
};

interface PropiedadesPanelProps {
  token: string;
  esPropietario: boolean;
  esAdmin: boolean;
  idAgrupamiento?: string;
  filtroEstado: FiltroPropiedades;
  setFiltroEstado: (filtro: FiltroPropiedades) => void;
}

export default function PropiedadesPanel({
  token,
  esPropietario,
  esAdmin,
  idAgrupamiento = '',
  filtroEstado,
  setFiltroEstado,
}: PropiedadesPanelProps) {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [agrupamientos, setAgrupamientos] = useState<Agrupamiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Propiedad | null>(null);
  const [form, setForm] = useState<PropiedadForm>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [historial, setHistorial] = useState<Contrato[]>([]);
  const [historialTitulo, setHistorialTitulo] = useState('');
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const propiedadesFiltradas = propiedades.filter((propiedad) => (
    filtroEstado === 'TODAS' || propiedad.estado === filtroEstado
  ));

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [data, usuariosData] = await Promise.all([
        apiGet<Propiedad[]>(conAgrupamiento('/api/propiedades', idAgrupamiento), token),
        esAdmin ? apiGet<Usuario[]>('/api/usuarios', token) : Promise.resolve([] as Usuario[]),
      ]);
      if (!Array.isArray(data) || !Array.isArray(usuariosData)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }
      setPropiedades(data);
      setUsuarios(usuariosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las propiedades.');
    } finally {
      setCargando(false);
    }
  }, [token, idAgrupamiento, esAdmin]);

  const cargarAgrupamientos = useCallback(async () => {
    if (esAdmin) {
      setAgrupamientos([]);
      return;
    }

    try {
      const data = await apiGet<Agrupamiento[]>('/api/agrupamientos', token);
      setAgrupamientos(Array.isArray(data) ? data : []);
    } catch (err) {
      setAgrupamientos([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los agrupamientos.');
    }
  }, [token, esAdmin]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void cargar();
      void cargarAgrupamientos();
    }, 0);
    return () => clearTimeout(timer);
  }, [cargar, cargarAgrupamientos]);

  const abrirNueva = () => {
    setEditando(null);
    setForm({ ...FORM_VACIO, id_agrupamiento: idAgrupamiento });
    setModalAbierto(true);
  };

  const abrirEditar = (prop: Propiedad) => {
    setEditando(prop);
    setForm({
      direccion: prop.direccion,
      tipo: prop.tipo,
      ambientes: String(prop.ambientes),
      valor_base: String(prop.valor_base),
      descripcion: prop.descripcion || '',
      estado: prop.estado,
      fotos: Array.isArray(prop.fotos) ? [...prop.fotos] : [],
      id_agrupamiento: obtenerIdAgrupamiento(prop.id_agrupamiento),
      unidad: prop.unidad?.identificador || '',
    });
    setModalAbierto(true);
  };

  const cambiarAgrupamiento = (idAgrupamiento: string) => {
    const agrupamiento = agrupamientos.find((item) => item._id === idAgrupamiento);
    setForm((actual) => ({
      ...actual,
      id_agrupamiento: idAgrupamiento,
      direccion: agrupamiento ? direccionAgrupamiento(agrupamiento) : actual.direccion,
      unidad: idAgrupamiento ? actual.unidad : '',
    }));
  };

  const guardar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const agrupamientoSeleccionado = form.id_agrupamiento.trim();
      const unidad = form.unidad.trim();
      if (agrupamientoSeleccionado && !unidad) {
        setError('Indicá el identificador de la unidad del agrupamiento.');
        return;
      }

      const body: {
        direccion: string;
        tipo: string;
        ambientes: number;
        valor_base: number;
        descripcion: string;
        fotos: string[];
        estado?: string;
        id_agrupamiento?: string | null;
        unidad?: { identificador: string };
      } = {
        direccion: form.direccion,
        tipo: form.tipo,
        ambientes: Number(form.ambientes),
        valor_base: Number(form.valor_base),
        descripcion: form.descripcion,
        fotos: form.fotos,
      };
      if (editando) {
        const idOriginal = obtenerIdAgrupamiento(editando.id_agrupamiento);
        if (agrupamientoSeleccionado !== idOriginal) {
          body.id_agrupamiento = agrupamientoSeleccionado || null;
        }
        if (agrupamientoSeleccionado && unidad) {
          body.unidad = { identificador: unidad };
        }
        if (form.estado !== 'ALQUILADA' && form.estado !== 'INACTIVA') {
          body.estado = form.estado;
        }
        const actualizada = await apiPut<Propiedad & { advertencias?: string[] }>(
          `/api/propiedades/${editando._id}`,
          token,
          body,
        );
        setAviso(actualizada.advertencias?.join(' ') || '');
      } else {
        if (agrupamientoSeleccionado) {
          body.id_agrupamiento = agrupamientoSeleccionado;
          body.unidad = { identificador: unidad };
        }
        await apiPost('/api/propiedades', token, body);
        setAviso('');
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la propiedad.');
    } finally {
      setGuardando(false);
    }
  };

  const darBaja = async (prop: Propiedad) => {
    if (!window.confirm(`¿Dar de baja "${prop.direccion}"?`)) return;
    setError('');
    try {
      await apiDelete(`/api/propiedades/${prop._id}`, token);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dar de baja la propiedad.');
    }
  };

  const verHistorial = async (prop: Propiedad) => {
    setHistorialTitulo(prop.direccion);
    setHistorialAbierto(true);
    setCargandoHistorial(true);
    setHistorial([]);
    try {
      const data = await apiGet<Contrato[]>(`/api/propiedades/${prop._id}/contratos`, token);
      setHistorial(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
    } finally {
      setCargandoHistorial(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={esAdmin ? 'Propiedades' : 'Mis propiedades'}
        subtitle={esAdmin ? 'Consulta las propiedades y su estado operativo' : 'Unidades registradas y su estado operativo'}
        action={
          esPropietario && !esAdmin && (
            <button type="button" onClick={abrirNueva} className={btnPrimaryClass}>
              + Nueva propiedad
            </button>
          )
        }
      />

      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {aviso && <Alert type="info" theme="light" onClose={() => setAviso('')}>{aviso}</Alert>}

      <div className="inline-flex max-w-full flex-wrap rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner" role="group" aria-label="Filtrar propiedades por estado">
        {(['TODAS', 'DISPONIBLE', 'ALQUILADA'] as FiltroPropiedades[]).map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={filtroEstado === opcion}
            onClick={() => setFiltroEstado(opcion)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
              filtroEstado === opcion
                ? 'bg-white text-violet-800 shadow-sm ring-1 ring-slate-200/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {opcion === 'TODAS' ? 'Todas' : opcion === 'DISPONIBLE' ? 'Disponibles' : 'Alquiladas'}
          </button>
        ))}
      </div>

      {cargando ? (
        <LoadingRow label="Cargando propiedades..." />
      ) : propiedades.length === 0 ? (
        <EmptyState
          title="Sin propiedades registradas"
          description={esAdmin
            ? 'Todavía no hay propiedades registradas.'
            : 'Creá tu primera propiedad para comenzar a gestionar contratos.'}
          action={
            esPropietario && !esAdmin
              ? (
                <button type="button" onClick={abrirNueva} className={btnPrimaryClass}>
                  + Nueva propiedad
                </button>
              )
              : undefined
          }
        />
      ) : propiedadesFiltradas.length === 0 ? (
        <EmptyState
          title="Sin propiedades en este estado"
          description={filtroEstado === 'DISPONIBLE'
            ? 'No hay unidades disponibles en este momento.'
            : 'No hay unidades alquiladas en este momento.'}
        />
      ) : esAdmin ? (
        <DataTable
          columns={['Propiedad', 'Propietario', 'Tipo', 'Agrupamiento', 'Estado', 'Valor base']}
          rows={propiedadesFiltradas}
          emptyMessage="No hay propiedades para mostrar."
          renderRow={(prop) => {
            const idPropietario = typeof prop.id_propietario === 'string'
              ? prop.id_propietario
              : prop.id_propietario?._id;
            const propietario = usuarios.find((usuario) => usuario._id === idPropietario);
            const idAgrupamientoPropiedad = obtenerIdAgrupamiento(prop.id_agrupamiento);
            const agrupamiento = agrupamientos.find((item) => item._id === idAgrupamientoPropiedad);
            return (
              <tr key={prop._id} className="hover:bg-slate-50">
                <td className="p-4">
                  <p className="font-semibold text-slate-800">{prop.direccion}</p>
                  {prop.unidad?.identificador && (
                    <p className="mt-1 text-xs text-slate-500">Unidad {prop.unidad.identificador}</p>
                  )}
                </td>
                <td className="p-4 text-slate-600">
                  {propietario ? `${propietario.nombre} ${propietario.apellido}` : 'Sin datos'}
                </td>
                <td className="p-4 text-slate-600">{prop.tipo} · {prop.ambientes} amb.</td>
                <td className="p-4 text-slate-600">{agrupamiento?.nombre || '—'}</td>
                <td className="p-4"><StatBadge estado={prop.estado} /></td>
                <td className="p-4 font-semibold text-slate-700">{formatMoneda(prop.valor_base)}</td>
              </tr>
            );
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {propiedadesFiltradas.map((prop) => (
            <Card key={prop._id} className="overflow-hidden flex flex-col">
              <PropertyPhotoCarousel fotos={prop.fotos || []} alt={prop.direccion} />
              <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base leading-tight text-[var(--brand-navy)]">{prop.direccion}</h3>
                  <p className="text-slate-500 text-xs mt-1">
                    {prop.tipo} · {prop.ambientes} amb.
                  </p>
                  {(() => {
                    const id = obtenerIdAgrupamiento(prop.id_agrupamiento);
                    if (!id) return null;
                    const agrupamiento = agrupamientos.find((item) => item._id === id);
                    return (
                      <p className="text-fuchsia-600 text-xs mt-1 font-medium">
                        {agrupamiento?.nombre || 'Agrupamiento'}
                        {prop.unidad?.identificador ? ` · Unidad ${prop.unidad.identificador}` : ''}
                      </p>
                    );
                  })()}
                </div>
                <StatBadge estado={prop.estado} />
              </div>
              <p className="text-violet-600 font-semibold">{formatMoneda(prop.valor_base)}</p>
              {prop.descripcion && (
                <p className="text-slate-500 text-xs line-clamp-2">{prop.descripcion}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 mt-auto">
                <button type="button" onClick={() => abrirEditar(prop)} className={btnSecondaryClass}>
                  Editar
                </button>
                <button type="button" onClick={() => verHistorial(prop)} className={btnSecondaryClass}>
                  Contratos
                </button>
                {prop.estado !== 'INACTIVA' && (
                  <button
                    type="button"
                    onClick={() => darBaja(prop)}
                    className="text-xs px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 font-medium"
                  >
                    Eliminar
                  </button>
                )}
              </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalAbierto}
        title={editando ? 'Editar propiedad' : 'Nueva propiedad'}
        onClose={() => setModalAbierto(false)}
      >
        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Agrupamiento</label>
              <select
                className={inputClass}
                value={form.id_agrupamiento}
                onChange={(event) => cambiarAgrupamiento(event.target.value)}
              >
                <option value="">Sin agrupamiento</option>
                {form.id_agrupamiento
                  && !agrupamientos.some((item) => item._id === form.id_agrupamiento) && (
                    <option value={form.id_agrupamiento}>Agrupamiento actual</option>
                  )}
                {agrupamientos.map((agrupamiento) => (
                  <option key={agrupamiento._id} value={agrupamiento._id}>
                    {agrupamiento.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Se muestran los agrupamientos visibles para tu cuenta.
              </p>
            </div>
            <div>
              <label className={labelClass}>Unidad dentro del agrupamiento</label>
              <input
                className={inputClass}
                placeholder="Ej. 4B, PB-2"
                disabled={!form.id_agrupamiento}
                value={form.unidad}
                onChange={(event) => setForm({ ...form, unidad: event.target.value })}
              />
              {form.id_agrupamiento && (
                <p className="mt-1 text-xs text-slate-500">
                  Identificador único dentro del agrupamiento.
                </p>
              )}
            </div>
          </div>
          <div>
            <label className={labelClass}>Dirección</label>
            <input
              required
              className={inputClass}
              readOnly={Boolean(form.id_agrupamiento)}
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
            {form.id_agrupamiento && (
              <p className="mt-1 text-xs text-slate-500">
                La dirección se toma del agrupamiento seleccionado.
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Tipo</label>
              <input
                required
                className={inputClass}
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Ambientes</label>
              <input
                required
                type="number"
                min="1"
                className={inputClass}
                value={form.ambientes}
                onChange={(e) => setForm({ ...form, ambientes: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Valor base (ARS)</label>
            <input
              required
              type="number"
              min="0"
              className={inputClass}
              value={form.valor_base}
              onChange={(e) => setForm({ ...form, valor_base: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea
              required
              className={`${inputClass} min-h-[80px]`}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>
          <PhotoDropzone
            fotos={form.fotos}
            onChange={(fotos) =>
              setForm((prev) => ({
                ...prev,
                fotos: typeof fotos === 'function' ? fotos(prev.fotos) : fotos,
              }))
            }
            disabled={guardando}
          />
          {editando && (editando.estado === 'DISPONIBLE' || editando.estado === 'EN_MANTENIMIENTO') && (
            <div>
              <label className={labelClass}>Estado operativo</label>
              <select
                className={inputClass}
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="DISPONIBLE">DISPONIBLE</option>
                <option value="EN_MANTENIMIENTO">EN_MANTENIMIENTO</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalAbierto(false)} className={btnGhostClass}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={btnPrimaryClass}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={historialAbierto}
        title={`Contratos — ${historialTitulo}`}
        onClose={() => setHistorialAbierto(false)}
        wide
      >
        {cargandoHistorial ? (
          <LoadingRow label="Cargando historial..." />
        ) : historial.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay contratos para esta propiedad.</p>
        ) : (
          <ul className="space-y-3">
            {historial.map((c) => (
              <li key={c._id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {typeof c.id_inquilino === 'object' ? `${c.id_inquilino.nombre || ''} ${c.id_inquilino.apellido || ''}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {typeof c.id_inquilino === 'object' ? c.id_inquilino.email : ''}
                  </p>
                </div>
                <StatBadge estado={c.estado} />
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
