import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../../lib/apiClient';
import { AGRUPAMIENTOS_ACTUALIZAR_EVENTO } from '../../lib/agrupamientos';
import type { Agrupamiento } from '../../types';

interface AgrupamientoSelectorProps {
  token: string;
  value: string;
  onChange: (id: string) => void;
}

export default function AgrupamientoSelector({
  token,
  value,
  onChange,
}: AgrupamientoSelectorProps) {
  const [agrupamientos, setAgrupamientos] = useState<Agrupamiento[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const data = await apiGet<Agrupamiento[]>('/api/agrupamientos', token);
      setAgrupamientos(Array.isArray(data) ? data : []);
    } catch {
      setAgrupamientos([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    const actualizar = () => void cargar();
    window.addEventListener(AGRUPAMIENTOS_ACTUALIZAR_EVENTO, actualizar);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(AGRUPAMIENTOS_ACTUALIZAR_EVENTO, actualizar);
    };
  }, [cargar]);

  const activos = agrupamientos.filter((agrupamiento) => agrupamiento.estado === 'ACTIVO');
  const seleccionadoInactivo = value
    ? agrupamientos.find(
      (agrupamiento) => agrupamiento._id === value && agrupamiento.estado !== 'ACTIVO',
    )
    : undefined;

  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-xs font-medium text-slate-500 lg:inline">Agrupamiento</span>
      <select
        aria-label="Filtrar por agrupamiento"
        className="max-w-[13rem] rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={cargando}
      >
        <option value="">Todos los agrupamientos</option>
        {seleccionadoInactivo && (
          <option value={seleccionadoInactivo._id}>
            {seleccionadoInactivo.nombre} (inactivo)
          </option>
        )}
        {activos.map((agrupamiento) => (
          <option key={agrupamiento._id} value={agrupamiento._id}>
            {agrupamiento.nombre}
          </option>
        ))}
        {cargando && <option value="">Cargando...</option>}
      </select>
    </label>
  );
}
