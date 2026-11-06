import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ApiError, apiPost } from '../../lib/apiClient';
import Card from '../ui/Card';
import Alert from '../ui/Alert';

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

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite" aria-busy={cargando}>
          {mensajes.length === 0 && (
            <div className="mx-auto mt-12 max-w-md text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl" aria-hidden>
                ✨
              </div>
              <h2 className="font-semibold text-slate-800">¿En qué te puedo ayudar?</h2>
              <p className="mt-2 text-sm text-slate-500">
                Elegí una consulta o escribí la tuya. Las opciones usan tus datos reales según tu rol.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGERENCIAS.map((sugerencia) => (
                  <button
                    key={sugerencia.etiqueta}
                    type="button"
                    onClick={() => usarSugerencia(sugerencia)}
                    disabled={cargando}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <span>
                      {mensaje.cancelado
                        ? 'Cancelada'
                        : mensaje.reintentable === false ? 'Sin confirmar' : 'No enviado'}
                    </span>
                    {mensaje.reintentable === false ? (
                      <span>Revisá “Mis reclamos” antes de volver a intentar.</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => reintentar(indice)}
                        disabled={cargando}
                        className="font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reintentar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {cargando && (
            <div className="flex justify-start">
              <div
                className="flex items-center gap-3 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm text-slate-500"
                role="status"
              >
                <span>El asistente está pensando…</span>
                <button
                  type="button"
                  onClick={cancelar}
                  className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
                >
                  Cancelar
                </button>
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
