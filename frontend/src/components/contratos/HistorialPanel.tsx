import { useEffect, useState } from 'react';
import { formatMoneda } from '../../lib/estadoStyles';
import { obtenerHistorialMock } from '../../lib/operacionMock';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import StatBadge from '../ui/StatBadge';
import LoadingRow from '../ui/LoadingRow';
import type { Contrato } from '../../types';

export default function HistorialPanel() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerHistorialMock().then(setContratos).finally(() => setCargando(false));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Historial de alquileres"
        subtitle="Consultá contratos vigentes y finalizados con sus propiedades asociadas"
      />
      <Card className="p-4 text-sm text-slate-600">
        Vista preparada sobre el modelo de contratos. Se reemplazará el origen mock por la consulta real cuando esté disponible el endpoint histórico.
      </Card>
      {cargando ? <LoadingRow label="Cargando historial..." /> : contratos.length === 0 ? (
        <EmptyState title="Sin historial" description="Todavía no hay contratos para mostrar." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {contratos.map((contrato) => (
            <Card key={contrato._id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-[#14213D]">
                    {typeof contrato.id_propiedad === 'object'
                      ? contrato.id_propiedad.direccion || 'Propiedad sin dirección'
                      : 'Propiedad sin dirección'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {typeof contrato.id_propiedad === 'object'
                      ? `${contrato.id_propiedad.tipo || ''} · ${contrato.id_propiedad.ambientes || ''} ambientes`
                      : 'Propiedad'}
                  </p>
                </div>
                <StatBadge estado={contrato.estado} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-400">Inicio</dt><dd className="font-medium text-slate-700 mt-1">{contrato.fecha_inicio}</dd></div>
                <div><dt className="text-slate-400">Finalización</dt><dd className="font-medium text-slate-700 mt-1">{contrato.fecha_fin}</dd></div>
                <div><dt className="text-slate-400">Monto mensual</dt><dd className="font-semibold text-emerald-600 mt-1">{formatMoneda(contrato.monto_mensual)}</dd></div>
                <div><dt className="text-slate-400">Vencimiento</dt><dd className="font-medium text-slate-700 mt-1">Día {contrato.dia_vencimiento}</dd></div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}