import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiGetBlob, apiPost, apiPut, apiPatch, apiDelete } from '../../lib/apiClient';
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
} from '../layout/dashboardStyles';
import type { ChangeEvent, FormEvent } from 'react';
import type { Contrato, FiltroContratos, Propiedad } from '../../types';
import { conAgrupamiento } from '../../lib/agrupamientos';

interface ContratoFormState {
  id_propiedad: string;
  email_inquilino: string;
  fecha_inicio: string;
  fecha_fin: string;
  dia_vencimiento: string;
  monto_mensual: string;
  garante_nombre: string;
  garante_telefono: string;
  garante_recibo: string;
}

const FORM_VACIO: ContratoFormState = {
  id_propiedad: '',
  email_inquilino: '',
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_fin: '',
  monto_mensual: '',
  dia_vencimiento: '10',
  garante_nombre: '',
  garante_telefono: '',
  garante_recibo:'',
};

const btnVioletOutlineClass =
  'rounded-lg border border-violet-600 text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-50';
const btnGreenOutlineClass =
  'rounded-lg border border-emerald-600 text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50';
const btnRedOutlineClass =
  'rounded-lg border border-red-600 text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50';

function obtenerNombreInquilino(contrato: Contrato) {
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

function progresoContrato(contrato: Contrato): number | null {
  if (!contrato.fecha_inicio || !contrato.fecha_fin) return null;
  const fechaLocal = (fecha: string) => {
    const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    const resultado = new Date(anio, mes - 1, dia);
    return Number.isNaN(resultado.getTime()) ? null : resultado;
  };
  const inicio = fechaLocal(contrato.fecha_inicio);
  const fin = fechaLocal(contrato.fecha_fin);
  if (!inicio || !fin || fin <= inicio) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round(Math.min(1, Math.max(0, (hoy.getTime() - inicio.getTime()) / (fin.getTime() - inicio.getTime()))) * 100);
}

function fechaInput(fecha?: string): string {
  if (!fecha) return '';
  const fechaISO = fecha.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fechaISO) ? fechaISO : '';
}

interface ContratosPanelProps {
  token: string;
  esPropietario: boolean;
  esInquilino: boolean;
  esAdministrador: boolean;
  idAgrupamiento?: string;
  filtro: FiltroContratos;
  setFiltro: (filtro: FiltroContratos) => void;
}

