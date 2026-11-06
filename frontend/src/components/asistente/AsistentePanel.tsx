import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ApiError, apiPost } from '../../lib/apiClient';
import Card from '../ui/Card';

const MAX_MENSAJES = 10;
const MAX_CARACTERES = 4000;
const TIEMPO_LIMITE_CHAT_MS = 75_000;

type IntencionIA = 'RESUMEN_EDIFICIO' | 'MIS_SALDOS';

interface Sugerencia {
  etiqueta: string;
  texto: string;
  intencion?: IntencionIA;
}

const SUGERENCIAS: Sugerencia[] = [
  {
    etiqueta: 'Resumen del edificio',
    texto: 'Resumen del edificio',
    intencion: 'RESUMEN_EDIFICIO',
  },
  {
    etiqueta: '¿Cuánto debo y cuándo vence?',
    texto: '¿Cuánto debo y cuándo vence?',
    intencion: 'MIS_SALDOS',
  },
  {
    etiqueta: 'Mostrame mis reclamos',
    texto: 'Mostrame mis reclamos',
  },
  {
    etiqueta: 'Quiero reportar una pérdida de agua',
    texto: 'Quiero reportar una pérdida de agua',
  },
];

interface MensajeChat {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  cancelado?: boolean;
  reintentable?: boolean;
  intencion?: IntencionIA;
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

const parecePedidoDeReclamo = (texto: string) => (
  /reclamo|reportar|denunciar|p[eé]rdida|fuga|rotura|roto|no funciona|no anda/i.test(texto)
);

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.tipo === 'cancelado') return 'La consulta fue cancelada.';
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo enviar el mensaje. Volvé a intentar.';
}

/**
 * Un fallo de red, timeout, cancelación o 5xx no permite saber si el backend
 * llegó a ejecutar una acción. En esos casos no afirmamos que no se creó.
 */
function esErrorIncierto(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  if (['red', 'timeout', 'cancelado', 'respuesta'].includes(error.tipo)) return true;
  return error.status === null || error.status >= 500;
}

