import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiGet, apiPatch } from '../../lib/apiClient';
import Alert from '../ui/Alert';
import PageHeader from '../ui/PageHeader';

interface PerfilUsuario {
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  cbu_alias?: string;
  cuit_cuil?: string;
}

type CamposPerfil = Pick<PerfilUsuario, 'telefono' | 'cbu_alias' | 'cuit_cuil'>;

const CAMPOS_VACIOS: CamposPerfil = {
  telefono: '',
  cbu_alias: '',
  cuit_cuil: '',
};

export default function PerfilPanel({ token }: { token: string }) {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [campos, setCampos] = useState<CamposPerfil>(CAMPOS_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    let activo = true;

    apiGet<PerfilUsuario>('/api/usuarios/me', token)
      .then((datos) => {
        if (!activo) return;
        setPerfil(datos);
        setCampos({
          telefono: datos.telefono || '',
          cbu_alias: datos.cbu_alias || '',
          cuit_cuil: datos.cuit_cuil || '',
        });
      })
      .catch((err: unknown) => {
        if (activo) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil.');
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [token]);

  const guardarPerfil = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      const actualizado = await apiPatch<PerfilUsuario>('/api/usuarios/me', token, campos);
      setPerfil(actualizado);
      setCampos({
        telefono: actualizado.telefono || '',
        cbu_alias: actualizado.cbu_alias || '',
        cuit_cuil: actualizado.cuit_cuil || '',
      });
      setMensaje('Tus datos de perfil se actualizaron correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el perfil.');
    } finally {
      setGuardando(false);
    }
  };

  const actualizarCampo = (campo: keyof CamposPerfil, valor: string) => {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }));
  };

  if (cargando) {
    return <p className="text-sm text-slate-500">Cargando perfil...</p>;
  }

  if (!perfil) {
    return (
      <div className="space-y-4">
        <PageHeader title="Mi perfil" subtitle="Consultá y actualizá tus datos personales." />
        <Alert type="error" theme="light">{error || 'No se pudo cargar el perfil.'}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mi perfil" subtitle="Consultá y actualizá tus datos personales." />
      {error && <Alert type="error" theme="light">{error}</Alert>}
      {mensaje && <Alert type="success" theme="light">{mensaje}</Alert>}

      <form
        onSubmit={guardarPerfil}
        className="max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Datos de cuenta</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="perfil-nombre" className="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
              <input id="perfil-nombre" value={perfil.nombre} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" />
            </div>
            <div>
              <label htmlFor="perfil-apellido" className="mb-1 block text-xs font-medium text-slate-600">Apellido</label>
              <input id="perfil-apellido" value={perfil.apellido} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="perfil-email" className="mb-1 block text-xs font-medium text-slate-600">Correo electrónico</label>
              <input id="perfil-email" type="email" value={perfil.email} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <h2 className="text-sm font-semibold text-slate-900">Datos editables</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="perfil-telefono" className="mb-1 block text-xs font-medium text-slate-600">Teléfono</label>
              <input id="perfil-telefono" type="tel" autoComplete="tel" value={campos.telefono} onChange={(event) => actualizarCampo('telefono', event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
            </div>
            <div>
              <label htmlFor="perfil-alias" className="mb-1 block text-xs font-medium text-slate-600">Alias o CBU</label>
              <input id="perfil-alias" value={campos.cbu_alias} onChange={(event) => actualizarCampo('cbu_alias', event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
            </div>
            <div>
              <label htmlFor="perfil-cuit" className="mb-1 block text-xs font-medium text-slate-600">CUIT/CUIL</label>
              <input id="perfil-cuit" inputMode="numeric" value={campos.cuit_cuil} onChange={(event) => actualizarCampo('cuit_cuil', event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