export default function ContratosPanel({
  token,
  esPropietario,
  esInquilino,
  esAdministrador,
  idAgrupamiento = '',
  filtro,
  setFiltro,
}: ContratosPanelProps) {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [edicionAbierta, setEdicionAbierta] = useState(false);
  const [form, setForm] = useState<ContratoFormState>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');
  const [contratoEnEdicion, setContratoEnEdicion] = useState<Contrato | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);
  const [contratosSeleccionados, setContratosSeleccionados] = useState<string[]>([]);
  const [procesandoLote, setProcesandoLote] = useState(false);
  const [contratoSeleccionado, setContratoSeleccionado] = useState<Contrato | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [resultadoActivacion, setResultadoActivacion] = useState('');
  const [reciboAbierto, setReciboAbierto] = useState(false);
  const [reciboPreviewUrl, setReciboPreviewUrl] = useState<string | null>(null);
  const [cargandoRecibo, setCargandoRecibo] = useState(false);
  const [errorRecibo, setErrorRecibo] = useState('');
  const reciboRequestId = useRef(0);

  const titulo = esPropietario && esInquilino
    ? 'Contratos (propietario e inquilino)'
    : esPropietario
      ? 'Contratos de mis propiedades'
      : esAdministrador
        ? 'Contratos por activar'
        : 'Mis Contratos';

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiGet<Contrato[]>(
        conAgrupamiento('/api/contratos', idAgrupamiento),
        token,
      );
      setContratos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los contratos.');
      setContratos([]);
    } finally {
      setCargando(false);
    }
  }, [token, idAgrupamiento]);

  const cargarPropiedades = useCallback(async () => {
    if (!esPropietario) return;
    try {
      const data = await apiGet<Propiedad[]>(
        conAgrupamiento('/api/propiedades', idAgrupamiento),
        token,
      );
      setPropiedades(Array.isArray(data) ? data.filter((p) => p.estado !== 'INACTIVA') : []);
    } catch {
      setPropiedades([]);
    }
  }, [token, esPropietario, idAgrupamiento]);

  useEffect(() => {
    const timer = setTimeout(() => {
      cargar();
      cargarPropiedades();
    }, 0);
    return () => clearTimeout(timer);
  }, [cargar, cargarPropiedades]);

  const abrirNuevo = () => {
    const propiedadSugerida = propiedades[0];
    setForm({
      ...FORM_VACIO,
      id_propiedad: propiedadSugerida?._id || '',
      monto_mensual: propiedadSugerida ? String(propiedadSugerida.valor_base) : '',
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
        fecha_fin: string;
        monto_mensual: number;
        dia_vencimiento: number;
        estado: string;
        garante?: { nombre: string; telefono: string; recibo?: string };
      } = {
        id_propiedad: form.id_propiedad,
        email_inquilino: form.email_inquilino.trim(),
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
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

  const abrirEdicion = (contrato: Contrato) => {
    if (contrato.estado !== 'VIGENTE' || !esPropietario) return;
    setErrorEdicion('');
    setContratoEnEdicion(contrato);
    setForm({
      ...FORM_VACIO,
      fecha_inicio: fechaInput(contrato.fecha_inicio),
      fecha_fin: fechaInput(contrato.fecha_fin),
      monto_mensual: String(contrato.monto_mensual),
      dia_vencimiento: String(contrato.dia_vencimiento),
      garante_nombre: contrato.garante?.nombre || '',
      garante_telefono: contrato.garante?.telefono || '',
      garante_recibo: contrato.garante?.recibo || '',
    });
    setEdicionAbierta(true);
  };

  const guardarEdicion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contratoEnEdicion) return;
    setGuardandoEdicion(true);
    setErrorEdicion('');
    try {
      const garante: { nombre?: string; telefono?: string; recibo?: string } = {};
      if (form.garante_nombre.trim()) garante.nombre = form.garante_nombre.trim();
      if (form.garante_telefono.trim()) garante.telefono = form.garante_telefono.trim();
      if (form.garante_recibo.trim()) garante.recibo = form.garante_recibo.trim();

      const actualizado = await apiPut<Contrato>(
        `/api/contratos/${contratoEnEdicion._id}`,
        token,
        {
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          dia_vencimiento: Number(form.dia_vencimiento),
          garante,
        },
      );
      setContratoSeleccionado((actual) => (
        actual?._id === actualizado._id ? actualizado : actual
      ));
      setEdicionAbierta(false);
      setContratoEnEdicion(null);
      setInfo('Contrato actualizado correctamente.');
      await cargar();
    } catch (err) {
      setErrorEdicion(err instanceof Error ? err.message : 'No se pudo actualizar el contrato.');
    } finally {
      setGuardandoEdicion(false);
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

  const contratosBorradorAdmin = contratos.filter((contrato) => contrato.estado === 'BORRADOR');
  const alternarSeleccionContrato = (id: string) => {
    setContratosSeleccionados((actuales) => actuales.includes(id)
      ? actuales.filter((seleccionado) => seleccionado !== id)
      : [...actuales, id]);
  };
  const seleccionarTodosListos = () => {
    setContratosSeleccionados(contratosListosAdmin.map((contrato) => contrato._id));
  };
  const activarContratosAdmin = async (ids: string[]) => {
    if (ids.length === 0 || procesandoLote) return;
    setProcesandoLote(true);
    setResultadoActivacion('');
    setError('');
    const activados: string[] = [];
    const fallidos: string[] = [];
    for (const id of ids) {
      const contrato = contratosBorradorAdmin.find((item) => item._id === id);
      const etiqueta = contrato
        ? `${direccionPropiedad(contrato)} — ${obtenerNombreInquilino(contrato)}`
        : id;
      try {
        await apiPut(`/api/contratos/${id}`, token, { estado: 'VIGENTE' });
        activados.push(etiqueta);
      } catch (err) {
        fallidos.push(`${etiqueta}: ${err instanceof Error ? err.message : 'No se pudo activar.'}`);
      }
    }
    setContratosSeleccionados([]);
    await cargar();
    setProcesandoLote(false);
    if (activados.length > 0) {
      setResultadoActivacion(`Contratos activados: ${activados.length}. Se asignó el rol INQUILINO automáticamente cuando faltaba.`);
    }
    if (fallidos.length > 0) {
      setError(`No se pudieron activar ${fallidos.length} contratos: ${fallidos.join(' · ')}`);
    }
  };

  const finalizar = (id: string) =>
    conAccion(id, () => apiPatch(`/api/contratos/${id}/finalizar`, token, {}));

  const cancelar = (id: string) => {
    if (!window.confirm('¿Cancelar este contrato?')) return;
    conAccion(id, () => apiDelete(`/api/contratos/${id}`, token));
  };

  const columnas = esPropietario
    ? ['Propiedad', 'Inquilino', 'Progreso', 'Monto', 'Venc.', 'Estado', 'Acciones']
    : ['Propiedad', ...(esInquilino ? ['Progreso'] : []), 'Monto', 'Venc.', 'Estado'];

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

  const abrirReciboGarante = async (contratoId: string) => {
    const requestId = ++reciboRequestId.current;
    setReciboAbierto(true);
    setCargandoRecibo(true);
    setErrorRecibo('');
    setReciboPreviewUrl(null);
    try {
      const blob = await apiGetBlob(`/api/contratos/${contratoId}/garante/recibo`, token);
      const previewUrl = URL.createObjectURL(blob);
      if (reciboRequestId.current === requestId) setReciboPreviewUrl(previewUrl);
      else URL.revokeObjectURL(previewUrl);
    } catch (err) {
      if (reciboRequestId.current === requestId) {
        setErrorRecibo(err instanceof Error ? err.message : 'No se pudo consultar el recibo del garante.');
      }
    } finally {
      if (reciboRequestId.current === requestId) setCargandoRecibo(false);
    }
  };

  const cerrarRecibo = () => {
    reciboRequestId.current += 1;
    setReciboAbierto(false);
    setReciboPreviewUrl(null);
    setCargandoRecibo(false);
    setErrorRecibo('');
  };

  useEffect(() => () => {
    if (reciboPreviewUrl) URL.revokeObjectURL(reciboPreviewUrl);
  }, [reciboPreviewUrl]);

  useEffect(() => () => {
    reciboRequestId.current += 1;
  }, []);

  const contratosVigentes = contratos.filter((contrato) => contrato.estado === 'VIGENTE');
  const contratosFinalizados = contratos.filter((contrato) => contrato.estado === 'FINALIZADO');
  const otrosContratos = contratos.filter(
    (contrato) => contrato.estado !== 'VIGENTE' && contrato.estado !== 'FINALIZADO',
  );
  const contratosPorVencer = contratosVigentes.filter((contrato) => {
    if (!contrato.fecha_fin) return false;
    const [anio, mes, dia] = contrato.fecha_fin.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return false;
    const fechaFin = new Date(anio, mes - 1, dia);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + 30);
    return fechaFin >= hoy && fechaFin <= limite;
  });
  const idsContratosVigentes = new Set(
    contratosVigentes.map((contrato) => {
      const propiedad = contrato.id_propiedad;
      return typeof propiedad === 'string' ? propiedad : propiedad?._id;
    }).filter((id): id is string => Boolean(id)),
  );
  const contratosListosAdmin = contratosBorradorAdmin.filter((contrato) => {
    const propiedad = contrato.id_propiedad;
    return typeof propiedad === 'object'
      && Boolean(propiedad._id)
      && ['DISPONIBLE', 'EN_MANTENIMIENTO'].includes(propiedad.estado || '')
      && !idsContratosVigentes.has(propiedad._id);
  });

  if (esAdministrador) {
    const seleccionadosListos = contratosSeleccionados.filter(
      (id) => contratosListosAdmin.some((contrato) => contrato._id === id),
    );
    return (
      <div className="space-y-4">
        <PageHeader
          title={titulo}
          subtitle="Revisá los contratos en borrador y activá uno o varios. Si falta, el rol INQUILINO se asigna al activar."
        />
        {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
        {resultadoActivacion && (
          <Alert theme="light" type="success" onClose={() => setResultadoActivacion('')}>
            {resultadoActivacion}
          </Alert>
        )}
        {cargando ? (
          <LoadingRow label="Cargando contratos por activar..." />
        ) : contratosBorradorAdmin.length === 0 ? (
          <EmptyState
            title="No hay contratos por activar"
            description="Los contratos nuevos en borrador aparecerán en esta lista."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {contratosBorradorAdmin.length} borradores · {contratosListosAdmin.length} con propiedad apta para activar
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={procesandoLote || contratosListosAdmin.length === 0}
                  onClick={seleccionarTodosListos}
                  className={`px-3 py-2 text-sm ${btnVioletOutlineClass}`}
                >
                  Seleccionar disponibles
                </button>
                <button
                  type="button"
                  disabled={procesandoLote || seleccionadosListos.length === 0}
                  onClick={() => {
                    if (window.confirm(`¿Activar ${seleccionadosListos.length} contratos seleccionados?`)) {
                      void activarContratosAdmin(seleccionadosListos);
                    }
                  }}
                  className={`px-3 py-2 text-sm ${btnGreenOutlineClass}`}
                >
                  {procesandoLote ? 'Activando...' : `Activar seleccionados (${seleccionadosListos.length})`}
                </button>
                <button
                  type="button"
                  disabled={procesandoLote || contratosListosAdmin.length === 0}
                  onClick={() => {
                    if (window.confirm(`¿Activar todos los ${contratosListosAdmin.length} contratos con propiedad apta?`)) {
                      void activarContratosAdmin(contratosListosAdmin.map((contrato) => contrato._id));
                    }
                  }}
                  className={`px-3 py-2 text-sm ${btnGreenOutlineClass}`}
                >
                  Activar todos los aptos
                </button>
              </div>
            </div>
            <DataTable
              columns={['Seleccionar', 'Propiedad', 'Inquilino', 'Inicio', 'Fin', 'Monto mensual', 'Estado de activación']}
              rows={contratosBorradorAdmin}
              renderRow={(contrato) => {
                const propiedad = contrato.id_propiedad;
                const propiedadId = typeof propiedad === 'string' ? propiedad : propiedad?._id;
                const propiedadDisponible = typeof propiedad === 'object'
                  && ['DISPONIBLE', 'EN_MANTENIMIENTO'].includes(propiedad.estado || '');
                const tieneVigente = Boolean(propiedadId && idsContratosVigentes.has(propiedadId));
                const listo = contratosListosAdmin.some((item) => item._id === contrato._id);
                return (
                  <tr key={contrato._id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar contrato de ${direccionPropiedad(contrato)}`}
                        checked={contratosSeleccionados.includes(contrato._id)}
                        disabled={!listo || procesandoLote}
                        onChange={() => alternarSeleccionContrato(contrato._id)}
                        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                    </td>
                    <td className="p-4 font-medium text-slate-800">{direccionPropiedad(contrato)}</td>
                    <td className="p-4 text-slate-600">
                      {obtenerNombreInquilino(contrato)}
                      {typeof contrato.id_inquilino === 'object' && contrato.id_inquilino.email && (
                        <span className="mt-1 block text-xs text-slate-500">{contrato.id_inquilino.email}</span>
                      )}
                    </td>
                    <td className="p-4">{fechaContrato(contrato.fecha_inicio)}</td>
                    <td className="p-4">{fechaContrato(contrato.fecha_fin)}</td>
                    <td className="p-4">{formatMoneda(contrato.monto_mensual)}</td>
                    <td className="p-4">
                      {tieneVigente ? 'Ya existe un contrato vigente para esta propiedad' : !propiedadDisponible ? 'La propiedad no está disponible' : 'Listo; el rol de inquilino se asigna si falta'}
                    </td>
                  </tr>
                );
              }}
            />
          </>
        )}
      </div>
    );
  }

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
              <div>{obtenerNombreInquilino(c)}</div>
              <div className="text-xs text-slate-500">
                {typeof c.id_inquilino === 'object' ? c.id_inquilino.email : ''}
              </div>
            </td>
          )}
          {(esInquilino || esPropietario) && (
            <td className="p-4 min-w-40">
              {c.estado === 'VIGENTE' ? (() => {
                const progreso = progresoContrato(c);
                return progreso === null ? (
                  <span className="text-xs text-slate-500">Fechas no disponibles</span>
                ) : (
                  <div className="space-y-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-violet-600 transition-all"
                        style={{ width: `${progreso}%` }}
                        role="progressbar"
                        aria-label={`Plazo transcurrido del contrato: ${progreso}%`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progreso}
                      />
                    </div>
                    <p className="text-xs text-slate-500">{progreso}% del plazo</p>
                  </div>
                );
              })() : <span className="text-slate-400">—</span>}
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
                    className={`px-2 py-1 text-xs ${btnGreenOutlineClass}`}
                  >
                    Activar
                  </button>
                )}
                {c.estado === 'VIGENTE' && (
                  <>
                    <button
                      type="button"
                      disabled={accionId === c._id}
                      onClick={(event) => {
                        event.stopPropagation();
                        abrirEdicion(c);
                      }}
                      className={`px-2 py-1 text-xs ${btnVioletOutlineClass}`}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={accionId === c._id}
                      onClick={(event) => {
                        event.stopPropagation();
                        finalizar(c._id);
                      }}
                      className={`px-2 py-1 text-xs ${btnGreenOutlineClass}`}
                    >
                      Finalizar
                    </button>
                  </>
                )}
                {(c.estado === 'BORRADOR' || c.estado === 'VIGENTE') && (
                  <button
                    type="button"
                    disabled={accionId === c._id}
                    onClick={(event) => {
                      event.stopPropagation();
                      cancelar(c._id);
                    }}
                    className={`px-2 py-1 text-xs ${btnRedOutlineClass}`}
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
      <h2 className="text-lg font-semibold text-[var(--brand-navy)]">
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
              className={`px-4 py-2.5 text-sm font-semibold ${btnVioletOutlineClass} disabled:opacity-40`}
            >
              + Nuevo contrato
            </button>
          )
        }
      />

      <div className="inline-flex max-w-full flex-wrap rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner" role="group" aria-label="Filtrar contratos">
        {(['TODOS', 'POR_VENCER'] as FiltroContratos[]).map((opcion) => (
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
            {opcion === 'TODOS' ? 'Todos' : 'Por vencer (30 días)'}
          </button>
        ))}
      </div>

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
              <button
                type="button"
                onClick={abrirNuevo}
                className={`px-4 py-2.5 text-sm font-semibold ${btnVioletOutlineClass}`}
              >
                + Nuevo contrato
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {filtro === 'POR_VENCER' ? (
            renderSeccion('Contratos por vencer (próximos 30 días)', contratosPorVencer)
          ) : (
            <>
              {renderSeccion('Contratos vigentes', contratosVigentes)}
              {renderSeccion('Contratos finalizados', contratosFinalizados)}
              {otrosContratos.length > 0 && renderSeccion('Borradores y otros estados', otrosContratos)}
            </>
          )}
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
                <h2 id="contrato-detalle-titulo" className="mt-2 text-xl font-bold text-[var(--brand-navy)]">
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
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-slate-700">Estado</p>
                <StatBadge estado={contratoSeleccionado.estado} />
              </div>
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Alquiler</h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
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
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
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
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-400">Nombre</dt>
                    <dd className="mt-1 font-medium text-slate-800">{obtenerNombreInquilino(contratoSeleccionado)}</dd>
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
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-400">Nombre</dt>
                      <dd className="mt-1 font-medium text-slate-800">{contratoSeleccionado.garante.nombre || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Teléfono</dt>
                      <dd className="mt-1 font-medium text-slate-800">{contratoSeleccionado.garante.telefono || '—'}</dd>
                    </div>
                    {contratoSeleccionado.garante.recibo && (
                      <div className="col-span-1 sm:col-span-2">
                        <button
                          type="button"
                          className="font-medium text-emerald-700 hover:underline"
                          onClick={() => void abrirReciboGarante(contratoSeleccionado._id)}
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
        open={reciboAbierto}
        title="Recibo del garante"
        onClose={cerrarRecibo}
        wide
      >
        {cargandoRecibo && <LoadingRow label="Cargando recibo del garante..." />}
        {errorRecibo && <Alert theme="light">{errorRecibo}</Alert>}
        {reciboPreviewUrl && (
          <iframe
            src={reciboPreviewUrl}
            title="Vista previa del recibo del garante"
            className="h-[70vh] min-h-80 w-full rounded-xl border border-slate-200 bg-slate-50"
            referrerPolicy="no-referrer"
          />
        )}
      </Modal>

      <Modal
        open={edicionAbierta}
        title="Editar contrato vigente"
        onClose={() => {
          if (!guardandoEdicion) {
            setEdicionAbierta(false);
            setContratoEnEdicion(null);
          }
        }}
        wide
      >
        <form onSubmit={guardarEdicion} className="space-y-4">
          {errorEdicion && <Alert theme="light">{errorEdicion}</Alert>}
          <p className="text-sm text-slate-600">
            Podés actualizar las fechas, el día de vencimiento y los datos del garante. El monto mensual acordado no se puede modificar. La propiedad,
            el inquilino y el estado del contrato no se modifican desde aquí.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Fecha inicio</label>
              <input
                required
                type="date"
                className={inputClass}
                value={form.fecha_inicio}
                onChange={(event) => setForm({
                  ...form,
                  fecha_inicio: event.target.value,
                  fecha_fin: form.fecha_fin && form.fecha_fin < event.target.value ? '' : form.fecha_fin,
                })}
              />
            </div>
            <div>
              <label className={labelClass}>Fecha de fin</label>
              <input
                required
                type="date"
                min={form.fecha_inicio}
                className={inputClass}
                value={form.fecha_fin}
                onChange={(event) => setForm({ ...form, fecha_fin: event.target.value })}
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
                onChange={(event) => setForm({ ...form, dia_vencimiento: event.target.value })}
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
              onChange={(event) => setForm({ ...form, monto_mensual: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Garante</label>
              <input
                className={inputClass}
                value={form.garante_nombre}
                onChange={(event) => setForm({ ...form, garante_nombre: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Tel. garante</label>
              <input
                className={inputClass}
                value={form.garante_telefono}
                onChange={(event) => setForm({ ...form, garante_telefono: event.target.value })}
              />
            </div>
          </div>
          <FileDropzone
            value={form.garante_recibo}
            onChange={(url) => setForm({ ...form, garante_recibo: url })}
            disabled={guardandoEdicion}
            tipo="garante"
            label="Recibo del garante"
            hint="JPG, PNG, WEBP o PDF · máx. 5 MB."
            backendUpload={{ path: '/api/contratos/garantes/recibos', token }}
            eliminarArchivo={async (url) => {
              await apiDelete('/api/contratos/garantes/recibos', token, { url });
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={guardandoEdicion}
              onClick={() => setEdicionAbierta(false)}
              className={`px-4 py-2.5 text-sm font-semibold ${btnRedOutlineClass}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoEdicion}
              className={`px-4 py-2.5 text-sm font-semibold ${btnVioletOutlineClass}`}
            >
              {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
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
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                const propiedadSeleccionada = propiedades.find((propiedad) => propiedad._id === e.target.value);
                setForm({
                  ...form,
                  id_propiedad: e.target.value,
                  monto_mensual: propiedadSeleccionada ? String(propiedadSeleccionada.valor_base) : '',
                });
              }}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Fecha inicio</label>
              <input
                required
                type="date"
                className={inputClass}
                value={form.fecha_inicio}
                onChange={(e) => setForm({
                  ...form,
                  fecha_inicio: e.target.value,
                  fecha_fin: form.fecha_fin && form.fecha_fin < e.target.value ? '' : form.fecha_fin,
                })}
              />
            </div>
            <div>
              <label className={labelClass}>Fecha de fin</label>
              <input
                required
                type="date"
                min={form.fecha_inicio}
                className={inputClass}
                value={form.fecha_fin}
                onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
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
              step="0.01"
              className={inputClass}
              value={form.monto_mensual}
              onChange={(event) => setForm({ ...form, monto_mensual: event.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">
              Valor base sugerido de la propiedad; podés modificarlo según el monto acordado.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            hint="JPG, PNG, WEBP o PDF · máx. 5 MB."
            backendUpload={{ path: '/api/contratos/garantes/recibos', token }}
            eliminarArchivo={async (url) => {
              await apiDelete('/api/contratos/garantes/recibos', token, { url });
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              className={`px-4 py-2.5 text-sm font-semibold ${btnRedOutlineClass}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className={`px-4 py-2.5 text-sm font-semibold ${btnVioletOutlineClass}`}
            >
              {guardando ? 'Creando...' : 'Crear borrador'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
