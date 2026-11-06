import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/apiClient';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import LoadingRow from '../ui/LoadingRow';
import Modal from '../ui/Modal';
import StatBadge from '../ui/StatBadge';
import {
  inputClass,
  labelClass,
  btnPrimaryClass,
  btnSecondaryClass,
  btnGhostClass,
} from '../layout/dashboardStyles';
import {
  direccionAgrupamiento,
  nombreReferencia,
  notificarAgrupamientosActualizados,
  obtenerIdAgrupamiento,
} from '../../lib/agrupamientos';
import type { FormEvent } from 'react';
import type {
  Agrupamiento,
  EstadoAgrupamiento,
  TipoAgrupamiento,
} from '../../types';

const TIPOS: TipoAgrupamiento[] = [
  'EDIFICIO',
  'COMPLEJO',
  'CONSORCIO',
  'CONJUNTO',
  'BARRIO_CERRADO',
  'OTRO',
];

interface AgrupamientoForm {
  codigo: string;
  nombre: string;
  tipo: TipoAgrupamiento;
  estado: EstadoAgrupamiento;
  calle: string;
  numero: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  descripcion: string;
  idAdministrador: string;
  gestores: string;
  contactoNombre: string;
  contactoTelefono: string;
  contactoEmail: string;
  servicios: string;
  moneda: string;
  diaVencimiento: string;
}

const FORM_VACIO: AgrupamientoForm = {
  codigo: '',
  nombre: '',
  tipo: 'EDIFICIO',
  estado: 'ACTIVO',
  calle: '',
  numero: '',
  ciudad: '',
  provincia: '',
  codigoPostal: '',
  descripcion: '',
  idAdministrador: '',
  gestores: '',
  contactoNombre: '',
  contactoTelefono: '',
  contactoEmail: '',
  servicios: '',
  moneda: 'ARS',
  diaVencimiento: '10',
};

interface AgrupamientosPanelProps {
  token: string;
  esAdmin: boolean;
  esPropietario: boolean;
}

