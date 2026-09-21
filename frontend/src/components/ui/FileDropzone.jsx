import { useRef, useState } from 'react';
import {
  estaConfigurado,
  subirArchivo,
  miniatura,
  esUrlPdf,
  validarArchivo,
} from '../../lib/cloudinary';

export default function FileDropzone({
  value = '',
  onChange,
  disabled = false,
  tipo = 'garante',
  permitirPdf = true,
  label = 'Archivo',
  hint = 'JPG, PNG, WEBP o PDF · máx. 5 MB',
}) {
  const inputRef = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');

  const configOk = estaConfigurado(tipo);
  const deshabilitado = disabled || !configOk || subiendo || Boolean(value);

  const procesarArchivo = async (fileList) => {
    if (!configOk) {
      setErrorLocal('Cloudinary no está configurado. Revisá frontend/.env');
      return;
    }

    const file = fileList?.[0];
    if (!file) return;

    const errVal = validarArchivo(file, { permitirPdf });
    if (errVal) {
      setErrorLocal(`${file.name}: ${errVal}`);
      return;
    }

    setErrorLocal('');
    setSubiendo(true);
    try {
      const url = await subirArchivo(file, tipo, { permitirPdf });
      onChange(url);
    } catch (err) {
      setErrorLocal(`${file.name}: ${err.message}`);
    } finally {
      setSubiendo(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setArrastrando(false);
    if (deshabilitado) return;
    procesarArchivo(e.dataTransfer.files);
  };

  const accept = permitirPdf
    ? 'image/jpeg,image/png,image/webp,application/pdf'
    : 'image/jpeg,image/png,image/webp';

  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-600 block font-medium">{label}</label>

      {!configOk && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Cloudinary no está configurado para &quot;{tipo}&quot;. Revisá frontend/.env y reiniciá Vite.
        </p>
      )}

      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
          {esUrlPdf(value) ? (
            <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-[10px] font-bold text-red-600 shrink-0">
              PDF
            </div>
          ) : (
            <img
              src={miniatura(value, 96, 72)}
              alt="Vista previa"
              className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-700 truncate" title={value}>
              Archivo subido
            </p>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-emerald-600 hover:underline"
            >
              Ver archivo
            </a>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg shrink-0"
            >
              Quitar
            </button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={deshabilitado ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          onClick={() => !deshabilitado && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!deshabilitado) setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer ${
            deshabilitado
              ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              : arrastrando
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50/80 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            disabled={deshabilitado}
            onChange={(e) => {
              procesarArchivo(e.target.files);
              e.target.value = '';
            }}
          />
          {subiendo ? (
            <p className="text-sm font-medium text-emerald-700">Subiendo archivo...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">Arrastrá un archivo o hacé clic</p>
              <p className="text-xs mt-1">{hint}</p>
            </>
          )}
        </div>
      )}

      {errorLocal && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorLocal}</p>
      )}
    </div>
  );
}
