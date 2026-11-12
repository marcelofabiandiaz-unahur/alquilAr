import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/apiClient';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import LoadingRow from '../ui/LoadingRow';
import Modal from '../ui/Modal';
import StatBadge from '../ui/StatBadge';
import PhotoDropzone from '../propiedades/PhotoDropzone';
import PropertyPhotoCarousel from '../propiedades/PropertyPhotoCarousel';
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
  Usuario,
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
  fotos: string[];
  nombre: string;
  tipo: TipoAgrupamiento;
  estado: EstadoAgrupamiento;
  calle: string;
  numero: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  descripcion: string;
  gestores: string[];
  contactoNombre: string;
  contactoTelefono: string;
  contactoEmail: string;
  servicios: string;
  moneda: string;
}

const FORM_VACIO: AgrupamientoForm = {
  fotos: [],
  nombre: '',
  tipo: 'EDIFICIO',
  estado: 'ACTIVO',
  calle: '',
  numero: '',
  ciudad: '',
  provincia: '',
  codigoPostal: '',
  descripcion: '',
  gestores: [],
  contactoNombre: '',
  contactoTelefono: '',
  contactoEmail: '',
  servicios: '',
  moneda: 'ARS',
};

interface GestorAsignable {
  _id: string;
  nombre: string;
  apellido: string;
  email: string;
}

function gestorDesdeReferencia(referencia: string | Usuario): GestorAsignable {
  if (typeof referencia === 'string') {
    return { _id: referencia, nombre: 'Propietario asignado', apellido: '', email: '' };
  }
  return {
    _id: referencia._id || '',
    nombre: referencia.nombre,
    apellido: referencia.apellido,
    email: referencia.email,
  };
}

interface AgrupamientosPanelProps {
  token: string;
}

