import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../../lib/apiClient';
import { formatMoneda } from '../../lib/estadoStyles';
import PageHeader from '../ui/PageHeader';
import StatBadge from '../ui/StatBadge';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import LoadingRow from '../ui/LoadingRow';
import Modal from '../ui/Modal';
import DataTable from '../ui/DataTable';
import FileDropzone from '../ui/FileDropzone';
import {
  inputClass,
  labelClass,
  btnPrimaryClass,
  btnGhostClass,
} from '../layout/dashboardStyles';
import type { ChangeEvent, FormEvent } from 'react';
import type { Contrato, Propiedad } from '../../types';

interface ContratoFormState {
  id_propiedad: string;
  email_inquilino: string;
  fecha_inicio: string;
  monto_mensual: string;
  dia_vencimiento: string;
  garante_nombre: string;
  garante_telefono: string;
  garante_recibo: string;
}

const FORM_VACIO: ContratoFormState = {
  id_propiedad: '',
  email_inquilino: '',
  fecha_inicio: new Date().toISOString().slice(0, 10),
  monto_mensual: '',
  dia_vencimiento: '10',
  garante_nombre: '',
  garante_telefono: '',
  garante_recibo: '',
};

function nombreInquilino(contrato: Contrato): string {
  const inq = contrato.id_inquilino;
  if (!inq) return '—';
  if (typeof inq === 'object') {
    return `${inq.nombre || ''} ${inq.apellido || ''}`.trim() || inq.email || '—';
  }
  return '—';
}

function direccionPropiedad(contrato: Contrato): string {
  const prop = contrato.id_propiedad;
  if (!prop) return '—';
  if (typeof prop === 'object') return prop.direccion || '—';
  return '—';
}

function fechaContrato(fecha?: string): string {
  if (!fecha) return 'Sin fecha de finalización';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return fecha;
  return new Intl.DateTimeFormat('es-AR').format(new Date(anio, mes - 1, dia));
}

interface ContratosPanelProps {
  token: string;
  esPropietario: boolean;
  esInquilino: boolean;
}

