import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { apiPost } from '../../lib/apiClient';
import Card from '../ui/Card';

const MAX_MENSAJES = 20;
const MAX_CARACTERES = 4000;

interface MensajeChat {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

interface RespuestaChat {
  resultado: MensajeChat;
}

export function RobotIcon() {
  return (
    <svg
      className="block"
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M16 4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="3" r="2" fill="currentColor" />
      <rect x="5" y="9" width="22" height="18" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M10 15h.01M22 15h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M11 20c1.2 1.5 2.8 2.25 5 2.25s3.8-.75 5-2.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 15v6m28-6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function recortarHistorial(mensajes: MensajeChat[]): MensajeChat[] {
  const recortado = mensajes.slice(-MAX_MENSAJES);
  while (recortado.length > 0 && recortado[0].role !== 'user') {
    recortado.shift();
  }
  return recortado;
}

export default function AsistentePanel({ token, compact = false }: { token: string; compact?: boolean }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const finalMensajes = useRef<HTMLDivElement>(null);
  const areaTexto = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    finalMensajes.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, cargando]);

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const contenido = texto.trim();
    if (!contenido || cargando) return;
    if (contenido.length > MAX_CARACTERES) {
      setError(`El mensaje no puede superar los ${MAX_CARACTERES} caracteres.`);
      return;
    }

    const mensajeUsuario: MensajeChat = { role: 'user', content: contenido };
    const mensajesConUsuario = [...mensajes, mensajeUsuario];
    const historial = recortarHistorial(mensajesConUsuario.filter((mensaje) => !mensaje.error))
      .map(({ role, content }) => ({ role, content: content.slice(0, MAX_CARACTERES) }));

    setMensajes(mensajesConUsuario);
    setTexto('');
    setError('');
    setCargando(true);
    try {
      const respuesta = await apiPost<RespuestaChat>('/api/ai/chat', token, { mensajes: historial });
      if (
        respuesta.resultado?.role !== 'assistant'
        || typeof respuesta.resultado.content !== 'string'
        || !respuesta.resultado.content.trim()
      ) {
        throw new Error('El asistente devolvió una respuesta inesperada.');
      }
      setMensajes([...mensajesConUsuario, respuesta.resultado]);
    } catch (err) {
      setMensajes((actuales) => actuales.map((mensaje, indice) => (
        indice === actuales.length - 1 ? { ...mensaje, error: true } : mensaje
      )));
      const detalle = err instanceof Error ? err.message : 'No se pudo enviar el mensaje.';
      setError(`${detalle} No se confirmó ninguna acción: si pediste crear un reclamo, no se creó.`);
    } finally {
      setCargando(false);
    }
  };

  const reintentar = (indice: number) => {
    const mensaje = mensajes[indice];
    if (!mensaje || mensaje.role !== 'user') return;
    setMensajes((actuales) => actuales.filter((_, posicion) => posicion !== indice));
    setTexto(mensaje.content);
    setError('');
    window.requestAnimationFrame(() => areaTexto.current?.focus());
  };

  const manejarTecla = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className={compact
      ? 'flex h-full min-h-0 flex-col'
      : 'mx-auto flex h-[calc(100vh-8rem)] min-h-[480px] max-w-4xl flex-col gap-4'}
    >
      {!compact && (
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-navy)]">Asistente IA</h1>
          <p className="mt-1 text-sm text-slate-500">
            Consultá tus reclamos o pedime ayuda para registrar uno nuevo.
          </p>
        </div>
      )}

      <Card className="assistant-chat-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {mensajes.length === 0 && (
            <div className="mx-auto mt-12 max-w-md text-center">
              <div className="assistant-chat__welcome-icon mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" aria-hidden>
                <RobotIcon />
              </div>
              <h2 className="assistant-chat__title font-semibold">¿En qué te puedo ayudar?</h2>
              <p className="assistant-chat__secondary mt-2 text-sm">
                Por ejemplo: “Mostrame mis reclamos” o “Quiero reportar una pérdida de agua”.
              </p>
            </div>
          )}

          {mensajes.map((mensaje, indice) => (
            <div
              key={`${indice}-${mensaje.role}`}
              className={`flex flex-col ${mensaje.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`assistant-chat__bubble max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  mensaje.role === 'user'
                    ? 'assistant-chat__bubble--user rounded-br-md'
                    : 'assistant-chat__bubble--assistant rounded-bl-md'
                }`}
              >
                {mensaje.content}
              </div>
              {mensaje.error && (
                <p role="alert" className="chat-error mt-1 flex items-center gap-1 text-xs font-medium">
                  <span>No enviado.</span>
                  <button
                    type="button"
                    onClick={() => reintentar(indice)}
                    className="font-semibold underline underline-offset-2"
                  >
                    Reintentar
                  </button>
                </p>
              )}
            </div>
          ))}

          {cargando && (
            <div className="flex justify-start">
              <div className="assistant-chat__typing rounded-2xl rounded-bl-md px-4 py-3 text-sm" role="status">
                ALQUI está pensando…
              </div>
            </div>
          )}
          <div ref={finalMensajes} />
        </div>

        <div className="assistant-chat__composer space-y-3 border-t p-3 sm:p-4">
          {error && <p role="alert" className="chat-error text-xs font-medium">{error}</p>}
          <form onSubmit={enviar} className="flex items-end gap-2">
            <label className="sr-only" htmlFor="mensaje-asistente">Escribí tu consulta</label>
            <textarea
              id="mensaje-asistente"
              ref={areaTexto}
              className="assistant-chat__input h-12 min-h-12 max-h-12 flex-1 resize-none overflow-y-auto rounded-xl border px-4 py-3 text-sm outline-none transition disabled:opacity-60"
              placeholder="Escribí tu consulta…"
              value={texto}
              maxLength={MAX_CARACTERES}
              rows={1}
              disabled={cargando}
              onChange={(event) => setTexto(event.target.value)}
              onKeyDown={manejarTecla}
            />
            <button
              type="submit"
              className="assistant-chat__send flex h-12 shrink-0 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              disabled={cargando || !texto.trim()}
            >
              {cargando ? 'Enviando…' : 'Enviar'}
            </button>
          </form>
          <p className="assistant-chat__footnote text-center text-xs">
            El asistente puede equivocarse. Confirmá los datos antes de enviar un reclamo.
            {' '}El historial enviado se limita a los últimos {MAX_MENSAJES} mensajes.
          </p>
        </div>
      </Card>
    </div>
  );
}
