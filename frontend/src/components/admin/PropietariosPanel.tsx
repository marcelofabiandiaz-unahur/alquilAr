import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/apiClient';
import PageHeader from '../ui/PageHeader';
import Card from '../ui/Card';
import Alert from '../ui/Alert';
import LoadingRow from '../ui/LoadingRow';
import EmptyState from '../ui/EmptyState';
import { btnSecondaryClass } from '../layout/dashboardStyles';
import type { Propiedad, Usuario } from '../../types';

interface PropietariosPanelProps {
  token: string;
  onIrAUsuarios?: () => void;
}

function idPropietarioDePropiedad(prop: Propiedad): string | null {
  if (!prop.id_propietario) return null;
  if (typeof prop.id_propietario === 'string') return prop.id_propietario;
  return prop.id_propietario._id ?? null;
}

export default function PropietariosPanel({ token, onIrAUsuarios }: PropietariosPanelProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [usuariosData, propsData] = await Promise.all([
        apiGet<Usuario[]>('/api/usuarios', token),
        apiGet<Propiedad[]>('/api/propiedades', token),
      ]);
      if (!Array.isArray(usuariosData) || !Array.isArray(propsData)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setUsuarios(usuariosData);
      setPropiedades(propsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los propietarios.');
      setUsuarios([]);
      setPropiedades([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const conteoPorPropietario = useMemo(() => {
    const map = new Map<string, number>();
    propiedades.forEach((prop) => {
      const id = idPropietarioDePropiedad(prop);
      if (!id) return;
      map.set(id, (map.get(id) ?? 0) + 1);
    });
    return map;
  }, [propiedades]);

  const propietarios = useMemo(
    () => usuarios.filter((u) => u.roles.includes('PROPIETARIO')),
    [usuarios],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Propietarios"
        subtitle="Cartera de propietarios y unidades asociadas"
        action={
          onIrAUsuarios ? (
            <button type="button" className={btnSecondaryClass} onClick={onIrAUsuarios}>
              Gestionar en Usuarios
            </button>
          ) : null
        }
      />

      {error && <Alert theme="light" onClose={() => setError('')}>{error}</Alert>}

      {cargando ? (
        <LoadingRow label="Cargando propietarios..." />
      ) : propietarios.length === 0 ? (
        <EmptyState
          title="Sin propietarios"
          description="Asigná el rol PROPIETARIO desde la sección Usuarios."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {propietarios.map((usr) => {
            const unidades = conteoPorPropietario.get(usr._id) ?? 0;
            return (
              <Card key={usr._id} className="p-5 hover:border-violet-200 hover:shadow-md transition-all">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {usr.nombre[0]}{usr.apellido[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[#14213D] truncate">
                      {usr.nombre} {usr.apellido}
                    </h3>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{usr.email}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Unidades</span>
                  <span className="text-xl font-bold text-violet-600">{unidades}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
