import { useEffect, useState } from 'react';
import AsistentePanel, { RobotIcon } from './AsistentePanel';

export default function AsistenteFlotante({
  token,
  idAgrupamiento = '',
}: {
  token: string;
  idAgrupamiento?: string;
}) {
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
    <div className="pointer-events-none fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] right-[calc(2rem+env(safe-area-inset-right))] z-50 flex flex-col items-end gap-3">
      <section
        id="chat-asistente-flotante"
        role="dialog"
        aria-label="Chat con ALQUI"
        aria-hidden={!abierto}
        hidden={!abierto}
        className="assistant-floating-window pointer-events-auto flex h-[min(38rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl shadow-slate-900/20"
      >
        <header className="assistant-floating-window__header flex items-center justify-between gap-3 px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <span className="assistant-floating-window__avatar flex h-10 w-10 items-center justify-center rounded-xl">
              <RobotIcon />
            </span>
            <div>
              <h2 className="text-sm font-bold">ALQUI</h2>
              <p className="text-xs text-white/80">Asistente de AlquilAR</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar chat"
            className="assistant-floating-window__close flex h-8 w-8 items-center justify-center rounded-lg text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 p-2">
          <AsistentePanel token={token} idAgrupamiento={idAgrupamiento} compact />
        </div>
      </section>

      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        aria-label={abierto ? 'Cerrar chat con ALQUI' : 'Abrir chat con ALQUI'}
        aria-expanded={abierto}
        aria-controls="chat-asistente-flotante"
        className="assistant-floating-trigger pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:shadow-xl focus-visible:outline-none focus-visible:ring-4"
      >
        {abierto ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <RobotIcon />
        )}
      </button>
    </div>
  );
}
