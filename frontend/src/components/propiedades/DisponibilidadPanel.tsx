import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { formatMoneda } from '../../lib/estadoStyles';
import { obtenerPropiedadesDisponiblesMock } from '../../lib/operacionMock';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import PropertyPhotoCarousel from './PropertyPhotoCarousel';
import { inputClass } from '../layout/dashboardStyles';
import type { Propiedad } from '../../types';

export default function DisponibilidadPanel() {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('TODOS');
  const [ambientes, setAmbientes] = useState('TODOS');

  useEffect(() => {
    obtenerPropiedadesDisponiblesMock().then(setPropiedades);
  }, []);

  const tipos = useMemo(() => ['TODOS', ...new Set(propiedades.map((propiedad) => propiedad.tipo))], [propiedades]);
  const resultados = useMemo(() => propiedades.filter((propiedad) => {
    const texto = `${propiedad.direccion} ${propiedad.descripcion}`.toLowerCase();
    const coincideBusqueda = texto.includes(busqueda.toLowerCase());
    const coincideTipo = tipo === 'TODOS' || propiedad.tipo === tipo;
    const coincideAmbientes = ambientes === 'TODOS' || propiedad.ambientes >= Number(ambientes);
    return coincideBusqueda && coincideTipo && coincideAmbientes;
  }), [ambientes, busqueda, propiedades, tipo]);

  return (
    <div className="space-y-4">
      <PageHeader title="Buscar alquileres" subtitle="Encontrá propiedades disponibles para iniciar una consulta" />
      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className={inputClass} placeholder="Buscar por dirección o descripción" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} />
        <select className={inputClass} value={tipo} onChange={(event) => setTipo(event.target.value)} aria-label="Filtrar por tipo">
          {tipos.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
        </select>
        <select className={inputClass} value={ambientes} onChange={(event) => setAmbientes(event.target.value)} aria-label="Filtrar por ambientes">
          <option value="TODOS">Cualquier cantidad de ambientes</option>
          <option value="2">2 o más ambientes</option>
          <option value="3">3 o más ambientes</option>
          <option value="4">4 o más ambientes</option>
        </select>
      </Card>
      <p className="text-sm text-slate-500">{resultados.length} propiedades disponibles</p>
      {resultados.length === 0 ? (
        <EmptyState title="Sin resultados" description="Probá con otros filtros de búsqueda." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {resultados.map((propiedad) => (
            <Card key={propiedad._id} className="overflow-hidden">
              <PropertyPhotoCarousel fotos={propiedad.fotos} alt={propiedad.direccion} />
              <div className="p-5 space-y-3">
                <div>
                  <h2 className="font-bold text-[#14213D]">{propiedad.direccion}</h2>
                  <p className="text-sm text-slate-500 mt-1">{propiedad.tipo} · {propiedad.ambientes} ambientes</p>
                </div>
                <p className="text-emerald-600 font-semibold">{formatMoneda(propiedad.valor_base)} por mes</p>
                <p className="text-sm text-slate-500">{propiedad.descripcion}</p>
                <button type="button" className="w-full text-sm font-semibold text-[#14213D] border border-slate-200 rounded-lg px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50 transition-colors">
                  Consultar propiedad
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}