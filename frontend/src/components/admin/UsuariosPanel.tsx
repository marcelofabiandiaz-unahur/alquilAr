import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '../../lib/apiClient';
import PageHeader from '../ui/PageHeader';
import Alert from '../ui/Alert';
import LoadingRow from '../ui/LoadingRow';
import DataTable from '../ui/DataTable';
import { btnPrimaryClass } from '../layout/dashboardStyles';
import type { Role, Usuario } from '../../types';

const ROLE_CHIP_STYLES: Record<Role, string> = {
  USUARIO: 'bg-slate-100 text-slate-700 border-slate-200',
  INQUILINO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PROPIETARIO: 'bg-sky-50 text-sky-700 border-sky-200',
  ADMINISTRADOR: 'bg-violet-50 text-violet-700 border-violet-200',
};

const ROLES_ASIGNABLES: { rol: Extract<Role, 'INQUILINO' | 'PROPIETARIO'>; label: string; className: string }[] = [
  { rol: 'INQUILINO', label: '+ Inquilino', className: `${btnPrimaryClass} text-xs px-3 py-1.5` },
  {
    rol: 'PROPIETARIO',
    label: '+ Propietario',
    className: 'text-xs px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold disabled:opacity-50 transition-colors',
  },
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

export default function UsuariosPanel({ token }: { token: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [accionId, setAccionId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiGet<Usuario[]>('/api/usuarios', token);
      if (!Array.isArray(data)) throw new Error('Respuesta inválida del servidor');
      setUsuarios(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios.');
      setUsuarios([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(cargar, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Usuarios del Sistema"
        subtitle="Gestioná roles de inquilino y propietario"
      />

      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert theme="light" type="success" onClose={() => setInfo('')}>{info}</Alert>}

      {cargando ? (
        <LoadingRow label="Cargando usuarios..." />
      ) : (
        <DataTable
          columns={['Nombre', 'Email', 'Roles', 'Solicitud de propietario', 'Acciones']}
          rows={usuarios}
          renderRow={(usr) => (
            <tr key={usr._id} className="hover:bg-slate-50">
              <td className="p-4 font-medium text-slate-800">
                {usr.nombre} {usr.apellido}
              </td>
              <td className="p-4 text-slate-600">{usr.email}</td>
              <td className="p-4">
                <RoleChips roles={usr.roles} />
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