export default function AgrupamientosPanel({
  token,
  esAdmin,
  esPropietario,
}: AgrupamientosPanelProps) {
  const [agrupamientos, setAgrupamientos] = useState<Agrupamiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Agrupamiento | null>(null);
  const [form, setForm] = useState<AgrupamientoForm>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [accionId, setAccionId] = useState('');

  const puedeGestionar = esAdmin || esPropietario;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiGet<Agrupamiento[]>('/api/agrupamientos', token);
      setAgrupamientos(Array.isArray(data) ? data : []);
    } catch (err) {
      setAgrupamientos([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los agrupamientos.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setModalAbierto(true);
  };

  const abrirEdicion = (agrupamiento: Agrupamiento) => {
    setEditando(agrupamiento);
    setForm({
      codigo: agrupamiento.codigo || '',
      nombre: agrupamiento.nombre || '',
      tipo: agrupamiento.tipo,
      estado: agrupamiento.estado,
      calle: agrupamiento.direccion?.calle || '',
      numero: agrupamiento.direccion?.numero || '',
      ciudad: agrupamiento.direccion?.ciudad || '',
      provincia: agrupamiento.direccion?.provincia || '',
      codigoPostal: agrupamiento.direccion?.codigo_postal || '',
      descripcion: agrupamiento.descripcion || '',
      idAdministrador: obtenerIdAgrupamiento(agrupamiento.id_administrador),
      gestores: (agrupamiento.gestores || [])
        .map((gestor) => obtenerIdAgrupamiento(gestor))
        .filter(Boolean)
        .join(', '),
      contactoNombre: agrupamiento.contacto?.nombre || '',
      contactoTelefono: agrupamiento.contacto?.telefono || '',
      contactoEmail: agrupamiento.contacto?.email || '',
      servicios: (agrupamiento.servicios || []).join(', '),
      moneda: agrupamiento.configuracion?.moneda || 'ARS',
      diaVencimiento: String(agrupamiento.configuracion?.dia_vencimiento_default ?? 10),
    });
    setModalAbierto(true);
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setInfo('');
    try {
      const body: Record<string, unknown> = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        estado: form.estado,
        direccion: {
          calle: form.calle.trim(),
          numero: form.numero.trim(),
          ciudad: form.ciudad.trim(),
          provincia: form.provincia.trim(),
          codigo_postal: form.codigoPostal.trim(),
        },
        descripcion: form.descripcion.trim(),
        gestores: form.gestores.split(',').map((gestor) => gestor.trim()).filter(Boolean),
        contacto: {
          nombre: form.contactoNombre.trim(),
          telefono: form.contactoTelefono.trim(),
          email: form.contactoEmail.trim(),
        },
        servicios: form.servicios.split(',').map((servicio) => servicio.trim()).filter(Boolean),
        configuracion: {
          moneda: form.moneda.trim() || 'ARS',
          dia_vencimiento_default: Number(form.diaVencimiento),
        },
      };
      if (esAdmin && form.idAdministrador.trim()) {
        body.id_administrador = form.idAdministrador.trim();
      }

      if (editando) {
        await apiPut(`/api/agrupamientos/${editando._id}`, token, body);
        setInfo('Agrupamiento actualizado.');
      } else {
        await apiPost('/api/agrupamientos', token, body);
        setInfo('Agrupamiento creado.');
      }
      setModalAbierto(false);
      notificarAgrupamientosActualizados();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el agrupamiento.');
    } finally {
      setGuardando(false);
    }
  };

  const darBaja = async (agrupamiento: Agrupamiento) => {
    if (!window.confirm(`¿Dar de baja "${agrupamiento.nombre}"?`)) return;
    setAccionId(agrupamiento._id);
    setError('');
    setInfo('');
    try {
      await apiDelete(`/api/agrupamientos/${agrupamiento._id}`, token);
      setInfo('Agrupamiento dado de baja.');
      notificarAgrupamientosActualizados();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dar de baja el agrupamiento.');
    } finally {
      setAccionId('');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agrupamientos"
        subtitle="Edificios, complejos y consorcios que agrupan unidades"
        action={
          puedeGestionar && (
            <button type="button" onClick={abrirNuevo} className={btnPrimaryClass}>
              + Nuevo agrupamiento
            </button>
          )
        }
      />

      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="success" onClose={() => setInfo('')}>{info}</Alert>}

      {cargando ? (
        <LoadingRow label="Cargando agrupamientos..." />
      ) : agrupamientos.length === 0 ? (
        <EmptyState
          title="Sin agrupamientos"
          description="Creá un agrupamiento para organizar varias unidades bajo una misma administración."
          action={puedeGestionar && (
            <button type="button" onClick={abrirNuevo} className={btnPrimaryClass}>
              + Nuevo agrupamiento
            </button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {agrupamientos.map((agrupamiento) => (
            <Card key={agrupamiento._id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">
                    {agrupamiento.codigo}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-[var(--brand-navy)]">
                    {agrupamiento.nombre}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {agrupamiento.tipo.replaceAll('_', ' ')} · {direccionAgrupamiento(agrupamiento)}
                  </p>
                </div>
                <StatBadge estado={agrupamiento.estado} />
              </div>

              {agrupamiento.descripcion && (
                <p className="mt-3 text-sm text-slate-600">{agrupamiento.descripcion}</p>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-400">Administrador</dt>
                  <dd className="mt-0.5 font-medium text-slate-700">
                    {nombreReferencia(agrupamiento.id_administrador)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Gestores</dt>
                  <dd className="mt-0.5 font-medium text-slate-700">
                    {(agrupamiento.gestores || []).length > 0
                      ? (agrupamiento.gestores || [])
                        .map((gestor) => nombreReferencia(gestor))
                        .join(', ')
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Servicios</dt>
                  <dd className="mt-0.5 font-medium text-slate-700">
                    {(agrupamiento.servicios || []).join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Vencimiento</dt>
                  <dd className="mt-0.5 font-medium text-slate-700">
                    Día {agrupamiento.configuracion?.dia_vencimiento_default ?? 10}
                    {' · '}
                    {agrupamiento.configuracion?.moneda || 'ARS'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">Contacto</dt>
                  <dd className="mt-0.5 font-medium text-slate-700">
                    {[agrupamiento.contacto?.nombre, agrupamiento.contacto?.telefono, agrupamiento.contacto?.email]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </dd>
                </div>
              </dl>

              {puedeGestionar && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => abrirEdicion(agrupamiento)} className={btnSecondaryClass}>
                    Editar
                  </button>
                  {esAdmin && agrupamiento.estado === 'ACTIVO' && (
                    <button
                      type="button"
                      disabled={accionId === agrupamiento._id}
                      onClick={() => void darBaja(agrupamiento)}
                      className="text-xs px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 font-medium disabled:opacity-50"
                    >
                      {accionId === agrupamiento._id ? 'Dando de baja...' : 'Dar de baja'}
                    </button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalAbierto}
        title={editando ? 'Editar agrupamiento' : 'Nuevo agrupamiento'}
        onClose={() => setModalAbierto(false)}
        wide
      >
        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Código</label>
              <input
                required
                maxLength={20}
                className={inputClass}
                placeholder="EDF-PALERMO-01"
                value={form.codigo}
                onChange={(event) => setForm({ ...form, codigo: event.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className={labelClass}>Nombre</label>
              <input
                required
                maxLength={120}
                className={inputClass}
                value={form.nombre}
                onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Tipo</label>
              <select
                className={inputClass}
                value={form.tipo}
                onChange={(event) => setForm({ ...form, tipo: event.target.value as TipoAgrupamiento })}
              >
                {TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>{tipo.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select
                className={inputClass}
                value={form.estado}
                onChange={(event) => setForm({ ...form, estado: event.target.value as EstadoAgrupamiento })}
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dirección</legend>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>Calle</label>
                <input
                  required
                  className={inputClass}
                  value={form.calle}
                  onChange={(event) => setForm({ ...form, calle: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Número</label>
                <input
                  required
                  className={inputClass}
                  value={form.numero}
                  onChange={(event) => setForm({ ...form, numero: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Ciudad</label>
                <input
                  required
                  className={inputClass}
                  value={form.ciudad}
                  onChange={(event) => setForm({ ...form, ciudad: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Provincia</label>
                <input
                  required
                  className={inputClass}
                  value={form.provincia}
                  onChange={(event) => setForm({ ...form, provincia: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Código postal</label>
                <input
                  className={inputClass}
                  value={form.codigoPostal}
                  onChange={(event) => setForm({ ...form, codigoPostal: event.target.value })}
                />
              </div>
            </div>
          </fieldset>

          <div>
            <label className={labelClass}>Descripción</label>
            <textarea
              maxLength={1000}
              className={`${inputClass} min-h-[70px]`}
              value={form.descripcion}
              onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {esAdmin && (
              <div>
                <label className={labelClass}>ID del administrador (opcional)</label>
                <input
                  className={inputClass}
                  placeholder="ObjectId del usuario administrador"
                  value={form.idAdministrador}
                  onChange={(event) => setForm({ ...form, idAdministrador: event.target.value })}
                />
              </div>
            )}
            <div>
              <label className={labelClass}>IDs de gestores (separados por coma)</label>
              <input
                className={inputClass}
                placeholder="ObjectId1, ObjectId2"
                value={form.gestores}
                onChange={(event) => setForm({ ...form, gestores: event.target.value })}
              />
            </div>
          </div>

          <fieldset className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Contacto</legend>
            <div>
              <label className={labelClass}>Nombre</label>
              <input
                className={inputClass}
                value={form.contactoNombre}
                onChange={(event) => setForm({ ...form, contactoNombre: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                className={inputClass}
                value={form.contactoTelefono}
                onChange={(event) => setForm({ ...form, contactoTelefono: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={form.contactoEmail}
                onChange={(event) => setForm({ ...form, contactoEmail: event.target.value })}
              />
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className={labelClass}>Servicios (separados por coma)</label>
              <input
                className={inputClass}
                placeholder="Agua, Gas, Expensas"
                value={form.servicios}
                onChange={(event) => setForm({ ...form, servicios: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Moneda</label>
              <input
                className={inputClass}
                value={form.moneda}
                onChange={(event) => setForm({ ...form, moneda: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Día de vencimiento (1-28)</label>
              <input
                type="number"
                min="1"
                max="28"
                className={inputClass}
                value={form.diaVencimiento}
                onChange={(event) => setForm({ ...form, diaVencimiento: event.target.value })}
              />
            </div>
          </div>

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
    </div>
  );
}
