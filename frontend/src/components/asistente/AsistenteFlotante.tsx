import { useEffect, useState } from 'react';
import AsistentePanel from './AsistentePanel';

export default function AsistenteFlotante({ token }: { token: string }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return undefined;

    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => document.removeEventListener('keydown', cerrarConEscape);
  }, [abierto]);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <section
        id="chat-asistente-flotante"
        role="dialog"
        aria-label="Chat con el asistente IA"
        aria-hidden={!abierto}
        hidden={!abierto}
        className="pointer-events-auto flex h-[min(38rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-2xl shadow-slate-900/20"
      >
        <header className="flex items-center justify-between gap-3 bg-teal-600 px-4 py-3 text-white">
          <div>
            <h2 className="text-sm font-bold">Asistente AlquilAR</h2>
            <p className="text-xs text-teal-50">Consultas sobre alquileres y reclamos</p>
          </div>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar chat"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 p-2">
          <AsistentePanel token={token} compact />
        </div>
      </section>

      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        aria-label={abierto ? 'Cerrar asistente IA' : 'Abrir chat con el asistente IA'}
        aria-expanded={abierto}
        aria-controls="chat-asistente-flotante"
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg shadow-teal-900/25 transition hover:bg-teal-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
      >
        {abierto ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-3.5 2v-5A7.5 7.5 0 1 1 20 11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M8 11h8M8 14.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
