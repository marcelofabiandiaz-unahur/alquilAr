import { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import DashboardWelcome from './DashboardWelcome';
import LoadingRow from '../ui/LoadingRow';
import { formatMoneda } from '../../lib/estadoStyles';
import { apiGet } from '../../lib/apiClient';
import Alert from '../ui/Alert';
import { btnSecondaryClass } from '../layout/dashboardStyles';
import { brandClasses } from '../../theme/alquilar';
import { NavIcon } from '../layout/dashboardNavIcons';
import {
  claveMesActual,
  claveMesAnterior,
  formatearTendenciaPct,
  ingresoCobradoEnMes,
} from '../../lib/resumenFinanciero';
import { conAgrupamiento } from '../../lib/agrupamientos';
import type { DashboardProps, Pago, Propiedad, Reclamo, Contrato, ResumenDashboard, Usuario } from '../../types';

const ACCESO_STYLES: Partial<Record<string, string>> = {
  propiedades: 'bg-violet-50 text-violet-600',
  agrupamientos: 'bg-fuchsia-50 text-fuchsia-600',
  contratos: 'bg-sky-50 text-sky-600',
  usuarios: 'bg-violet-50 text-violet-600',
  finanzas: 'bg-emerald-50 text-emerald-700',
  reportes: 'bg-slate-100 text-slate-700',
  propietarios: 'bg-violet-50 text-violet-700',
  pagos: 'bg-sky-50 text-sky-600',
  reclamos: 'bg-amber-50 text-amber-600',
  disponibilidad: 'bg-indigo-50 text-indigo-600',
};

function fechaLocal(fecha?: string): Date | null {
  if (!fecha) return null;
  const soloFecha = fecha.slice(0, 10);
  const resultado = /^\d{4}-\d{2}-\d{2}$/.test(soloFecha)
    ? new Date(`${soloFecha}T12:00:00`)
    : new Date(fecha);
  return Number.isNaN(resultado.getTime()) ? null : resultado;
}

interface AccesoRapido {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

export default function InicioPanel({ usuario, token, roles, setSeccionActiva, idAgrupamiento = '' }: DashboardProps) {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const tieneAccesoOperativo = roles.esPropietario || roles.esInquilino || roles.esAdministrador;
  const tieneAccesoPropiedades = roles.esPropietario || roles.esAdministrador;
  const tieneAccesoFinanzas = roles.esPropietario || roles.esAdministrador;
  const tieneResumenOperativo = roles.esInquilino || roles.esPropietario || roles.esAdministrador;
  const seccionPagos = tieneAccesoFinanzas ? 'finanzas' : 'pagos';

  const esAdministrador = roles.esAdministrador;

  const cargarResumen = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [propiedades, pagos, reclamos, contratos, usuarios] = await Promise.all([
        tieneAccesoPropiedades
          ? apiGet<Propiedad[]>(conAgrupamiento('/api/propiedades', idAgrupamiento), token)
          : Promise.resolve([] as Propiedad[]),
        tieneAccesoOperativo
          ? apiGet<Pago[]>(conAgrupamiento('/api/pagos', idAgrupamiento), token)
          : Promise.resolve([] as Pago[]),
        tieneAccesoOperativo
          ? apiGet<Reclamo[]>(conAgrupamiento('/api/reclamos', idAgrupamiento), token)
          : Promise.resolve([] as Reclamo[]),
        tieneAccesoOperativo
          ? apiGet<Contrato[]>(conAgrupamiento('/api/contratos', idAgrupamiento), token)
          : Promise.resolve([] as Contrato[]),
        esAdministrador
          ? apiGet<Usuario[]>('/api/usuarios', token)
          : Promise.resolve([] as Usuario[]),
      ]);

      if (![propiedades, pagos, reclamos, contratos].every(Array.isArray)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const limiteVencimiento = new Date(hoy);
      limiteVencimiento.setDate(limiteVencimiento.getDate() + 30);

      const propiedadesActivas = propiedades.filter((p) => p.estado !== 'INACTIVA');
      const alquiladas = propiedades.filter((p) => p.estado === 'ALQUILADA').length;
      const mesActual = claveMesActual();
      const mesAnterior = claveMesAnterior();
      const ingresoMesActual = ingresoCobradoEnMes(pagos, mesActual);
      const ingresoMesAnterior = ingresoCobradoEnMes(pagos, mesAnterior);
      const propietariosActivos = usuarios.filter(
        (u) => u.roles.includes('PROPIETARIO') && (!u.estado || u.estado === 'ACTIVO'),
      ).length;
      const tasaOcupacion = propiedadesActivas.length > 0
        ? (alquiladas / propiedadesActivas.length) * 100
        : 0;

      const idUsuario = usuario._id ? String(usuario._id) : '';
      const pagosComoInquilino = roles.esInquilino
        ? pagos.filter((pago) => {
          if (!idUsuario) return true;
          if (!pago.id_contrato || typeof pago.id_contrato === 'string') return false;
          return String(pago.id_contrato.id_inquilino) === idUsuario;
        })
        : [];
      const pagosPendientes = pagosComoInquilino.filter(
        (pago) => ['PENDIENTE', 'ATRASADO'].includes(pago.estado),
      );
      const aPagar = pagosPendientes.reduce((total, pago) => total + pago.monto_total, 0);
      const proximoPago = [...pagosPendientes]
        .filter((pago) => {
          const fecha = fechaLocal(pago.fecha_vencimiento);
          return Boolean(fecha && fecha >= hoy);
        })
        .sort((a, b) =>
          (fechaLocal(a.fecha_vencimiento)?.getTime() ?? Number.MAX_SAFE_INTEGER)
          - (fechaLocal(b.fecha_vencimiento)?.getTime() ?? Number.MAX_SAFE_INTEGER))[0];
      const proximoVencimiento = proximoPago
        ? fechaLocal(proximoPago.fecha_vencimiento)?.toLocaleDateString('es-AR') ?? null
        : null;

      setResumen({
        aCobrar: pagos
          .filter((pago) => ['PENDIENTE', 'ATRASADO', 'INGRESADO'].includes(pago.estado))
          .reduce((total, pago) => total + pago.monto_total, 0),
        cobrado: pagos
          .filter((pago) => pago.estado === 'PAGADO')
          .reduce((total, pago) => total + pago.monto_total, 0),
        aPagar,
        proximoVencimiento,
        proximoVencimientoMonto: proximoPago?.monto_total ?? 0,
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
        propiedadesDisponibles: propiedades.filter((propiedad) => propiedad.estado === 'DISPONIBLE').length,
        propiedadesAlquiladas: alquiladas,
        contratos: contratos.length,
        totalPropiedades: propiedadesActivas.length,
        propietariosActivos,
        ingresoMesActual,
        ingresoMesAnterior,
        tasaOcupacion,
      });
    } catch (err) {
      setResumen(null);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los indicadores.');
    } finally {
      setCargando(false);
    }
  }, [
    esAdministrador,
    tieneAccesoOperativo,
    tieneAccesoPropiedades,
    roles.esInquilino,
    usuario._id,
    token,
    idAgrupamiento,
  ]);

  useEffect(() => {
    if (!tieneResumenOperativo) return undefined;
    const timer = setTimeout(cargarResumen, 0);
    return () => clearTimeout(timer);
  }, [cargarResumen, tieneResumenOperativo]);

  const accesos: AccesoRapido[] = [];

  if (roles.esPropietario || roles.esAdministrador) {
    accesos.push({
      id: 'propiedades',
      label: roles.esAdministrador && !roles.esPropietario ? 'Propiedades' : 'Mis propiedades',
      desc: 'Inmuebles y estado operativo',
      icon: 'propiedades',
    });
    accesos.push({
      id: 'agrupamientos',
      label: 'Agrupamientos',
      desc: 'Edificios y complejos',
      icon: 'agrupamientos',
    });
  }
  if (roles.esPropietario) {
    accesos.push({ id: 'contratos', label: 'Contratos', desc: 'Borradores y vigentes', icon: 'contratos' });
  }
  if (roles.esInquilino && !roles.esPropietario) {
    accesos.push({ id: 'contratos', label: 'Mis Contratos', desc: 'Contratos activos', icon: 'contratos' });
    accesos.push({ id: 'historial', label: 'Historial', desc: 'Alquileres anteriores', icon: 'historial' });
  }
  if (roles.esInquilino) {
    accesos.push({ id: 'pagos', label: 'Mis pagos', desc: 'Cuotas y comprobantes', icon: 'pagos' });
  }
  if (!roles.esAdministrador && (roles.esInquilino || roles.esUsuarioBase)) {
    accesos.push({
      id: 'disponibilidad',
      label: 'Buscar alquileres',
      desc: 'Propiedades disponibles',
      icon: 'disponibilidad',
    });
  }
  if (tieneAccesoFinanzas) {
    accesos.push({ id: 'finanzas', label: 'Finanzas', desc: 'Cobros y gastos', icon: 'finanzas' });
    accesos.push({ id: 'reportes', label: 'Reportes', desc: 'Resumen del período', icon: 'reportes' });
  }
  if (tieneAccesoOperativo) {
    accesos.push({ id: 'reclamos', label: 'Reclamos', desc: 'Incidencias y seguimiento', icon: 'reclamos' });
  }
  if (roles.esAdministrador) {
    accesos.push({ id: 'propietarios', label: 'Propietarios', desc: 'Cartera de propietarios', icon: 'propietarios' });
    accesos.push({ id: 'usuarios', label: 'Usuarios', desc: 'Roles y permisos', icon: 'usuarios' });
  }

  const puedeVerPropiedades = roles.esPropietario || roles.esAdministrador;
  const subtitulo = esAdministrador
    ? 'Resumen general de la plataforma y su operación.'
    : roles.esPropietario
      ? 'Estado de tus propiedades, contratos y cobros.'
      : roles.esInquilino
        ? 'Tus próximos vencimientos, contratos y reclamos.'
        : 'Esto es lo que está pasando con tus alquileres y contratos hoy.';
  const onVerPagos = roles.esInquilino ? () => setSeccionActiva('pagos') : undefined;

  return (
    <div className="space-y-10">
      <DashboardWelcome
        usuario={usuario}
        subtitulo={subtitulo}
        onVerFinanzas={tieneAccesoFinanzas ? () => setSeccionActiva('finanzas') : undefined}
        onVerPropiedades={puedeVerPropiedades ? () => setSeccionActiva('propiedades') : undefined}
        onVerPagos={onVerPagos}
        mostrarAcciones={tieneAccesoFinanzas || puedeVerPropiedades || roles.esInquilino}
      />

      {tieneResumenOperativo && (
        <div>
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-violet-950">
                {esAdministrador ? 'Vista general' : 'Resumen operativo'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {esAdministrador
                  ? 'Indicadores de la plataforma y detalle operativo.'
                  : 'Indicadores clave de tu cuenta.'}
              </p>
            </div>
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
            <>
            {esAdministrador && (
              <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-5 xl:grid-cols-4">
                <MetricCard
                  label="Total propiedades"
                  value={resumen.totalPropiedades ?? 0}
                  icon="propiedades"
                  variant="blue"
                  trend={{ value: `${resumen.propiedadesDisponibles} disponibles`, caption: 'En el sistema' }}
                  onClick={() => setSeccionActiva('propiedades')}
                  compact
                />
                <MetricCard
                  label="Propietarios activos"
                  value={resumen.propietariosActivos ?? 0}
                  icon="propietarios"
                  variant="emerald"
                  trend={{ value: 'Cartera', caption: 'Con rol propietario' }}
                  onClick={() => setSeccionActiva('propietarios')}
                  compact
                />
                <MetricCard
                  label="Ingresos del mes"
                  value={formatMoneda(resumen.ingresoMesActual ?? 0)}
                  icon="efectivo"
                  variant="violet"
                  trend={{
                    value:
                      formatearTendenciaPct(
                        resumen.ingresoMesActual ?? 0,
                        resumen.ingresoMesAnterior ?? 0,
                      ) ?? 'Sin histórico',
                    caption: 'vs mes anterior',
                  }}
                  onClick={() => setSeccionActiva('finanzas')}
                  compact
                />
                <MetricCard
                  label="Tasa de ocupación"
                  value={`${(resumen.tasaOcupacion ?? 0).toFixed(1)}%`}
                  icon="tendencia"
                  variant="sky"
                  trend={{
                    value: `${resumen.propiedadesAlquiladas} alquiladas`,
                    caption: 'Unidades ocupadas',
                  }}
                  onClick={() => setSeccionActiva('propiedades')}
                  compact
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
              {tieneAccesoOperativo && !esAdministrador && (
                <>
                  {roles.esPropietario && (
                    <>
                      <MetricCard
                        label="A cobrar"
                        value={formatMoneda(resumen.aCobrar)}
                        icon="efectivo"
                        variant="violet"
                        hint="Pendiente"
                        onClick={() => setSeccionActiva(seccionPagos)}
                        compact
                      />
                      <MetricCard
                        label="Cobrado"
                        value={formatMoneda(resumen.cobrado)}
                        icon="check"
                        variant="emerald"
                        onClick={() => setSeccionActiva(seccionPagos)}
                        compact
                      />
                    </>
                  )}
                  {roles.esInquilino && (
                    <>
                      <MetricCard
                        label="Total a pagar"
                        value={formatMoneda(resumen.aPagar ?? 0)}
                        icon="efectivo"
                        variant="violet"
                        hint={(resumen.aPagar ?? 0) > 0 ? 'Pendiente' : 'Al día'}
                        onClick={() => setSeccionActiva('pagos')}
                        compact
                      />
                      <MetricCard
                        label="Próximo vencimiento"
                        value={resumen.proximoVencimiento
                          ? formatMoneda(resumen.proximoVencimientoMonto ?? 0)
                          : 'Sin cuotas'}
                        icon="calendario"
                        variant="sky"
                        trend={resumen.proximoVencimiento
                          ? { value: resumen.proximoVencimiento, caption: 'Vence' }
                          : undefined}
                        onClick={() => setSeccionActiva('pagos')}
                        compact
                      />
                    </>
                  )}
                  <MetricCard
                    label="Pagos atrasados"
                    value={resumen.atrasados}
                    icon="alerta"
                    variant="rose"
                    onClick={() => setSeccionActiva(seccionPagos)}
                    compact
                  />
                  {tieneAccesoFinanzas && (
                    <MetricCard
                      label="Cobros para validar"
                      value={resumen.cobrosParaValidar}
                      icon="comprobante"
                      variant="blue"
                      onClick={() => setSeccionActiva('finanzas')}
                      compact
                    />
                  )}
                  <MetricCard
                    label="Reclamos abiertos"
                    value={resumen.reclamosAbiertos}
                    icon="reclamos"
                    variant="amber"
                    onClick={() => setSeccionActiva('reclamos')}
                    compact
                  />
                  <MetricCard
                    label="Contratos por vencer"
                    value={resumen.contratosPorVencer}
                    icon="calendario"
                    variant="sky"
                    hint="30 días"
                    onClick={() => setSeccionActiva('contratos')}
                    compact
                  />
                </>
              )}
              {tieneAccesoPropiedades && !esAdministrador && (
                <>
                  <MetricCard
                    label="Unidades disponibles"
                    value={resumen.propiedadesDisponibles}
                    icon="propiedades"
                    variant="emerald"
                    onClick={() => setSeccionActiva('propiedades')}
                    compact
                  />
                  <MetricCard
                    label="Unidades alquiladas"
                    value={resumen.propiedadesAlquiladas}
                    icon="llave"
                    variant="blue"
                    onClick={() => setSeccionActiva('propiedades')}
                    compact
                  />
                </>
              )}
              {esAdministrador && (
                <>
                  <MetricCard
                    label="Pagos atrasados"
                    value={resumen.atrasados}
                    icon="alerta"
                    variant="rose"
                    onClick={() => setSeccionActiva('finanzas')}
                    compact
                  />
                  <MetricCard
                    label="Cobros para validar"
                    value={resumen.cobrosParaValidar}
                    icon="comprobante"
                    variant="amber"
                    onClick={() => setSeccionActiva('finanzas')}
                    compact
                  />
                  <MetricCard
                    label="Reclamos abiertos"
                    value={resumen.reclamosAbiertos}
                    icon="reclamos"
                    variant="amber"
                    onClick={() => setSeccionActiva('reclamos')}
                    compact
                  />
                  <MetricCard
                    label="Contratos por vencer"
                    value={resumen.contratosPorVencer}
                    icon="calendario"
                    variant="sky"
                    trend={{ value: '30 días', caption: 'Ventana de aviso' }}
                    onClick={() => setSeccionActiva('historial')}
                    compact
                  />
                </>
              )}
            </div>
            </>
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
                <Card className={`p-5 h-full ${brandClasses.cardHover} hover:shadow-md transition-all`}>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${ACCESO_STYLES[item.id] || 'bg-slate-100 text-slate-600'}`}
                  >
                    <NavIcon id={item.icon} />
                  </div>
                  <h3 className="font-semibold text-[var(--brand-navy)] mt-4 group-hover:text-violet-600 transition-colors">
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
      <h1 className="text-2xl lg:text-3xl font-bold text-[var(--brand-navy)]">{title}</h1>
      <Card className="p-8 text-center">
        <p className="text-slate-600">{description}</p>
        <p className="text-slate-400 text-sm mt-2">Disponible en una próxima iteración (S5+)</p>
      </Card>
    </div>
  );
}
