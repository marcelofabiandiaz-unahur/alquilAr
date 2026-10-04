import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiGet, apiPost } from '../../lib/apiClient';
import Modal from '../ui/Modal';
import { btnPrimaryClass, inputClass, labelClass } from './dashboardStyles';

interface SolicitudPropietario {
  cbu_alias: string;
  cuit_cuil: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  solicitada_en?: string;
}

export default function SolicitudPropietario({ token }: { token: string }) {
  const [abierta, setAbierta] = useState(false);
  const [solicitud, setSolicitud] = useState<SolicitudPropietario | null>(null);
  const [alias, setAlias] = useState('');
  const [cuit, setCuit] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    let activa = true;
    apiGet<{ solicitud: SolicitudPropietario | null }>('/api/usuarios/solicitud-propietario', token)
      .then((respuesta) => {
        if (activa) setSolicitud(respuesta.solicitud);
      })
      .catch((err: unknown) => {
        if (activa) setError(err instanceof Error ? err.message : 'No se pudo consultar la solicitud.');
      })
      .finally(() => {
        if (activa) setCargando(false);
      });
    return () => {
      activa = false;
    };
  }, [token]);

  const enviarSolicitud = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setInfo('');
    try {
      const respuesta = await apiPost<{ solicitud: SolicitudPropietario }>(
        '/api/usuarios/solicitud-propietario',
        token,
        { cbu_alias: alias, cuit_cuil: cuit },
      );
      setSolicitud(respuesta.solicitud);
      setInfo('Solicitud enviada. Un administrador debe aprobarla para habilitar la publicación de propiedades.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    } finally {
      setGuardando(false);
    }
  };

  if (solicitud?.estado === 'APROBADA') return null;

  const textoEstado = solicitud?.estado === 'PENDIENTE'
    ? 'Solicitud pendiente'
    : 'Publicar mi propiedad';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('');
          setInfo('');
          setAbierta(true);
        }}
        className="mx-3 mt-2 inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
      >
        {textoEstado}
      </button>
      <Modal open={abierta} title="Publicar mi propiedad" onClose={() => setAbierta(false)}>
        {cargando ? (
          <p className="text-sm text-slate-500">Consultando solicitud...</p>
        ) : solicitud?.estado === 'PENDIENTE' ? (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Tu solicitud está pendiente de aprobación por un administrador.</p>
            <p><span className="font-semibold">Alias / CBU:</span> {solicitud.cbu_alias}</p>
            <p><span className="font-semibold">CUIT / CUIL:</span> {solicitud.cuit_cuil}</p>
          </div>
        ) : (
          <form onSubmit={enviarSolicitud} className="space-y-4">
            <p className="text-sm text-slate-600">
              Completá los datos de cobro. La publicación de propiedades se habilitará cuando un administrador apruebe la solicitud.
            </p>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {info && <p role="status" className="text-sm text-emerald-700">{info}</p>}
            <div>
              <label htmlFor="solicitud-alias" className={labelClass}>Alias o CBU</label>
              <input
                id="solicitud-alias"
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
                maxLength={50}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="solicitud-cuit" className={labelClass}>CUIT / CUIL (11 dígitos)</label>
              <input
                id="solicitud-cuit"
                value={cuit}
                onChange={(event) => setCuit(event.target.value)}
                inputMode="numeric"
                maxLength={13}
                required
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={guardando} className={btnPrimaryClass}>
              {guardando ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
