import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { apiPost } from '../../lib/apiClient';
import Card from '../ui/Card';
import Alert from '../ui/Alert';

interface MensajeChat {
  role: 'user' | 'assistant';
  content: string;
}

interface RespuestaChat {
  resultado: MensajeChat;
}

const MAX_CARACTERES = 200;
const MAX_MENSAJES_BACKEND = 20;
const PREGUNTAS_SUGERIDAS = [
  '¿Qué pagos tengo pendientes?',
  '¿Qué contratos están vigentes?',
  'Quiero realizar un reclamo',
];

export function RobotIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v2" />
      <circle cx="12" cy="2.5" r=".5" fill="currentColor" stroke="none" />
      <rect x="4" y="6" width="16" height="14" rx="4" />
      <path d="M2 11v4m20-4v4" />
      <circle cx="8.5" cy="11.5" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="11.5" r=".8" fill="currentColor" stroke="none" />
      <path d="M9 15.2c1.6 2 4.4 2 6 0" />
    </svg>
  );
}

export default function AsistentePanel({ token, compact = false }: { token: string; compact?: boolean }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const finalMensajes = useRef<HTMLDivElement>(null);
  const campoTexto = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    finalMensajes.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, cargando]);

  const enviarMensaje = async (mensaje: string) => {
    const contenido = mensaje.trim();
    if (!contenido || cargando) return;

    const historial = [
      ...mensajes.slice(-(MAX_MENSAJES_BACKEND - 2)),
      { role: 'user' as const, content: contenido },
    ];
    setMensajes((actuales) => [...actuales, { role: 'user', content: contenido }]);
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
      setMensajes((actuales) => [...actuales, respuesta.resultado]);
      setTexto((actual) => (actual === mensaje ? '' : actual));
    } catch (err) {
      setMensajes((actuales) => actuales.slice(0, -1));
      setTexto(mensaje);
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setCargando(false);
    }
  };

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void enviarMensaje(texto);
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
          <h1 className="text-2xl font-bold text-[var(--brand-navy)]">ALQUI</h1>
          <p className="mt-1 text-sm text-slate-500">
            Consultá tus reclamos o pedime ayuda para registrar uno nuevo.
          </p>
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {mensajes.length === 0 && (
            <div className="mx-auto mt-12 max-w-md text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700" aria-hidden>
                <RobotIcon />
              </div>
              <h2 className="font-semibold text-slate-800">¿En qué te puedo ayudar?</h2>
              <p className="mt-2 text-sm text-slate-500">
                Consultá tus contratos y pagos o pedí ayuda para gestionar un reclamo.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {PREGUNTAS_SUGERIDAS.map((pregunta) => (
                  <button
                    key={pregunta}
                    type="button"
                    disabled={cargando}
                    onClick={() => void enviarMensaje(pregunta)}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-left text-xs font-medium text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
                  >
                    {pregunta}
                  </button>
                ))}
              </div>
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
                }`}
              >
                {mensaje.content}
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

        <div className="space-y-2 border-t border-slate-200 p-3 sm:p-4">
          {error && <Alert type="error" theme="light">{error}</Alert>}
          <form onSubmit={enviar} className="flex items-end gap-2">
            <label className="sr-only" htmlFor="mensaje-asistente">Escribí tu consulta</label>
            <textarea
              ref={campoTexto}
              id="mensaje-asistente"
              className="h-24 min-h-24 max-h-24 flex-1 resize-none overflow-y-auto rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
              placeholder="Escribí tu consulta…"
              value={texto}
              maxLength={MAX_CARACTERES}
              rows={3}
              disabled={cargando}
              onChange={(event) => setTexto(event.target.value)}
              onKeyDown={manejarTecla}
            />
            <button
              type="submit"
              className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={cargando || !texto.trim() || texto.length > MAX_CARACTERES}
            >
              {cargando ? 'Enviando…' : 'Enviar'}
            </button>
          </form>
          <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
            <p>El asistente puede equivocarse. Confirmá los datos antes de enviar reclamos.</p>
            <span className="shrink-0 tabular-nums" aria-live="polite">
              {texto.length}/{MAX_CARACTERES}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