export default function AsistentePanel({
  token,
  compact = false,
  idAgrupamiento = '',
}: {
  token: string;
  compact?: boolean;
  idAgrupamiento?: string;
}) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const finalMensajes = useRef<HTMLDivElement>(null);
  const areaTexto = useRef<HTMLTextAreaElement>(null);
  const enviando = useRef(false);
  const peticion = useRef<AbortController | null>(null);

  useEffect(() => {
    finalMensajes.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, cargando]);

  useEffect(() => () => {
    peticion.current?.abort();
  }, []);

  const enviarConsulta = async (
    contenidoCrudo: string,
    intencion?: IntencionIA,
    base: MensajeChat[] = mensajes,
  ) => {
    const contenido = contenidoCrudo.trim();
    if (!contenido || enviando.current) return;

    if (contenido.length > MAX_CARACTERES) {
      setError(`El mensaje no puede superar los ${MAX_CARACTERES} caracteres.`);
      return;
    }

    const mensajeUsuario: MensajeChat = {
      role: 'user',
      content: contenido,
      ...(intencion ? { intencion } : {}),
    };
    const mensajesConUsuario = [...base, mensajeUsuario];
    const historial = recortarHistorial(mensajesConUsuario.filter((mensaje) => !mensaje.error))
      .map(({ role, content }) => ({ role, content: content.slice(0, MAX_CARACTERES) }));

    const controller = new AbortController();
    peticion.current = controller;
    enviando.current = true;
    setMensajes(mensajesConUsuario);
    setTexto('');
    setError('');
    setCargando(true);

    try {
      const respuesta = await apiPost<RespuestaChat>('/api/ai/chat', token, {
        mensajes: historial,
        ...(intencion ? { intencion } : {}),
        ...(idAgrupamiento ? { contexto: { id_agrupamiento: idAgrupamiento } } : {}),
      }, {
        timeoutMs: TIEMPO_LIMITE_CHAT_MS,
        reintentos: 0,
        desloguearEn403: false,
        signal: controller.signal,
      });

      if (
        respuesta.resultado?.role !== 'assistant'
        || typeof respuesta.resultado.content !== 'string'
        || !respuesta.resultado.content.trim()
      ) {
        throw new Error('El asistente devolvió una respuesta inesperada.');
      }
      setMensajes([...mensajesConUsuario, respuesta.resultado]);
    } catch (err) {
      const cancelado = controller.signal.aborted;
      const pedidoDeReclamo = !intencion && parecePedidoDeReclamo(contenido);
      const incierto = esErrorIncierto(err);
      const puedeReintentar = !(pedidoDeReclamo && incierto);

      setMensajes((actuales) => actuales.map((mensaje, indice) => (
        indice === actuales.length - 1
          ? { ...mensaje, error: true, cancelado, reintentable: puedeReintentar }
          : mensaje
      )));

      const detalle = cancelado ? 'La consulta fue cancelada.' : mensajeDeError(err);
      const nota = pedidoDeReclamo
        ? incierto
          ? ' No pudimos confirmar si el reclamo quedó registrado: revisá “Mis reclamos” antes de volver a intentar.'
          : ' El reclamo no se creó.'
        : '';
      setError(`${detalle}${nota}`);
    } finally {
      if (peticion.current === controller) peticion.current = null;
      enviando.current = false;
      setCargando(false);
    }
  };

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void enviarConsulta(texto);
  };

  const reintentar = (indice: number) => {
    const mensaje = mensajes[indice];
    if (!mensaje || mensaje.role !== 'user' || cargando) return;
    const base = mensajes.filter((_, posicion) => posicion !== indice);
    setMensajes(base);
    setError('');
    void enviarConsulta(mensaje.content, mensaje.intencion, base);
  };

  const usarSugerencia = (sugerencia: Sugerencia) => {
    if (cargando) return;
    void enviarConsulta(sugerencia.texto, sugerencia.intencion);
  };

  const cancelar = () => {
    peticion.current?.abort();
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
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite" aria-busy={cargando}>
          {mensajes.length === 0 && (
            <div className="mx-auto mt-12 max-w-md text-center">
              <div className="assistant-chat__welcome-icon mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" aria-hidden>
                <RobotIcon />
              </div>
              <h2 className="assistant-chat__title font-semibold">¿En qué te puedo ayudar?</h2>
              <p className="assistant-chat__secondary mt-2 text-sm">
                Elegí una consulta o escribí la tuya. Las opciones usan tus datos reales según tu rol.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGERENCIAS.map((sugerencia) => (
                  <button
                    key={sugerencia.etiqueta}
                    type="button"
                    onClick={() => usarSugerencia(sugerencia)}
                    disabled={cargando}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {sugerencia.etiqueta}
                  </button>
                ))}
              </div>
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
                <p role="alert" className="chat-error mt-1 flex max-w-[85%] items-center gap-1 text-xs font-medium">
                  <span>
                    {mensaje.cancelado
                      ? 'Cancelada.'
                      : mensaje.reintentable === false
                        ? 'Sin confirmar. Revisá “Mis reclamos” antes de volver a intentar.'
                        : 'No enviado.'}
                  </span>
                  {mensaje.reintentable !== false && (
                    <button
                      type="button"
                      onClick={() => reintentar(indice)}
                      disabled={cargando}
                      className="font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reintentar
                    </button>
                  )}
                </p>
              )}
            </div>
          ))}

          {cargando && (
            <div className="flex justify-start">
              <div
                className="assistant-chat__typing flex items-center gap-3 rounded-2xl rounded-bl-md px-4 py-3 text-sm"
                role="status"
              >
                <span>ALQUI está pensando…</span>
                <button
                  type="button"
                  onClick={cancelar}
                  className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-600 dark:text-slate-200"
                >
                  Cancelar
                </button>
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
