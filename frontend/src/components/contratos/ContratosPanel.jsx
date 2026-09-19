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

const FORM_VACIO = {
  id_propiedad: '',
  email_inquilino: '',
  fecha_inicio: new Date().toISOString().slice(0, 10),
  monto_mensual: '',
  dia_vencimiento: 10,
  garante_nombre: '',
  garante_telefono: '',
  garante_recibo: '',
};

function nombreInquilino(contrato) {
  const inq = contrato.id_inquilino;
  if (!inq) return '—';
  if (typeof inq === 'object') {
    return `${inq.nombre || ''} ${inq.apellido || ''}`.trim() || inq.email || '—';
  }
  return '—';
}

function direccionPropiedad(contrato) {
  const prop = contrato.id_propiedad;
  if (!prop) return '—';
  if (typeof prop === 'object') return prop.direccion || '—';
  return '—';
}

export default function ContratosPanel({ token, esPropietario, esInquilino }) {
  const [contratos, setContratos] = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [accionId, setAccionId] = useState(null);

  const titulo = esPropietario && esInquilino
    ? 'Contratos (propietario e inquilino)'
    : esPropietario
      ? 'Contratos de mis propiedades'
      : 'Mis Contratos';

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiGet('/api/contratos', token);
      setContratos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setContratos([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  const cargarPropiedades = useCallback(async () => {
    if (!esPropietario) return;
    try {
      const data = await apiGet('/api/propiedades', token);
      setPropiedades(Array.isArray(data) ? data.filter((p) => p.estado !== 'INACTIVA') : []);
    } catch {
      setPropiedades([]);
    }
  }, [token, esPropietario]);

  useEffect(() => {
    cargar();
    cargarPropiedades();
  }, [cargar, cargarPropiedades]);

  const abrirNuevo = () => {
    setForm({
      ...FORM_VACIO,
      id_propiedad: propiedades[0]?._id || '',
      fecha_inicio: new Date().toISOString().slice(0, 10),
    });
    setModalAbierto(true);
  };

  const crear = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setInfo('');
    try {
      const body = {
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
      const data = await apiPost('/api/contratos', token, body);
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
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const conAccion = async (id, fn) => {
    setAccionId(id);
    setError('');
    setInfo('');
    try {
      await fn();
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccionId(null);
    }
  };

  const activar = (id) =>
    conAccion(id, () => apiPut(`/api/contratos/${id}`, token, { estado: 'VIGENTE' }));

  const finalizar = (id) =>
    conAccion(id, () => apiPatch(`/api/contratos/${id}/finalizar`, token, {}));

  const cancelar = (id) => {
    if (!window.confirm('¿Cancelar este contrato?')) return;
    conAccion(id, () => apiDelete(`/api/contratos/${id}`, token));
  };

  const columnas = esPropietario
    ? ['Propiedad', 'Inquilino', 'Monto', 'Venc.', 'Estado', 'Acciones']
    : ['Propiedad', 'Monto', 'Venc.', 'Estado'];

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
        <DataTable
          columns={columnas}
          rows={contratos}
          renderRow={(c) => (
            <tr key={c._id} className="hover:bg-slate-50">
              <td className="p-4">{direccionPropiedad(c)}</td>
              {esPropietario && (
                <td className="p-4 text-slate-600">
                  <div>{nombreInquilino(c)}</div>
                  <div className="text-xs text-slate-500">{c.id_inquilino?.email}</div>
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
                        onClick={() => activar(c._id)}
                        className="text-xs px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                      >
                        Activar
                      </button>
                    )}
                    {c.estado === 'VIGENTE' && (
                      <button
                        type="button"
                        disabled={accionId === c._id}
                        onClick={() => finalizar(c._id)}
                        className="text-xs px-2 py-1 rounded bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
                      >
                        Finalizar
                      </button>
                    )}
                    {(c.estado === 'BORRADOR' || c.estado === 'VIGENTE') && (
                      <button
                        type="button"
                        disabled={accionId === c._id}
                        onClick={() => cancelar(c._id)}
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
      )}

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
              onChange={(e) => setForm({ ...form, id_propiedad: e.target.value })}
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
