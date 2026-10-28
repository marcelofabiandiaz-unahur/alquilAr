import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { apiPost } from '../../lib/apiClient';
import Card from '../ui/Card';
import Alert from '../ui/Alert';

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

function recortarHistorial(mensajes: MensajeChat[]): MensajeChat[] {
  const recortado = mensajes.slice(-MAX_MENSAJES);
  while (recortado.length > 0 && recortado[0].role !== 'user') {
    recortado.shift();
  }
  return recortado;
}

export default function AsistentePanel({ token }: { token: string }) {
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

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {mensajes.length === 0 && (
            <div className="mx-auto mt-12 max-w-md text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl" aria-hidden>
                ✨
              </div>
              <h2 className="font-semibold text-slate-800">¿En qué te puedo ayudar?</h2>
              <p className="mt-2 text-sm text-slate-500">
                Por ejemplo: “Mostrame mis reclamos” o “Quiero reportar una pérdida de agua”.
              </p>
            </div>
          )}

          {mensajes.map((mensaje, indice) => (
            <div
              key={`${indice}-${mensaje.role}`}
              className={`flex ${mensaje.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  mensaje.role === 'user'
                    ? 'rounded-br-md bg-[var(--brand-navy)] text-white'
                    : 'rounded-bl-md bg-slate-100 text-slate-800'
                } ${mensaje.error ? 'ring-2 ring-red-400' : ''}`}
              >
                {mensaje.content}
                {mensaje.error && (
                  <div className="mt-2 flex items-center gap-2 border-t border-white/20 pt-2 text-xs text-red-200">
                    <span>No enviado</span>
                    <button
                      type="button"
                      onClick={() => reintentar(indice)}
                      className="font-semibold underline underline-offset-2"
                    >
                      Reintentar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {cargando && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm text-slate-500" role="status">
                El asistente está pensando…
              </div>
            </div>
          )}
          <div ref={finalMensajes} />
        </div>

        <div className="space-y-3 border-t border-slate-200 p-3 sm:p-4">
          {error && <Alert type="error" theme="light">{error}</Alert>}
          <form onSubmit={enviar} className="flex items-end gap-2">
            <label className="sr-only" htmlFor="mensaje-asistente">Escribí tu consulta</label>
            <textarea
              id="mensaje-asistente"
              ref={areaTexto}
              className="max-h-36 min-h-12 flex-1 resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
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
              className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={cargando || !texto.trim()}
            >
              {cargando ? 'Enviando…' : 'Enviar'}
            </button>
          </form>
          <p className="text-center text-xs text-slate-400">
            El asistente puede equivocarse. Confirmá los datos antes de enviar un reclamo.
            {' '}El historial enviado se limita a los últimos {MAX_MENSAJES} mensajes.
          </p>
        </div>
      </Card>
    </div>
  );
}
