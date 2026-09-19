import { useRef, useState } from 'react';
import {
  estaConfigurado,
  subirImagen,
  miniatura,
  FOTOS_MAX,
  validarArchivo,
} from '../../lib/cloudinary';

export default function PhotoDropzone({ fotos = [], onChange, disabled = false, tipo = 'propiedades' }) {
  const inputRef = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(0);
  const [errorLocal, setErrorLocal] = useState('');

  const configOk = estaConfigurado(tipo);
  const deshabilitado = disabled || !configOk || subiendo > 0;
  const cupoRestante = FOTOS_MAX - fotos.length;

  const procesarArchivos = async (fileList) => {
    if (!configOk) {
      setErrorLocal('Cloudinary no está configurado. Revisá frontend/.env');
      return;
    }

    const archivos = Array.from(fileList || []);
    if (archivos.length === 0) return;

    if (cupoRestante <= 0) {
      setErrorLocal(`Máximo ${FOTOS_MAX} fotos por propiedad.`);
      return;
    }

    const aSubir = archivos.slice(0, cupoRestante);
    if (archivos.length > cupoRestante) {
      setErrorLocal(`Solo se agregaron ${cupoRestante} foto(s). Máximo ${FOTOS_MAX} por propiedad.`);
    } else {
      setErrorLocal('');
    }

    setSubiendo(aSubir.length);
    const nuevasUrls = [];
    const errores = [];

    await Promise.all(
      aSubir.map(async (file) => {
        const errVal = validarArchivo(file);
        if (errVal) {
          errores.push(`${file.name}: ${errVal}`);
          return;
        }
        try {
          const url = await subirImagen(file, tipo);
          nuevasUrls.push(url);
        } catch (err) {
          errores.push(`${file.name}: ${err.message}`);
        }
      }),
    );

    setSubiendo(0);

    if (nuevasUrls.length > 0) {
      onChange((prev) => [...prev, ...nuevasUrls]);
    }

    if (errores.length > 0) {
      setErrorLocal(errores.join(' · '));
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setArrastrando(false);
    if (deshabilitado) return;
    procesarArchivos(e.dataTransfer.files);
  };

  const quitarFoto = (index) => {
    onChange((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="text-xs text-slate-600 block font-medium">
        Fotos ({fotos.length}/{FOTOS_MAX})
      </label>

      {!configOk && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Cloudinary no está configurado para propiedades. Revisá VITE_CLOUDINARY_CLOUD_NAME y
          VITE_CLOUDINARY_UPLOAD_PRESET_PROPIEDADES en frontend/.env y reiniciá Vite.
        </p>
      )}

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
        className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors cursor-pointer ${
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
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={deshabilitado}
          onChange={(e) => {
            procesarArchivos(e.target.files);
            e.target.value = '';
          }}
        />
        {subiendo > 0 ? (
          <p className="text-sm font-medium text-emerald-700">Subiendo {subiendo} imagen(es)...</p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">Arrastrá fotos acá o hacé clic</p>
            <p className="text-xs mt-1">JPG, PNG, WEBP · máx. 5 MB · hasta {FOTOS_MAX} fotos</p>
          </>
        )}
      </div>

      {errorLocal && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorLocal}</p>
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {fotos.map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-200">
              <img
                src={miniatura(url, 200, 150)}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    quitarFoto(index);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white text-xs hover:bg-red-600 transition-colors"
                  aria-label="Quitar foto"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
