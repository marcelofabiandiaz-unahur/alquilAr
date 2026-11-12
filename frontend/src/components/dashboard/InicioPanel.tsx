import { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import DashboardWelcome from './DashboardWelcome';
import LoadingRow from '../ui/LoadingRow';
import { formatMoneda } from '../../lib/estadoStyles';
import { apiGet } from '../../lib/apiClient';
import Alert from '../ui/Alert';
import { btnSecondaryClass } from '../layout/dashboardStyles';
import {
  cobradoEnMesPorFechaPago,
  cuotasPendientesEsteMes,
  fechaLocal,
  proximasCuotasPendientes,
} from '../../lib/resumenFinanciero';
import { conAgrupamiento } from '../../lib/agrupamientos';
import type {
  DashboardProps,
  FiltroCobros,
  FiltroContratos,
  FiltroPropiedades,
  FiltroReclamos,
  FiltroPagos,
  Pago,
  Propiedad,
  Reclamo,
  Contrato,
  Gasto,
  ResumenDashboard,
  Usuario,
} from '../../types';

export default function InicioPanel({
  usuario,
  token,
  roles,
  setSeccionActiva,
  setFiltroPagos,
  setFiltroCobros,
  setFiltroPropiedades,
  setFiltroReclamos,
  setFiltroContratos,
  setFiltroUsuarios,
  irAGastosEsteMes,
  idAgrupamiento = '',
}: DashboardProps) {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const tieneAccesoOperativo = roles.esPropietario || roles.esInquilino;
  const tieneAccesoPropiedades = roles.esPropietario || roles.esAdministrador;
  const tieneAccesoFinanzas = roles.esPropietario;
  const tieneResumenOperativo = roles.esInquilino || roles.esPropietario || roles.esAdministrador;

  const esAdministrador = roles.esAdministrador;

  const cargarResumen = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [propiedades, pagos, reclamos, contratos, usuarios, gastos] = await Promise.all([
        tieneAccesoPropiedades
          ? apiGet<Propiedad[]>(conAgrupamiento('/api/propiedades', idAgrupamiento), token)
          : Promise.resolve([] as Propiedad[]),
        tieneAccesoOperativo
          ? apiGet<Pago[]>(conAgrupamiento('/api/pagos', idAgrupamiento), token)
          : Promise.resolve([] as Pago[]),
        tieneAccesoOperativo
          ? apiGet<Reclamo[]>(conAgrupamiento('/api/reclamos', idAgrupamiento), token)
          : Promise.resolve([] as Reclamo[]),
        tieneAccesoOperativo || esAdministrador
          ? apiGet<Contrato[]>(conAgrupamiento('/api/contratos', idAgrupamiento), token)
          : Promise.resolve([] as Contrato[]),
        esAdministrador
          ? apiGet<Usuario[]>('/api/usuarios', token)
          : Promise.resolve([] as Usuario[]),
        roles.esPropietario
          ? apiGet<Gasto[]>(conAgrupamiento('/api/gastos', idAgrupamiento), token)
          : Promise.resolve([] as Gasto[]),
      ]);

      if (![propiedades, pagos, reclamos, contratos, gastos].every(Array.isArray)) {
        throw new Error('El backend devolvió una respuesta inesperada.');
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const limiteVencimiento = new Date(hoy);
      limiteVencimiento.setDate(limiteVencimiento.getDate() + 30);

      const propiedadesActivas = propiedades.filter((p) => p.estado !== 'INACTIVA');
      const alquiladas = propiedades.filter((p) => p.estado === 'ALQUILADA').length;
      const gastosDelMes = gastos.filter((gasto) => {
        const fecha = fechaLocal(gasto.fecha_emision);
        return fecha
          && fecha.getFullYear() === hoy.getFullYear()
          && fecha.getMonth() === hoy.getMonth();
      });
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
      const pagosPendientes = pagosComoInquilino.filter((pago) => pago.estado === 'PENDIENTE');
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
      const pagosEsteMes = cuotasPendientesEsteMes(pagos, hoy);
      const proximasCuotas = proximasCuotasPendientes(pagos, hoy);
      const proximaCuota = proximasCuotas[0];

      setResumen({
        aCobrar: pagosEsteMes.reduce((total, pago) => total + pago.monto_total, 0),
        proximasCuotas: proximasCuotas.reduce((total, pago) => total + pago.monto_total, 0),
        proximasCuotasCantidad: proximasCuotas.length,
        proximaCuotaFecha: proximaCuota
          ? fechaLocal(proximaCuota.fecha_vencimiento)?.toLocaleDateString('es-AR') ?? null
          : null,
        cobrado: pagos
          .filter((pago) => pago.estado === 'PAGADO')
          .reduce((total, pago) => total + pago.monto_total, 0),
        cobradoEsteMes: cobradoEnMesPorFechaPago(pagos, hoy),
        pendiente: pagosPendientes.reduce((total, pago) => total + pago.monto_total, 0),
        vencido: pagos
          .filter((pago) => pago.estado === 'ATRASADO')
          .reduce((total, pago) => total + pago.monto_total, 0),
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
        contratosPendientesActivacion: contratos.filter((contrato) => contrato.estado === 'BORRADOR').length,
        totalPropiedades: propiedadesActivas.length,
        propietariosActivos,
        ingresoMesActual: 0,
        ingresoMesAnterior: 0,
        tasaOcupacion,
        gastosEsteMes: gastosDelMes.reduce((total, gasto) => total + gasto.monto_total, 0),
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
    roles.esPropietario,
    usuario._id,
    token,
    idAgrupamiento,
  ]);

  useEffect(() => {
    if (!tieneResumenOperativo) return undefined;
    const timer = setTimeout(cargarResumen, 0);
    return () => clearTimeout(timer);
  }, [cargarResumen, tieneResumenOperativo]);

  const subtitulo = esAdministrador
    ? 'Resumen general de la plataforma y su operación.'
    : roles.esPropietario
      ? 'Estado de tus propiedades, contratos y cobros.'
      : roles.esInquilino
        ? 'Tus próximos vencimientos, contratos y reclamos.'
        : 'Esto es lo que está pasando con tus alquileres y contratos hoy.';
  const irAPagos = (filtro: FiltroPagos) => {
    setFiltroPagos(filtro);
    setSeccionActiva('pagos');
  };
  const irAFinanzas = (filtro: FiltroCobros) => {
    setFiltroCobros(filtro);
    setSeccionActiva('finanzas');
  };
  const irAPropiedades = (filtro: FiltroPropiedades) => {
    setFiltroPropiedades(filtro);
    setSeccionActiva('propiedades');
  };
  const irAReclamos = (filtro: FiltroReclamos) => {
    setFiltroReclamos(filtro);
    setSeccionActiva('reclamos');
  };
  const irAContratos = (filtro: FiltroContratos) => {
    setFiltroContratos(filtro);
    setSeccionActiva('contratos');
  };
  return (
    <div className="space-y-10">
      <DashboardWelcome
        usuario={usuario}
        subtitulo={subtitulo}
        onVerFinanzas={roles.esPropietario ? () => setSeccionActiva('finanzas') : undefined}
        onVerPropiedades={roles.esPropietario ? () => setSeccionActiva('propiedades') : undefined}
        mostrarAcciones={!esAdministrador}
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
              <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-5 xl:grid-cols-5">
                <MetricCard
                  label="Total propiedades"
                  value={resumen.totalPropiedades ?? 0}
                  icon="propiedades"
                  variant="blue"
                  trend={{ value: 'En el sistema', caption: 'Ver todas' }}
                  onClick={() => irAPropiedades('TODAS')}
                  compact
                />
                <MetricCard
                  label="Disponibles"
                  value={resumen.propiedadesDisponibles}
                  icon="propiedades"
                  variant="emerald"
                  trend={{ value: 'Unidades', caption: 'Para alquilar' }}
                  onClick={() => irAPropiedades('DISPONIBLE')}
                  compact
                />
                <MetricCard
                  label="Propietarios activos"
                  value={resumen.propietariosActivos ?? 0}
                  icon="propietarios"
                  variant="emerald"
                  trend={{ value: 'Cartera', caption: 'Con rol propietario' }}
                  onClick={() => {
                    setFiltroUsuarios('PROPIETARIO');
                    setSeccionActiva('usuarios');
                  }}
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
                  onClick={() => irAPropiedades('ALQUILADA')}
                  compact
                />
                <MetricCard
                  label="Contratos por activar"
                  value={resumen.contratosPendientesActivacion ?? 0}
                  icon="contratos"
                  variant="amber"
                  trend={{ value: 'Borradores', caption: 'Revisar y activar' }}
                  onClick={() => setSeccionActiva('contratos')}
                  compact
                />
              </div>
            )}

            {!esAdministrador && (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
              {tieneAccesoOperativo && !esAdministrador && (
                <>
                  {roles.esPropietario && (
                    <>
                      <MetricCard
                        label="A cobrar este mes"
                        value={formatMoneda(resumen.aCobrar)}
                        icon="efectivo"
                        variant="violet"
                        onClick={() => irAFinanzas('MES_ACTUAL')}
                        compact
                      />
                      <MetricCard
                        label="Próximas cuotas"
                        value={formatMoneda(resumen.proximasCuotas ?? 0)}
                        icon="calendario"
                        variant="sky"
                        trend={resumen.proximaCuotaFecha
                          ? {
                            value: `${resumen.proximasCuotasCantidad ?? 0} cuotas`,
                            caption: `Primera vence ${resumen.proximaCuotaFecha}`,
                          }
                          : undefined}
                        onClick={() => irAFinanzas('PROXIMAS')}
                        compact
                      />
                      <MetricCard
                        label="Cobrado Total"
                        value={formatMoneda(resumen.cobrado)}
                        icon="check"
                        variant="emerald"
                        onClick={() => irAFinanzas('PAGADO')}
                        compact
                      />
                      <MetricCard
                        label="Cobrado este mes"
                        value={formatMoneda(resumen.cobradoEsteMes ?? 0)}
                        icon="check"
                        variant="emerald"
                        onClick={() => irAFinanzas('COBRADO_MES')}
                        compact
                      />
                    </>
                  )}
                  {roles.esInquilino && (
                    <>
                      <MetricCard
                        label="Pendiente"
                        value={formatMoneda(resumen.pendiente ?? 0)}
                        icon="efectivo"
                        variant="violet"
                        hint={(resumen.pendiente ?? 0) > 0
                          ? 'Por pagar'
                          : (resumen.vencido ?? 0) > 0 ? 'Hay vencidos' : 'Al día'}
                        onClick={() => irAPagos('PENDIENTE')}
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
                        onClick={() => irAPagos('PENDIENTE')}
                        compact
                      />
                    </>
                  )}
                  <MetricCard
                    label={roles.esInquilino ? 'Vencido' : 'Pagos atrasados'}
                    value={formatMoneda(resumen.vencido ?? 0)}
                    icon="alerta"
                    variant="rose"
                    hint={`${resumen.atrasados} cuotas`}
                    onClick={() => roles.esInquilino
                      ? irAPagos('ATRASADO')
                      : irAFinanzas('ATRASADO')}
                    compact
                  />
                  {tieneAccesoFinanzas && (
                    <MetricCard
                      label="Cobros para validar"
                      value={resumen.cobrosParaValidar}
                      icon="comprobante"
                      variant="blue"
                      onClick={() => irAFinanzas('INGRESADO')}
                      compact
                    />
                  )}
                  <MetricCard
                    label="Reclamos abiertos"
                    value={resumen.reclamosAbiertos}
                    icon="reclamos"
                    variant="amber"
                    onClick={() => irAReclamos('ABIERTOS')}
                    compact
                  />
                  <MetricCard
                    label="Contratos por vencer"
                    value={resumen.contratosPorVencer}
                    icon="calendario"
                    variant="sky"
                    hint="30 días"
                    onClick={() => irAContratos('POR_VENCER')}
                    compact
                  />
                </>
              )}
              {tieneAccesoPropiedades && !esAdministrador && (
                <>
                  <MetricCard
                    label="Gastos de este mes"
                    value={formatMoneda(resumen.gastosEsteMes ?? 0)}
                    icon="comprobante"
                    variant="amber"
                    onClick={irAGastosEsteMes}
                    compact
                  />
                  <MetricCard
                    label="Unidades disponibles"
                    value={resumen.propiedadesDisponibles}
                    icon="propiedades"
                    variant="emerald"
                    onClick={() => irAPropiedades('DISPONIBLE')}
                    compact
                  />
                  <MetricCard
                    label="Unidades alquiladas"
                    value={resumen.propiedadesAlquiladas}
                    icon="llave"
                    variant="blue"
                    onClick={() => irAPropiedades('ALQUILADA')}
                    compact
                  />
                </>
              )}
              </div>
            )}
            </>
          ) : null}
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
