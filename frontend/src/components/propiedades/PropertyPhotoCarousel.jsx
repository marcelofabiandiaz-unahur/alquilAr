import { useState } from 'react';
import { miniatura } from '../../lib/cloudinary';

export default function PropertyPhotoCarousel({ fotos = [], alt }) {
  const urls = fotos.filter(Boolean).slice(0, 5);
  const [indice, setIndice] = useState(0);

  if (urls.length === 0) {
    return (
      <div className="w-full h-40 bg-slate-100 border-b border-slate-100 flex items-center justify-center text-slate-400 text-xs">
        Sin fotos
      </div>
    );
  }

  const indiceSeguro = indice >= urls.length ? 0 : indice;
  const actual = urls[indiceSeguro];
  const multiples = urls.length > 1;

  const irAnterior = (e) => {
    e.stopPropagation();
    setIndice((i) => (i - 1 + urls.length) % urls.length);
  };

  const irSiguiente = (e) => {
    e.stopPropagation();
    setIndice((i) => (i + 1) % urls.length);
  };

  const irA = (e, i) => {
    e.stopPropagation();
    setIndice(i);
  };

  return (
    <div className="relative w-full h-40 bg-slate-100 border-b border-slate-100">
      <img
        src={miniatura(actual)}
        alt={`${alt} — foto ${indiceSeguro + 1}`}
        className="w-full h-full object-cover"
      />

      {multiples && (
        <>
          <button
            type="button"
            onClick={irAnterior}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-slate-700 text-sm shadow hover:bg-white"
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={irSiguiente}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-slate-700 text-sm shadow hover:bg-white"
            aria-label="Foto siguiente"
          >
            ›
          </button>

          <span className="absolute top-2 right-2 text-[10px] font-semibold bg-slate-900/60 text-white px-2 py-0.5 rounded-full">
            {indiceSeguro + 1} / {urls.length}
          </span>

          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {urls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={(e) => irA(e, i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === indiceSeguro ? 'bg-white' : 'bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`Ir a foto ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