export default function AgrupamientosPanel({
  token,
}: AgrupamientosPanelProps) {
  const [agrupamientos, setAgrupamientos] = useState<Agrupamiento[]>([]);
  const [gestoresSeleccionados, setGestoresSeleccionados] = useState<GestorAsignable[]>([]);
  const [busquedaGestor, setBusquedaGestor] = useState('');
  const [resultadosGestores, setResultadosGestores] = useState<GestorAsignable[]>([]);
  const [buscandoGestores, setBuscandoGestores] = useState(false);
  const [errorBusquedaGestor, setErrorBusquedaGestor] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Agrupamiento | null>(null);
  const [form, setForm] = useState<AgrupamientoForm>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [accionId, setAccionId] = useState('');

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

  useEffect(() => {
    const termino = busquedaGestor.trim();
    if (!modalAbierto || termino.length < 2) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBuscandoGestores(true);
      setErrorBusquedaGestor('');
      const query = new URLSearchParams({ q: termino });
      void apiGet<GestorAsignable[]>(
        `/api/usuarios/gestores-disponibles?${query.toString()}`,
        token,
        { signal: controller.signal },
      ).then((data) => {
        if (!Array.isArray(data)) throw new Error('Respuesta inválida al buscar propietarios.');
        setResultadosGestores(data);
      }).catch((err) => {
        if (!controller.signal.aborted) {
          setResultadosGestores([]);
          setErrorBusquedaGestor(
            err instanceof Error ? err.message : 'No se pudieron buscar propietarios.',
          );
        }
      }).finally(() => {
        if (!controller.signal.aborted) setBuscandoGestores(false);
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [busquedaGestor, modalAbierto, token]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setGestoresSeleccionados([]);
    setBusquedaGestor('');
    setModalAbierto(true);
  };

  const abrirEdicion = (agrupamiento: Agrupamiento) => {
    setEditando(agrupamiento);
    setGestoresSeleccionados(
      (agrupamiento.gestores || [])
        .map(gestorDesdeReferencia)
        .filter((gestor) => gestor._id),
    );
    setBusquedaGestor('');
    setForm({
      fotos: Array.isArray(agrupamiento.fotos) ? [...agrupamiento.fotos] : [],
      nombre: agrupamiento.nombre || '',
      tipo: agrupamiento.tipo,
      estado: agrupamiento.estado,
      calle: agrupamiento.direccion?.calle || '',
      numero: agrupamiento.direccion?.numero || '',
      ciudad: agrupamiento.direccion?.ciudad || '',
      provincia: agrupamiento.direccion?.provincia || '',
      codigoPostal: agrupamiento.direccion?.codigo_postal || '',
      descripcion: agrupamiento.descripcion || '',
      gestores: (agrupamiento.gestores || [])
        .map((gestor) => obtenerIdAgrupamiento(gestor))
        .filter(Boolean),
      contactoNombre: agrupamiento.contacto?.nombre || '',
      contactoTelefono: agrupamiento.contacto?.telefono || '',
      contactoEmail: agrupamiento.contacto?.email || '',
      servicios: (agrupamiento.servicios || []).join(', '),
      moneda: agrupamiento.configuracion?.moneda || 'ARS',
    });
    setModalAbierto(true);
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busquedaGestor.trim()) {
      setError('Seleccioná un propietario de los resultados o borrá el texto de búsqueda antes de guardar.');
      return;
    }
    setGuardando(true);
    setError('');
    setInfo('');
    try {
      const body: Record<string, unknown> = {
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
        fotos: form.fotos,
        gestores: form.gestores,
        contacto: {
          nombre: form.contactoNombre.trim(),
          telefono: form.contactoTelefono.trim(),
          email: form.contactoEmail.trim(),
        },
        servicios: form.servicios.split(',').map((servicio) => servicio.trim()).filter(Boolean),
        configuracion: {
          moneda: form.moneda.trim() || 'ARS',
        },
      };
      if (editando) {
        const actualizado = await apiPut<Agrupamiento & { advertencias?: string[] }>(
          `/api/agrupamientos/${editando._id}`,
          token,
          body,
        );
        setInfo(['Agrupamiento actualizado.', ...(actualizado.advertencias || [])].join(' '));
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

  const agregarGestor = (gestor: GestorAsignable) => {
    if (form.gestores.includes(gestor._id)) return;
    setForm((actual) => ({ ...actual, gestores: [...actual.gestores, gestor._id] }));
    setGestoresSeleccionados((actuales) => [...actuales, gestor]);
    setBusquedaGestor('');
    setResultadosGestores([]);
    setErrorBusquedaGestor('');
  };

  const quitarGestor = (id: string) => {
    setForm((actual) => ({
      ...actual,
      gestores: actual.gestores.filter((gestorId) => gestorId !== id),
    }));
    setGestoresSeleccionados((actuales) => actuales.filter((gestor) => gestor._id !== id));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agrupamientos"
        subtitle="Edificios, complejos y consorcios que agrupan unidades"
        action={
        <button type="button" onClick={abrirNuevo} className={btnPrimaryClass}>
          + Nuevo agrupamiento
        </button>
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
          action={
            <button type="button" onClick={abrirNuevo} className={btnPrimaryClass}>
              + Nuevo agrupamiento
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {agrupamientos.map((agrupamiento) => (
            <Card key={agrupamiento._id} className="p-5">
              <PropertyPhotoCarousel fotos={agrupamiento.fotos || []} alt={agrupamiento.nombre} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--brand-navy)]">
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
                  <dt className="text-slate-400">Propietario responsable</dt>
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
                  <dt className="text-slate-400">Moneda</dt>
                  <dd className="mt-0.5 font-medium text-slate-700">
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

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => abrirEdicion(agrupamiento)} className={btnSecondaryClass}>
                  Editar
                </button>
                {agrupamiento.estado === 'ACTIVO' && (
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

          <PhotoDropzone
            fotos={form.fotos}
            onChange={(fotos) => setForm((prev) => ({
              ...prev,
              fotos: typeof fotos === 'function' ? fotos(prev.fotos) : fotos,
            }))}
            disabled={guardando}
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Gestores propietarios</label>
              <input
                type="search"
                className={inputClass}
                value={busquedaGestor}
                placeholder="Escribí el nombre o apellido del propietario"
                autoComplete="off"
                  onChange={(event) => {
                    setBusquedaGestor(event.target.value);
                    setResultadosGestores([]);
                    setBuscandoGestores(false);
                    setErrorBusquedaGestor('');
                  }}
                />
              <p className="mt-1 text-xs text-slate-500">
                Escribí al menos 2 caracteres y seleccioná un propietario activo para validarlo.
              </p>
              {buscandoGestores && (
                <p className="mt-2 text-xs text-slate-500">Buscando propietarios...</p>
              )}
              {errorBusquedaGestor && (
                <p role="alert" className="mt-2 text-xs text-red-600">{errorBusquedaGestor}</p>
              )}
              {resultadosGestores.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  {resultadosGestores
                    .filter((gestor) => !form.gestores.includes(gestor._id))
                    .map((gestor) => (
                      <li key={gestor._id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => agregarGestor(gestor)}
                        >
                          <span className="font-medium text-slate-700">
                            {`${gestor.nombre} ${gestor.apellido}`.trim()}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">{gestor.email}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
              {busquedaGestor.trim().length >= 2
                && !buscandoGestores
                && !errorBusquedaGestor
                && resultadosGestores.length === 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    No encontramos propietarios activos con ese nombre.
                  </p>
              )}
              {gestoresSeleccionados.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {gestoresSeleccionados.map((gestor) => (
                    <li
                      key={gestor._id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-700">
                          {`${gestor.nombre} ${gestor.apellido}`.trim()}
                        </span>
                        {gestor.email && (
                          <span className="block truncate text-xs text-slate-500">{gestor.email}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700"
                        onClick={() => quitarGestor(gestor._id)}
                        aria-label={`Quitar gestor ${gestor.nombre} ${gestor.apellido}`}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
