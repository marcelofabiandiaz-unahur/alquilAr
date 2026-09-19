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
import PhotoDropzone from './PhotoDropzone';
import PropertyPhotoCarousel from './PropertyPhotoCarousel';
import {
  inputClass,
  labelClass,
  btnPrimaryClass,
  btnSecondaryClass,
  btnGhostClass,
} from '../layout/dashboardStyles';

const FORM_VACIO = {
  direccion: '',
  tipo: 'Departamento',
  ambientes: 2,
  valor_base: '',
  descripcion: '',
  estado: 'DISPONIBLE',
  fotos: [],
};

export default function PropiedadesPanel({ token, esPropietario, esAdmin }) {
  const [propiedades, setPropiedades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [historialTitulo, setHistorialTitulo] = useState('');
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiGet('/api/propiedades', token);
      setPropiedades(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirNueva = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setModalAbierto(true);
  };

  const abrirEditar = (prop) => {
    setEditando(prop);
    setForm({
      direccion: prop.direccion,
      tipo: prop.tipo,
      ambientes: prop.ambientes,
      valor_base: prop.valor_base,
      descripcion: prop.descripcion || '',
      estado: prop.estado,
      fotos: Array.isArray(prop.fotos) ? [...prop.fotos] : [],
    });
    setModalAbierto(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const body = {
        direccion: form.direccion,
        tipo: form.tipo,
        ambientes: Number(form.ambientes),
        valor_base: Number(form.valor_base),
        descripcion: form.descripcion,
        fotos: form.fotos,
      };
      if (editando) {
        if (form.estado !== 'ALQUILADA' && form.estado !== 'INACTIVA') {
          body.estado = form.estado;
        }
        await apiPut(`/api/propiedades/${editando._id}`, token, body);
      } else {
        await apiPost('/api/propiedades', token, body);
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const darBaja = async (prop) => {
    if (!window.confirm(`¿Dar de baja "${prop.direccion}"?`)) return;
    setError('');
    try {
      await apiDelete(`/api/propiedades/${prop._id}`, token);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const verHistorial = async (prop) => {
    setHistorialTitulo(prop.direccion);
    setHistorialAbierto(true);
    setCargandoHistorial(true);
    setHistorial([]);
    try {
      const data = await apiGet(`/api/propiedades/${prop._id}/contratos`, token);
      setHistorial(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoHistorial(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mis Propiedades"
        subtitle="Administrá tus inmuebles y su estado operativo"
        action={
          (esPropietario || esAdmin) && (
            <button type="button" onClick={abrirNueva} className={btnPrimaryClass}>
              + Nueva propiedad
            </button>
          )
        }
      />

      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}

      {cargando ? (
        <LoadingRow label="Cargando propiedades..." />
      ) : propiedades.length === 0 ? (
        <EmptyState
          title="Sin propiedades registradas"
          description="Creá tu primera propiedad para comenzar a gestionar contratos."
          action={
            <button type="button" onClick={abrirNueva} className={btnPrimaryClass}>
              + Nueva propiedad
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {propiedades.map((prop) => (
            <Card key={prop._id} className="overflow-hidden flex flex-col">
              <PropertyPhotoCarousel fotos={prop.fotos || []} alt={prop.direccion} />
              <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base leading-tight text-[#14213D]">{prop.direccion}</h3>
                  <p className="text-slate-500 text-xs mt-1">
                    {prop.tipo} · {prop.ambientes} amb.
                  </p>
                </div>
                <StatBadge estado={prop.estado} />
              </div>
              <p className="text-emerald-600 font-semibold">{formatMoneda(prop.valor_base)}</p>
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
                    Baja
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
          <div>
            <label className={labelClass}>Dirección</label>
            <input
              required
              className={inputClass}
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
                    {c.id_inquilino?.nombre} {c.id_inquilino?.apellido}
                  </p>
                  <p className="text-xs text-slate-500">{c.id_inquilino?.email}</p>
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