export default function ContratosPanel({ token, esPropietario, esInquilino }: ContratosPanelProps) {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<ContratoFormState>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [accionId, setAccionId] = useState<string | null>(null);
  const [contratoSeleccionado, setContratoSeleccionado] = useState<Contrato | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [reciboAbierto, setReciboAbierto] = useState<string | null>(null);

  const titulo = esPropietario && esInquilino
    ? 'Contratos (propietario e inquilino)'
    : esPropietario
      ? 'Contratos de mis propiedades'
      : 'Mis Contratos';

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiGet<Contrato[]>('/api/contratos', token);
      setContratos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los contratos.');
      setContratos([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  const cargarPropiedades = useCallback(async () => {
    if (!esPropietario) return;
    try {
      const data = await apiGet<Propiedad[]>('/api/propiedades', token);
      setPropiedades(Array.isArray(data) ? data.filter((p) => p.estado !== 'INACTIVA') : []);
    } catch {
      setPropiedades([]);
    }
  }, [token, esPropietario]);

  useEffect(() => {
    const timer = setTimeout(() => {
      cargar();
      cargarPropiedades();
    }, 0);
    return () => clearTimeout(timer);
  }, [cargar, cargarPropiedades]);

  const abrirNuevo = () => {
    setForm({
      ...FORM_VACIO,
      id_propiedad: propiedades[0]?._id || '',
      fecha_inicio: new Date().toISOString().slice(0, 10),
    });
    setModalAbierto(true);
  };

  const crear = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setInfo('');
    try {
      const body: {
        id_propiedad: string;
        email_inquilino: string;
        fecha_inicio: string;
        monto_mensual: number;
        dia_vencimiento: number;
        estado: string;
        garante?: { nombre: string; telefono: string; recibo?: string };
      } = {
        id_propiedad: form.id_propiedad,
        email_inquilino: form.email_inquilino.trim(),
        fecha_inicio: form.fecha_inicio,
        monto_mensual: Number(form.monto_mensual),
        dia_vencimiento: Number(form.dia_vencimiento),
        estado: 'BORRADOR',
      };
      if (form.garante_nombre || form.garante_telefono || form.garante_recibo) {
        body.garante = {
          nombre: form.garante_nombre,
          telefono: form.garante_telefono,
        };
        if (form.garante_recibo) {
          body.garante.recibo = form.garante_recibo;
        }
      }
      const data = await apiPost<{ requiere_rol_inquilino?: boolean }>('/api/contratos', token, body);
      setModalAbierto(false);
      if (data.requiere_rol_inquilino) {
        setInfo(
          'Contrato creado en BORRADOR. Un administrador debe asignar rol INQUILINO al usuario antes de activarlo.',
        );
      } else {
        setInfo('Contrato creado correctamente.');
      }
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el contrato.');
    } finally {
      setGuardando(false);
    }
  };

  const conAccion = async (id: string, fn: () => Promise<unknown>) => {
    setAccionId(id);
    setError('');
    setInfo('');
    try {
      await fn();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el contrato.');
    } finally {
      setAccionId(null);
    }
  };

  const activar = (id: string) =>
    conAccion(id, () => apiPut(`/api/contratos/${id}`, token, { estado: 'VIGENTE' }));

  const finalizar = (id: string) =>
    conAccion(id, () => apiPatch(`/api/contratos/${id}/finalizar`, token, {}));

  const cancelar = (id: string) => {
    if (!window.confirm('¿Cancelar este contrato?')) return;
    conAccion(id, () => apiDelete(`/api/contratos/${id}`, token));
  };

  const columnas = esPropietario
    ? ['Propiedad', 'Inquilino', 'Monto', 'Venc.', 'Estado', 'Acciones']
    : ['Propiedad', 'Monto', 'Venc.', 'Estado'];

  const abrirDetalle = async (contrato: Contrato) => {
    setContratoSeleccionado(contrato);
    setCargandoDetalle(true);
    setErrorDetalle('');
    try {
      const detalle = await apiGet<Contrato>(`/api/contratos/${contrato._id}`, token);
      setContratoSeleccionado((actual) => actual?._id === contrato._id ? detalle : actual);
    } catch (err) {
      setErrorDetalle(err instanceof Error ? err.message : 'No se pudo cargar el detalle del contrato.');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cerrarDetalle = () => {
    setContratoSeleccionado(null);
    setCargandoDetalle(false);
    setErrorDetalle('');
  };

  const contratosVigentes = contratos.filter((contrato) => contrato.estado === 'VIGENTE');
  const contratosFinalizados = contratos.filter((contrato) => contrato.estado === 'FINALIZADO');
  const otrosContratos = contratos.filter(
    (contrato) => contrato.estado !== 'VIGENTE' && contrato.estado !== 'FINALIZADO',
  );

  const renderTabla = (filas: Contrato[]) => (
    <DataTable
      columns={columnas}
      rows={filas}
      renderRow={(c) => (
        <tr
          key={c._id}
          className="cursor-pointer hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
          onClick={() => abrirDetalle(c)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              abrirDetalle(c);
            }
          }}
          tabIndex={0}
          aria-label={`Ver detalle del contrato de ${direccionPropiedad(c)}`}
        >
          <td className="p-4">{direccionPropiedad(c)}</td>
          {esPropietario && (
            <td className="p-4 text-slate-600">
              <div>{nombreInquilino(c)}</div>
              <div className="text-xs text-slate-500">
                {typeof c.id_inquilino === 'object' ? c.id_inquilino.email : ''}
              </div>
            </td>
          )}
          <td className="p-4">{formatMoneda(c.monto_mensual)}</td>
          <td className="p-4">Día {c.dia_vencimiento}</td>
          <td className="p-4">
            <StatBadge estado={c.estado} />
          </td>
          {esPropietario && (
            <td className="p-4">
              <div className="flex flex-wrap gap-1">
                {c.estado === 'BORRADOR' && (
                  <button
                    type="button"
                    disabled={accionId === c._id}
                    onClick={(event) => {
                      event.stopPropagation();
                      activar(c._id);
                    }}
                    className="text-xs px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                  >
                    Activar
                  </button>
                )}
                {c.estado === 'VIGENTE' && (
                  <button
                    type="button"
                    disabled={accionId === c._id}
                    onClick={(event) => {
                      event.stopPropagation();
                      finalizar(c._id);
                    }}
                    className="text-xs px-2 py-1 rounded bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
                  >
                    Finalizar
                  </button>
                )}
                {(c.estado === 'BORRADOR' || c.estado === 'VIGENTE') && (
                  <button
                    type="button"
                    disabled={accionId === c._id}
                    onClick={(event) => {
                      event.stopPropagation();
                      cancelar(c._id);
                    }}
                    className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </td>
          )}
        </tr>
      )}
    />
  );

  const renderSeccion = (tituloSeccion: string, filas: Contrato[]) => (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[#14213D]">
        {tituloSeccion} <span className="text-sm font-normal text-slate-400">({filas.length})</span>
      </h2>
      {filas.length > 0
        ? renderTabla(filas)
        : <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">No hay contratos en esta sección.</p>}
    </section>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={titulo}
        subtitle={
          esPropietario
            ? 'Gestioná borradores, activaciones y cierres de contrato'
            : 'Consultá los contratos asociados a tu perfil de inquilino'
        }
        action={
          esPropietario && (
            <button
              type="button"
              onClick={abrirNuevo}
              disabled={propiedades.length === 0}
              className={`${btnPrimaryClass} disabled:opacity-40`}
            >
              + Nuevo contrato
            </button>
          )
        }
      />

      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="info" onClose={() => setInfo('')}>{info}</Alert>}

      {cargando ? (
        <LoadingRow label="Cargando contratos..." />
      ) : contratos.length === 0 ? (
        <EmptyState
          title="Sin contratos"
          description={
            esPropietario
              ? 'Creá un contrato en borrador vinculando una propiedad y el email del futuro inquilino.'
              : 'Aún no tenés contratos asignados a tu cuenta.'
          }
          action={
            esPropietario &&
            propiedades.length > 0 && (
              <button type="button" onClick={abrirNuevo} className={btnPrimaryClass}>
                + Nuevo contrato
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {renderSeccion('Contratos vigentes', contratosVigentes)}
          {renderSeccion('Contratos finalizados', contratosFinalizados)}
          {otrosContratos.length > 0 && renderSeccion('Borradores y otros estados', otrosContratos)}
        </div>
      )}

      {contratoSeleccionado && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/30"
          role="presentation"
          onClick={cerrarDetalle}
        >
          <aside
            className="absolute inset-y-3 right-3 flex w-[calc(100%-1.5rem)] max-w-xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contrato-detalle-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Detalle del contrato</p>
                <h2 id="contrato-detalle-titulo" className="mt-2 text-xl font-bold text-[#14213D]">
                  {direccionPropiedad(contratoSeleccionado)}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar detalle del contrato"
                onClick={cerrarDetalle}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {errorDetalle && <Alert theme="light" onClose={() => setErrorDetalle('')}>{errorDetalle}</Alert>}
              {cargandoDetalle && <LoadingRow label="Cargando información completa del contrato..." />}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Estado</p>
                <StatBadge estado={contratoSeleccionado.estado} />
              </div>
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Alquiler</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <div>
                    <dt className="text-slate-400">Fecha de inicio</dt>
                    <dd className="mt-1 font-medium text-slate-800">{fechaContrato(contratoSeleccionado.fecha_inicio)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Fecha de finalización</dt>
                    <dd className="mt-1 font-medium text-slate-800">{fechaContrato(contratoSeleccionado.fecha_fin)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Monto mensual</dt>
                    <dd className="mt-1 font-semibold text-emerald-700">{formatMoneda(contratoSeleccionado.monto_mensual)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Vencimiento mensual</dt>
                    <dd className="mt-1 font-medium text-slate-800">Día {contratoSeleccionado.dia_vencimiento}</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Propiedad</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <div>
                    <dt className="text-slate-400">Dirección</dt>
                    <dd className="mt-1 font-medium text-slate-800">{direccionPropiedad(contratoSeleccionado)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Tipo y ambientes</dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {typeof contratoSeleccionado.id_propiedad === 'object'
                        ? [contratoSeleccionado.id_propiedad.tipo, contratoSeleccionado.id_propiedad.ambientes
                          ? `${contratoSeleccionado.id_propiedad.ambientes} ambientes`
                          : undefined].filter(Boolean).join(' · ') || '—'
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Inquilino</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <div>
                    <dt className="text-slate-400">Nombre</dt>
                    <dd className="mt-1 font-medium text-slate-800">{nombreInquilino(contratoSeleccionado)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Email</dt>
                    <dd className="mt-1 break-all font-medium text-slate-800">
                      {typeof contratoSeleccionado.id_inquilino === 'object'
                        ? contratoSeleccionado.id_inquilino.email || '—'
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Garante</h3>
                {contratoSeleccionado.garante?.nombre || contratoSeleccionado.garante?.telefono || contratoSeleccionado.garante?.recibo ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                    <div>
                      <dt className="text-slate-400">Nombre</dt>
                      <dd className="mt-1 font-medium text-slate-800">{contratoSeleccionado.garante.nombre || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Teléfono</dt>
                      <dd className="mt-1 font-medium text-slate-800">{contratoSeleccionado.garante.telefono || '—'}</dd>
                    </div>
                    {contratoSeleccionado.garante.recibo && (
                      <div className="col-span-2">
                        <button
                          type="button"
                          className="font-medium text-emerald-700 hover:underline"
                          onClick={() => setReciboAbierto(contratoSeleccionado.garante?.recibo || null)}
                        >
                          Ver recibo del garante
                        </button>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500">No se registraron datos del garante.</p>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}

      <Modal
        open={Boolean(reciboAbierto)}
        title="Recibo del garante"
        onClose={() => setReciboAbierto(null)}
        wide
      >
        {reciboAbierto && (
          <iframe
            src={reciboAbierto}
            title="Vista previa del recibo del garante"
            className="h-[70vh] min-h-80 w-full rounded-xl border border-slate-200 bg-slate-50"
            referrerPolicy="no-referrer"
          />
        )}
      </Modal>

      <Modal open={modalAbierto} title="Nuevo contrato" onClose={() => setModalAbierto(false)} wide>
        <form onSubmit={crear} className="space-y-4">
          <Alert theme="light" type="info">
            El inquilino debe estar registrado en el sistema. Si aún no tiene rol INQUILINO, el contrato
            quedará en BORRADOR hasta que un administrador lo apruebe.
          </Alert>
          <div>
            <label className={labelClass}>Propiedad</label>
            <select
              required
              className={inputClass}
              value={form.id_propiedad}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm({ ...form, id_propiedad: e.target.value })}
            >
              <option value="">Seleccionar...</option>
              {propiedades.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.direccion} ({p.estado})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Email del inquilino</label>
            <input
              required
              type="email"
              className={inputClass}
              placeholder="usuario1@alquilar.com"
              value={form.email_inquilino}
              onChange={(e) => setForm({ ...form, email_inquilino: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Fecha inicio</label>
              <input
                required
                type="date"
                className={inputClass}
                value={form.fecha_inicio}
                onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Día vencimiento (1-28)</label>
              <input
                required
                type="number"
                min="1"
                max="28"
                className={inputClass}
                value={form.dia_vencimiento}
                onChange={(e) => setForm({ ...form, dia_vencimiento: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Monto mensual (ARS)</label>
            <input
              required
              type="number"
              min="0"
              className={inputClass}
              value={form.monto_mensual}
              onChange={(e) => setForm({ ...form, monto_mensual: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Garante (opcional)</label>
              <input
                className={inputClass}
                value={form.garante_nombre}
                onChange={(e) => setForm({ ...form, garante_nombre: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Tel. garante</label>
              <input
                className={inputClass}
                value={form.garante_telefono}
                onChange={(e) => setForm({ ...form, garante_telefono: e.target.value })}
              />
            </div>
          </div>
          <FileDropzone
            value={form.garante_recibo}
            onChange={(url) => setForm({ ...form, garante_recibo: url })}
            disabled={guardando}
            tipo="garante"
            label="Recibo del garante (opcional)"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalAbierto(false)} className={btnGhostClass}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={btnPrimaryClass}>
              {guardando ? 'Creando...' : 'Crear borrador'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
