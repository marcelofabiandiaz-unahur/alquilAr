import { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card';
import LoadingRow from '../ui/LoadingRow';
import { formatMoneda } from '../../lib/estadoStyles';
import { apiGet } from '../../lib/apiClient';
import Alert from '../ui/Alert';
import { btnSecondaryClass } from '../layout/dashboardStyles';
import type { DashboardProps, Pago, Propiedad, Reclamo, Contrato, ResumenDashboard } from '../../types';

const ACCESO_STYLES: Partial<Record<string, string>> = {
  propiedades: 'bg-emerald-50 text-emerald-600',
  contratos: 'bg-sky-50 text-sky-600',
  usuarios: 'bg-violet-50 text-violet-600',
  buscar: 'bg-amber-50 text-amber-600',
};

function MetricCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="p-5 h-full hover:border-emerald-200 hover:shadow-md transition-all">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-3 ${tone}`}>{value}</p>
      </Card>
    </button>
  );
}

interface AccesoRapido {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

export default function InicioPanel({ usuario, token, roles, setSeccionActiva }: DashboardProps) {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const tieneAccesoOperativo = roles.esPropietario || roles.esInquilino || roles.esAdministrador;
  const tieneAccesoPropiedades = roles.esPropietario || roles.esAdministrador;
  const tieneAccesoCobros = roles.esPropietario || roles.esAdministrador;
  const tieneResumenOperativo = roles.esInquilino || roles.esPropietario || roles.esAdministrador;
  const seccionPagos = tieneAccesoCobros ? 'cobros' : 'pagos';

  const cargarResumen = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [disponibles, propiedades, pagos, reclamos, contratos] = await Promise.all([
        apiGet<Propiedad[]>('/api/propiedades/disponibles', token),
        tieneAccesoPropiedades
          ? apiGet<Propiedad[]>('/api/propiedades', token)
          : Promise.resolve([] as Propiedad[]),
        tieneAccesoOperativo ? apiGet<Pago[]>('/api/pagos', token) : Promise.resolve([] as Pago[]),
        tieneAccesoOperativo ? apiGet<Reclamo[]>('/api/reclamos', token) : Promise.resolve([] as Reclamo[]),
        tieneAccesoOperativo ? apiGet<Contrato[]>('/api/contratos', token) : Promise.resolve([] as Contrato[]),
      ]);

      if (![disponibles, propiedades, pagos, reclamos, contratos].every(Array.isArray)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const limiteVencimiento = new Date(hoy);
      limiteVencimiento.setDate(limiteVencimiento.getDate() + 30);

      setResumen({
        aCobrar: pagos
          .filter((pago) => ['PENDIENTE', 'ATRASADO', 'INGRESADO'].includes(pago.estado))
          .reduce((total, pago) => total + pago.monto_total, 0),
        cobrado: pagos
          .filter((pago) => pago.estado === 'PAGADO')
          .reduce((total, pago) => total + pago.monto_total, 0),
        cobrosParaValidar: pagos.filter((pago) => pago.estado === 'INGRESADO').length,
        atrasados: pagos.filter((pago) => pago.estado === 'ATRASADO').length,
        reclamosAbiertos: reclamos.filter(
          (reclamo) => reclamo.estado !== 'RESUELTO' && reclamo.estado !== 'CANCELADO',
        ).length,
        contratosPorVencer: contratos.filter((contrato) => {
          if (contrato.estado !== 'VIGENTE' || !contrato.fecha_fin) return false;
          const fechaFin = new Date(`${contrato.fecha_fin.slice(0, 10)}T12:00:00`);
          return fechaFin >= hoy && fechaFin <= limiteVencimiento;
        }).length,
        propiedadesDisponibles: disponibles.length,
        propiedadesAlquiladas: propiedades.filter((propiedad) => propiedad.estado === 'ALQUILADA').length,
        contratos: contratos.length,
      });
    } catch (err) {
      setResumen(null);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los indicadores.');
    } finally {
      setCargando(false);
    }
  }, [tieneAccesoOperativo, tieneAccesoPropiedades, token]);

  useEffect(() => {
    if (!tieneResumenOperativo) return undefined;
    const timer = setTimeout(cargarResumen, 0);
    return () => clearTimeout(timer);
  }, [cargarResumen, tieneResumenOperativo]);

  const accesos: AccesoRapido[] = [];

  if (roles.esPropietario) {
    accesos.push({ id: 'propiedades', label: 'Mis Propiedades', desc: 'ABM de inmuebles', icon: '🏢' });
    accesos.push({ id: 'contratos', label: 'Contratos', desc: 'Borradores y vigentes', icon: '📜' });
    accesos.push({ id: 'gastos', label: 'Gastos', desc: 'Costos por propiedad', icon: '🧾' });
  }
  if (roles.esInquilino && !roles.esPropietario) {
    accesos.push({ id: 'contratos', label: 'Mis Contratos', desc: 'Contratos activos', icon: '📜' });
    accesos.push({ id: 'historial', label: 'Historial', desc: 'Alquileres anteriores', icon: '🗂️' });
  }
  if (roles.esAdministrador) {
    accesos.push({ id: 'usuarios', label: 'Usuarios', desc: 'Roles y permisos', icon: '👥' });
  }
  if (tieneAccesoCobros) {
    accesos.push({ id: 'cobros', label: 'Cobros', desc: 'Comprobantes para validar', icon: '💰' });
  }
  if (roles.esUsuarioBase) {
    accesos.push({ id: 'buscar', label: 'Buscar alquileres', desc: 'Propiedades disponibles', icon: '🔍' });
  }

  return (
    <div className="space-y-8">
      <Card className="p-6 lg:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Bienvenido</p>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#14213D] mt-2">
          Hola, {usuario.nombre} 👋
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Gestioná propiedades, contratos y usuarios desde un panel centralizado. Tus roles activos:{' '}
          <span className="font-semibold text-slate-700">{usuario.roles.join(', ')}</span>.
        </p>
      </Card>

      {tieneResumenOperativo && (
        <div>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Resumen operativo</h2>
              <p className="text-sm text-slate-500 mt-1">Indicadores operativos de los registros visibles para tu cuenta.</p>
            </div>
            <span className="text-xs text-slate-400">Datos de tu cuenta actualizados desde el sistema</span>
          </div>
          {error && (
            <div className="space-y-2">
              <Alert theme="light">{error}</Alert>
              <button type="button" className={btnSecondaryClass} onClick={() => void cargarResumen()}>
                Reintentar
              </button>
            </div>
          )}
          {cargando ? (
            <LoadingRow label="Cargando indicadores..." />
          ) : resumen ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {tieneAccesoOperativo && (
                <>
                  {!roles.esInquilino && (
                    <>
                      <MetricCard label="A cobrar" value={formatMoneda(resumen.aCobrar)} tone="text-[#14213D]" onClick={() => setSeccionActiva(seccionPagos)} />
                      <MetricCard label="Cobrado" value={formatMoneda(resumen.cobrado)} tone="text-emerald-600" onClick={() => setSeccionActiva(seccionPagos)} />
                    </>
                  )}
                  <MetricCard label="Pagos atrasados" value={resumen.atrasados} tone="text-red-600" onClick={() => setSeccionActiva(seccionPagos)} />
                  {tieneAccesoCobros && (
                    <MetricCard
                      label="Cobros para validar"
                      value={resumen.cobrosParaValidar}
                      tone="text-violet-600"
                      onClick={() => setSeccionActiva('cobros')}
                    />
                  )}
                  <MetricCard label="Reclamos abiertos" value={resumen.reclamosAbiertos} tone="text-amber-600" onClick={() => setSeccionActiva('reclamos')} />
                  <MetricCard label="Contratos por vencer (30 días)" value={resumen.contratosPorVencer} tone="text-sky-600" onClick={() => setSeccionActiva('historial')} />
                </>
              )}
              {!roles.esInquilino && (
                <MetricCard label="Propiedades disponibles" value={resumen.propiedadesDisponibles} tone="text-emerald-600" onClick={() => setSeccionActiva('buscar')} />
              )}
              {tieneAccesoPropiedades && (
                <MetricCard label="Propiedades alquiladas" value={resumen.propiedadesAlquiladas} tone="text-sky-600" onClick={() => setSeccionActiva('propiedades')} />
              )}
            </div>
          ) : null}
        </div>
      )}

      {accesos.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
            Accesos rápidos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accesos.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSeccionActiva(item.id)}
                className="text-left group"
              >
                <Card className="p-5 h-full hover:border-emerald-200 hover:shadow-md transition-all">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${ACCESO_STYLES[item.id] || 'bg-slate-100 text-slate-600'}`}
                  >
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-[#14213D] mt-4 group-hover:text-emerald-700 transition-colors">
                    {item.label}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">{item.desc}</p>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl lg:text-3xl font-bold text-[#14213D]">{title}</h1>
      <Card className="p-8 text-center">
        <p className="text-slate-600">{description}</p>
        <p className="text-slate-400 text-sm mt-2">Disponible en una próxima iteración (S5+)</p>
      </Card>
    </div>
  );
}
