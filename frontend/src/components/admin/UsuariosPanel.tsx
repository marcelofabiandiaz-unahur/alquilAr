import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPatch } from '../../lib/apiClient';
import PageHeader from '../ui/PageHeader';
import Alert from '../ui/Alert';
import LoadingRow from '../ui/LoadingRow';
import DataTable from '../ui/DataTable';
import { btnPrimaryClass, inputClass, labelClass } from '../layout/dashboardStyles';
import type { FiltroUsuarios, Propiedad, Role, Usuario } from '../../types';

const ROLE_CHIP_STYLES: Record<Role, string> = {
  USUARIO: 'bg-slate-100 text-slate-700 border-slate-200',
  INQUILINO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PROPIETARIO: 'bg-sky-50 text-sky-700 border-sky-200',
  ADMINISTRADOR: 'bg-violet-50 text-violet-700 border-violet-200',
};

const ESTADO_CHIP_STYLES: Record<'ACTIVO' | 'INACTIVO' | 'PENDIENTE', string> = {
  ACTIVO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVO: 'bg-slate-100 text-slate-600 border-slate-200',
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
};

const ROLES_ASIGNABLES: { rol: Extract<Role, 'INQUILINO' | 'PROPIETARIO'>; label: string; className: string }[] = [
  { rol: 'INQUILINO', label: '+ Inquilino', className: `${btnPrimaryClass} text-xs px-3 py-1.5` },
  {
    rol: 'PROPIETARIO',
    label: '+ Propietario',
    className: 'text-xs px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold disabled:opacity-50 transition-colors',
  },
];

const FILTROS_USUARIOS: { value: FiltroUsuarios; label: string }[] = [
  { value: 'TODOS', label: 'Todos los usuarios' },
  { value: 'PROPIETARIO', label: 'Propietarios' },
  { value: 'INQUILINO', label: 'Inquilinos' },
  { value: 'USUARIO', label: 'Usuarios base' },
  { value: 'ADMINISTRADOR', label: 'Administradores' },
];

const CHIP_BASE =
  'inline-flex items-center justify-center h-6 px-2.5 rounded-md border text-[11px] font-semibold uppercase tracking-wide leading-none font-sans whitespace-nowrap';

function RoleChips({ roles }: { roles: Role[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((rol) => (
        <span
          key={rol}
          className={`${CHIP_BASE} ${ROLE_CHIP_STYLES[rol] || ROLE_CHIP_STYLES.USUARIO}`}
        >
          {rol}
        </span>
      ))}
    </div>
  );
}

interface UsuariosPanelProps {
  token: string;
  filtro: FiltroUsuarios;
  setFiltro: (filtro: FiltroUsuarios) => void;
}

function obtenerIdPropietario(propiedad: Propiedad): string | null {
  const propietario = propiedad.id_propietario;
  if (!propietario) return null;
  return typeof propietario === 'string' ? propietario : propietario._id;
}

