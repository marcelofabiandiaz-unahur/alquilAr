import { useEffect, useState } from 'react';
import { apiGetBlob } from '../../lib/apiClient';
import Modal from '../ui/Modal';

interface ComprobantePagoLinkProps {
  token: string;
  pagoId: string;
  indice: number;
  label: string;
}

export default function ComprobantePagoLink({
  token,
  pagoId,
  indice,
  label,
}: ComprobantePagoLinkProps) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [urlTemporal, setUrlTemporal] = useState('');
  const [tipoContenido, setTipoContenido] = useState('');

  const abrir = async () => {
    setCargando(true);
    setError('');
    try {
      const blob = await apiGetBlob(`/api/pagos/${pagoId}/comprobantes/${indice}`, token);
      setTipoContenido(blob.type);
      setUrlTemporal(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el comprobante.');
    } finally {
      setCargando(false);
    }
  };

  const cerrar = () => {
    if (urlTemporal) URL.revokeObjectURL(urlTemporal);
    setUrlTemporal('');
    setTipoContenido('');
  };

  useEffect(() => () => {
    if (urlTemporal) URL.revokeObjectURL(urlTemporal);
  }, [urlTemporal]);

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" onClick={() => void abrir()} disabled={cargando} className="text-emerald-700 underline disabled:opacity-50">
        {cargando ? 'Abriendo...' : label}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
      <Modal open={Boolean(urlTemporal)} title="Comprobante de pago" onClose={cerrar} wide>
        {urlTemporal && tipoContenido === 'application/pdf' && (
          <iframe title="Comprobante de pago" src={urlTemporal} className="h-[70vh] w-full rounded-lg border border-slate-200" />
        )}
        {urlTemporal && tipoContenido.startsWith('image/') && (
          <img src={urlTemporal} alt="Comprobante de pago" className="mx-auto max-h-[70vh] max-w-full object-contain" />
        )}
        {urlTemporal && !tipoContenido.startsWith('image/') && tipoContenido !== 'application/pdf' && (
          <p className="text-sm text-red-600">El formato del comprobante no se puede mostrar en esta ventana.</p>
        )}
      </Modal>
    </span>
  );
}
