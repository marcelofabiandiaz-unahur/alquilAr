import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/apiClient';
import { formatMoneda } from '../../lib/estadoStyles';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import LoadingRow from '../ui/LoadingRow';
import Alert from '../ui/Alert';
import PropertyPhotoCarousel from './PropertyPhotoCarousel';
import { btnSecondaryClass, inputClass } from '../layout/dashboardStyles';
import type { Propiedad } from '../../types';

export default function DisponibilidadPanel({ token }: { token: string }) {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [tipo, setTipo] = useState('TODOS');
  const [ambientes, setAmbientes] = useState('TODOS');
  const [precioMinimo, setPrecioMinimo] = useState('');
  const [precioMaximo, setPrecioMaximo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const datos = await apiGet<Propiedad[]>('/api/propiedades/disponibles', token);
      if (!Array.isArray(datos)) throw new Error('El backend devolvió una respuesta inesperada.');
      setPropiedades(datos);
    } catch (err) {
      setPropiedades([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las propiedades disponibles.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(cargar, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const tipos = useMemo(
    () => ['TODOS', ...new Set(propiedades.map((propiedad) => propiedad.tipo).filter(Boolean))],
    [propiedades],
  );
  const preciosValidos = [precioMinimo, precioMaximo].every(
    (valor) => valor === '' || (Number.isFinite(Number(valor)) && Number(valor) >= 0),
  );
  const rangoValido = preciosValidos
    && (precioMinimo === '' || precioMaximo === '' || Number(precioMinimo) <= Number(precioMaximo));
  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es');
    const zona = ubicacion.trim().toLocaleLowerCase('es');
    const minimo = precioMinimo === '' ? null : Number(precioMinimo);
    const maximo = precioMaximo === '' ? null : Number(precioMaximo);

    return propiedades.filter((propiedad) => {
      const direccion = propiedad.direccion.toLocaleLowerCase('es');
      const descripcion = (propiedad.descripcion || '').toLocaleLowerCase('es');
      const coincideTexto = !texto || `${direccion} ${descripcion}`.includes(texto);
      const coincideUbicacion = !zona || direccion.includes(zona);
      const coincideTipo = tipo === 'TODOS' || propiedad.tipo === tipo;
      const coincideAmbientes = ambientes === 'TODOS' || propiedad.ambientes >= Number(ambientes);
      const coincidePrecio = (minimo === null || propiedad.valor_base >= minimo)
        && (maximo === null || propiedad.valor_base <= maximo);
      return coincideTexto && coincideUbicacion && coincideTipo && coincideAmbientes && coincidePrecio;
    });
  }, [ambientes, busqueda, precioMaximo, precioMinimo, propiedades, tipo, ubicacion]);

  return (
    <div className="space-y-4">
      <PageHeader title="Buscar alquileres" subtitle="Encontrá propiedades disponibles para iniciar una consulta" />
      <Card className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <input
          className={inputClass}
          placeholder="Buscar por dirección o descripción"
          aria-label="Buscar propiedad"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Ubicación o dirección"
          aria-label="Filtrar por ubicación"
          value={ubicacion}
          onChange={(event) => setUbicacion(event.target.value)}
        />
        <select className={inputClass} value={tipo} onChange={(event) => setTipo(event.target.value)} aria-label="Filtrar por tipo">
          {tipos.map((opcion) => <option key={opcion} value={opcion}>{opcion === 'TODOS' ? 'Todos los tipos' : opcion}</option>)}
        </select>
        <select className={inputClass} value={ambientes} onChange={(event) => setAmbientes(event.target.value)} aria-label="Filtrar por ambientes">
          <option value="TODOS">Cualquier cantidad de ambientes</option>
          <option value="1">1 o más ambientes</option>
          <option value="2">2 o más ambientes</option>
          <option value="3">3 o más ambientes</option>
          <option value="4">4 o más ambientes</option>
        </select>
        <input
          className={inputClass}
          type="number"
          min="0"
          placeholder="Valor mensual mínimo"
          aria-label="Valor mensual mínimo"
          value={precioMinimo}
          onChange={(event) => setPrecioMinimo(event.target.value)}
        />
        <input
          className={inputClass}
          type="number"
          min="0"
          placeholder="Valor mensual máximo"
          aria-label="Valor mensual máximo"
          value={precioMaximo}
          onChange={(event) => setPrecioMaximo(event.target.value)}
        />
      </Card>

      {error && (
        <div className="space-y-2">
          <Alert theme="light">{error}</Alert>
          <button type="button" className={btnSecondaryClass} onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      )}

      {precioMinimo !== '' && Number(precioMinimo) < 0 && (
        <p className="text-sm text-red-600">El valor mínimo no puede ser negativo.</p>
      )}
      {precioMaximo !== '' && Number(precioMaximo) < 0 && (
        <p className="text-sm text-red-600">El valor máximo no puede ser negativo.</p>
      )}
      {!preciosValidos && Number(precioMinimo) >= 0 && Number(precioMaximo) >= 0 && (
        <p className="text-sm text-red-600">Ingresá valores válidos para filtrar por precio.</p>
      )}
      {!rangoValido && <p className="text-sm text-red-600">El valor mínimo no puede superar al máximo.</p>}

      {cargando ? <LoadingRow label="Cargando propiedades disponibles..." /> : (
        <>
          <p className="text-sm text-slate-500">{rangoValido ? resultados.length : 0} propiedades disponibles</p>
          {resultados.length === 0 || !rangoValido ? (
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
                    {propiedad.descripcion && <p className="text-sm text-slate-500">{propiedad.descripcion}</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