export default function UsuariosPanel({ token, filtro, setFiltro }: UsuariosPanelProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [accionId, setAccionId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [usuariosData, propiedadesData] = await Promise.all([
        apiGet<Usuario[]>('/api/usuarios', token),
        apiGet<Propiedad[]>('/api/propiedades', token),
      ]);
      if (!Array.isArray(usuariosData) || !Array.isArray(propiedadesData)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setUsuarios(usuariosData);
      setPropiedades(propiedadesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios y sus propiedades.');
      setUsuarios([]);
      setPropiedades([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(cargar, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const conteoPorPropietario = useMemo(() => {
    const conteo = new Map<string, number>();
    propiedades.forEach((propiedad) => {
      const idPropietario = obtenerIdPropietario(propiedad);
      if (idPropietario) {
        conteo.set(idPropietario, (conteo.get(idPropietario) ?? 0) + 1);
      }
    });
    return conteo;
  }, [propiedades]);

  const usuariosFiltrados = useMemo(
    () => filtro === 'TODOS' ? usuarios : usuarios.filter((usuario) => usuario.roles.includes(filtro)),
    [filtro, usuarios],
  );

  const asignarRol = async (usr: Usuario, rol: Role) => {
    setAccionId(`${usr._id}-${rol}`);
    setError('');
    setInfo('');
    try {
      await apiPatch(`/api/usuarios/${usr._id}/roles`, token, { agregar: [rol] });
      setInfo(`Rol ${rol} asignado a ${usr.email}`);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar el rol.');
    } finally {
      setAccionId(null);
    }
  };

  const aprobarSolicitud = async (usr: Usuario) => {
    setAccionId(`${usr._id}-solicitud`);
    setError('');
    setInfo('');
    try {
      await apiPatch(`/api/usuarios/${usr._id}/solicitud-propietario/aprobar`, token, {});
      setInfo(`Solicitud de propietario aprobada para ${usr.email}.`);
      await cargar();
      window.dispatchEvent(new Event('alquilar:notificaciones-actualizar'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aprobar la solicitud.');
    } finally {
      setAccionId(null);
    }
  };

  const cambiarEstado = async (usr: Usuario) => {
    const estadoActual = usr.estado || 'ACTIVO';
    const nuevoEstado = estadoActual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    if (
      nuevoEstado === 'INACTIVO'
      && !window.confirm(`¿Desactivar la cuenta de ${usr.nombre} ${usr.apellido}?`)
    ) return;

    setAccionId(`${usr._id}-estado`);
    setError('');
    setInfo('');
    try {
      await apiPatch(`/api/usuarios/${usr._id}/estado`, token, { estado: nuevoEstado });
      setInfo(`Cuenta ${nuevoEstado === 'ACTIVO' ? 'activada' : 'desactivada'}: ${usr.email}.`);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del usuario.');
    } finally {
      setAccionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Usuarios"
        subtitle="Gestioná los usuarios, sus roles y solicitudes de propietario"
      />

      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="success" onClose={() => setInfo('')}>{info}</Alert>}

      <div className="max-w-xs">
        <label htmlFor="filtro-usuarios" className={labelClass}>Filtrar por rol</label>
        <select
          id="filtro-usuarios"
          className={inputClass}
          value={filtro}
          onChange={(event) => {
            const opcion = FILTROS_USUARIOS.find(({ value }) => value === event.target.value);
            if (opcion) setFiltro(opcion.value);
          }}
        >
          {FILTROS_USUARIOS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {cargando ? (
        <LoadingRow label="Cargando usuarios..." />
      ) : (
        <DataTable
          columns={['Nombre', 'Email', 'Estado', 'Roles', 'Propiedades', 'Solicitud de propietario', 'Acciones']}
          rows={usuariosFiltrados}
          renderRow={(usr) => (
            <tr key={usr._id} className="hover:bg-slate-50">
              <td className="p-4 font-medium text-slate-800">
                {usr.nombre} {usr.apellido}
              </td>
              <td className="p-4 text-slate-600">{usr.email}</td>
              <td className="p-4">
                {(() => {
                  const estado = usr.estado || 'ACTIVO';
                  return (
                    <span className={`${CHIP_BASE} ${ESTADO_CHIP_STYLES[estado]}`}>
                      {estado}
                    </span>
                  );
                })()}
              </td>
              <td className="p-4">
                <RoleChips roles={usr.roles} />
              </td>
              <td className="p-4 text-slate-600">
                {usr.roles.includes('PROPIETARIO') ? conteoPorPropietario.get(usr._id) ?? 0 : '—'}
              </td>
              <td className="p-4">
                {usr.solicitud_propietario ? (
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold">{usr.solicitud_propietario.estado}</p>
                    <p>Alias/CBU: {usr.solicitud_propietario.cbu_alias}</p>
                    <p>CUIT/CUIL: {usr.solicitud_propietario.cuit_cuil}</p>
                  </div>
                ) : '—'}
              </td>
              <td className="p-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={accionId === `${usr._id}-estado`}
                    onClick={() => void cambiarEstado(usr)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors ${
                      (usr.estado || 'ACTIVO') === 'ACTIVO'
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {accionId === `${usr._id}-estado`
                      ? 'Actualizando...'
                      : (usr.estado || 'ACTIVO') === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                  </button>
                  {usr.solicitud_propietario?.estado === 'PENDIENTE' && (
                    <button
                      type="button"
                      disabled={accionId === `${usr._id}-solicitud`}
                      onClick={() => void aprobarSolicitud(usr)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 transition-colors"
                    >
                      {accionId === `${usr._id}-solicitud` ? 'Aprobando...' : 'Aprobar propietario'}
                    </button>
                  )}
                  {ROLES_ASIGNABLES.filter(({ rol }) => !usr.roles.includes(rol)).map(({ rol, label, className }) => (
                    <button
                      key={rol}
                      type="button"
                      disabled={accionId === `${usr._id}-${rol}`}
                      onClick={() => asignarRol(usr, rol)}
                      className={className}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </div>
  );
}
