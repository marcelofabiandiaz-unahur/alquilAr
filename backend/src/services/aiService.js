const { GoogleGenAI } = require('@google/genai');
const { toolsEsquemas, ejecutarToolParaModelo } = require('./aiToolsRegistry');
const {
  AiError,
  CODIGOS_IA,
  esAiError,
  normalizarErrorProveedor,
} = require('../utils/aiErrors');

const MODELO_POR_DEFECTO = 'gemini-3.8-flash';
const MAX_PASOS_TOOL = 3;
const MAX_REINTENTOS_PROVEEDOR = 1;
const TIMEOUT_POR_LLAMADA_MS = 20_000;
const TIMEOUT_TOTAL_MS = 50_000;
const ESPERA_REINTENTO_MS = 400;

let clienteGemini;
let modeloResuelto = null;
let descubrimientoIntentado = false;

const registrar = (nivel, evento, datos = {}) => {
  const salida = { evento, ...datos };
  if (nivel === 'error') console.error('[IA]', salida);
  else if (nivel === 'warn') console.warn('[IA]', salida);
  else console.log('[IA]', salida);
};

const obtenerClienteGemini = () => {
  if (clienteGemini) return clienteGemini;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new AiError(
      CODIGOS_IA.CONFIGURACION,
      'Falta configurar GEMINI_API_KEY en el entorno del backend.',
      { status: 503, detalleTecnico: 'GEMINI_API_KEY ausente o vacía' },
    );
  }
  clienteGemini = new GoogleGenAI({ apiKey: apiKey.trim() });
  return clienteGemini;
};

const resolverModelo = (opciones = {}) => (
  modeloResuelto
  || (typeof opciones.modelo === 'string' && opciones.modelo.trim())
  || (process.env.GEMINI_MODEL || '').trim()
  || MODELO_POR_DEFECTO
);

const leerTexto = (response) => {
  try {
    const texto = response?.text;
    return typeof texto === 'string' && texto.trim() ? texto.trim() : '';
  } catch {
    return '';
  }
};

const RESPUESTA_NO_DISPONIBLE = 'No pude preparar una respuesta clara en este momento. '
  + 'Probá reformular la consulta o volvé a intentar en unos segundos.';

const pareceJson = (texto) => {
  const limpio = texto.trim();
  if (!/^[[{]/.test(limpio)) return false;
  try {
    JSON.parse(limpio);
    return true;
  } catch {
    return false;
  }
};

/**
 * Última barrera para que nunca llegue al usuario una salida técnica del modelo
 * (JSON, bloques de código o una respuesta vacía). El formato natural se pide
 * en el prompt; esto evita filtrar estructuras si el modelo igual las devuelve.
 */
const normalizarTextoVisible = (texto) => {
  const original = typeof texto === 'string' ? texto.trim() : '';
  if (!original) return '';

  const sinBloques = original
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!sinBloques || pareceJson(sinBloques)) return RESPUESTA_NO_DISPONIBLE;
  return sinBloques;
};

const esModeloUtilizable = (nombre) => {
  if (!nombre || !nombre.includes('gemini')) return false;
  return !/embedding|imagen|image|tts|audio|live|vision|robotics|veo|aqa|learnlm/i.test(nombre);
};

const elegirModelo = (modelos) => {
  const nombres = (Array.isArray(modelos) ? modelos : [])
    .filter((modelo) => {
      const acciones = modelo?.supportedActions || modelo?.supportedGenerationMethods;
      if (Array.isArray(acciones) && acciones.length > 0 && !acciones.includes('generateContent')) {
        return false;
      }
      return esModeloUtilizable(String(modelo?.name || '').replace(/^models\//, ''));
    })
    .map((modelo) => String(modelo.name).replace(/^models\//, ''));

  const flash = nombres.filter((nombre) => nombre.includes('flash')).sort().reverse();
  return flash[0] || nombres.sort().reverse()[0] || null;
};

const descubrirModelo = async (listarModelos, modeloActual) => {
  if (!listarModelos) return null;
  try {
    const modelos = await listarModelos();
    const elegido = elegirModelo(modelos);
    if (elegido) {
      modeloResuelto = elegido;
      registrar('warn', 'modelo_alternativo', { configurado: modeloActual, usado: elegido });
    }
    return elegido;
  } catch (error) {
    registrar('warn', 'descubrimiento_modelo_fallido', { mensaje: error?.message || 'error desconocido' });
    return null;
  }
};

const construirListadorPorDefecto = () => async () => {
  const cliente = obtenerClienteGemini();
  const pager = await cliente.models.list({ config: { pageSize: 50 } });
  const modelos = [];
  for await (const modelo of pager) modelos.push(modelo);
  return modelos;
};

/**
 * Ejecuta una llamada al modelo con timeout propio y la traduce a un AiError
 * tipado. El timeout total del turno se controla fuera de esta función.
 */
const invocarModelo = (generarContenido, request, modelo, timeoutMs) => {
  const controller = new AbortController();
  let temporizador;

  const timeout = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => {
      controller.abort();
      rechazar(new AiError(
        CODIGOS_IA.TIMEOUT,
        `El proveedor de IA no respondió en ${timeoutMs} ms.`,
        { status: 504, reintentable: true, detalleTecnico: `timeout de ${timeoutMs} ms` },
      ));
    }, timeoutMs);
  });

  const promesa = Promise.resolve()
    .then(() => generarContenido({
      ...request,
      model: modelo,
      config: { ...request.config, abortSignal: controller.signal },
    }))
    .catch((error) => {
      throw esAiError(error) ? error : normalizarErrorProveedor(error, modelo);
    });

  // Si gana el timeout, la promesa original puede rechazar después: evitamos
  // un "unhandled rejection" sin alterar el resultado de la carrera.
  promesa.catch(() => {});

  return Promise.race([promesa, timeout]).finally(() => clearTimeout(temporizador));
};

const procesarChat = async (historialMensajes, usuarioAutenticado, opciones = {}) => {
  const instruccionSistema = historialMensajes.find((mensaje) => mensaje.role === 'system')?.content;
  const contents = historialMensajes
    .filter((mensaje) => mensaje.role !== 'system')
    .map((mensaje) => ({
      role: mensaje.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: mensaje.content }],
    }));

  const generarContenido = opciones.generateContent
    || ((request) => obtenerClienteGemini().models.generateContent(request));
  const ejecutarTool = opciones.executeTool || ejecutarToolParaModelo;
  const esperar = opciones.esperar || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const listarModelos = opciones.listarModelos || construirListadorPorDefecto();

  const timeoutPorLlamada = Number(opciones.timeoutPorLlamadaMs) || TIMEOUT_POR_LLAMADA_MS;
  const timeoutTotal = Number(opciones.timeoutTotalMs) || TIMEOUT_TOTAL_MS;
  const inicio = Date.now();

  let modelo = resolverModelo(opciones);

  const conReintento = async (fn) => {
    let ultimoError;
    for (let intento = 0; intento <= MAX_REINTENTOS_PROVEEDOR; intento += 1) {
      try {
        return await fn();
      } catch (error) {
        ultimoError = error;
        const puedeReintentar = esAiError(error)
          && error.reintentable
          && intento < MAX_REINTENTOS_PROVEEDOR;
        if (!puedeReintentar) throw error;
        registrar('warn', 'reintento_proveedor', {
          codigo: error.codigo,
          intento: intento + 1,
          esperaMs: ESPERA_REINTENTO_MS,
        });
        await esperar(ESPERA_REINTENTO_MS);
      }
    }
    throw ultimoError;
  };

  const llamarModelo = async (request, paso) => {
    const restante = timeoutTotal - (Date.now() - inicio);
    if (restante <= 0) {
      throw new AiError(
        CODIGOS_IA.TIMEOUT,
        'El asistente superó el tiempo máximo para responder.',
        { status: 504, reintentable: true, detalleTecnico: `presupuesto de ${timeoutTotal} ms agotado` },
      );
    }
    const timeoutMs = Math.min(timeoutPorLlamada, restante);
    const intento = () => invocarModelo(generarContenido, request, modelo, timeoutMs);

    try {
      return await conReintento(intento);
    } catch (error) {
      const puedeDescubrir = esAiError(error)
        && error.codigo === CODIGOS_IA.MODELO_INEXISTENTE
        && !descubrimientoIntentado;
      if (!puedeDescubrir) throw error;

      descubrimientoIntentado = true;
      const alternativo = await descubrirModelo(listarModelos, modelo);
      if (!alternativo || alternativo === modelo) {
        // Si el descubrimiento falló por una causa transitoria, permitimos
        // volver a intentarlo en el próximo mensaje del usuario.
        descubrimientoIntentado = false;
        throw error;
      }

      modelo = alternativo;
      return conReintento(intento);
    } finally {
      registrar('info', 'llamada_modelo', {
        paso,
        modelo,
        duracionMs: Date.now() - inicio,
      });
    }
  };

  const requestBase = {
    contents,
    config: {
      systemInstruction: instruccionSistema,
      tools: toolsEsquemas,
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  for (let paso = 0; paso < MAX_PASOS_TOOL; paso += 1) {
    const response = await llamarModelo(requestBase, paso + 1);
    const functionCalls = Array.isArray(response?.functionCalls) ? response.functionCalls : [];

    if (functionCalls.length === 0) {
      const texto = normalizarTextoVisible(leerTexto(response));
      if (!texto) {
        throw new AiError(
          CODIGOS_IA.INTERNO,
          'El asistente no devolvió una respuesta de texto.',
          { status: 500, detalleTecnico: 'respuesta sin texto ni function calls' },
        );
      }
      return { role: 'assistant', content: texto };
    }

    const contenidoModelo = response?.candidates?.[0]?.content;
    if (!contenidoModelo) {
      throw new AiError(
        CODIGOS_IA.INTERNO,
        'El asistente solicitó una herramienta sin devolver el contenido de la conversación.',
        { status: 500, detalleTecnico: 'candidate.content ausente con functionCalls' },
      );
    }
    contents.push(contenidoModelo);

    const partesRespuesta = [];
    for (const call of functionCalls) {
      const nombre = call?.name;
      const argumentos = call?.args || {};
      let salida;

      try {
        salida = await ejecutarTool(nombre, argumentos, usuarioAutenticado);
      } catch (error) {
        salida = {
          ok: false,
          codigo: esAiError(error) ? error.codigo : CODIGOS_IA.INTERNO,
          mensaje: esAiError(error) ? error.message : 'No se pudo ejecutar la consulta solicitada.',
        };
      }

      // Las herramientas pueden devolver el formato estructurado { ok, resultado }
      // o directamente el dato. Ambos casos se envían al modelo sin romper el turno.
      const respuestaFuncion = salida && typeof salida === 'object' && typeof salida.ok === 'boolean'
        ? (salida.ok
          ? { result: salida.resultado }
          : {
            result: null,
            error: true,
            codigo: salida.codigo || CODIGOS_IA.INTERNO,
            mensaje: salida.mensaje || 'No se pudo ejecutar la consulta solicitada.',
          })
        : { result: salida };

      partesRespuesta.push({
        functionResponse: {
          name: nombre,
          response: respuestaFuncion,
        },
      });
    }

    contents.push({ role: 'user', parts: partesRespuesta });
  }

  registrar('warn', 'limite_pasos_herramientas', { maxPasos: MAX_PASOS_TOOL });
  return {
    role: 'assistant',
    content: 'No pude completar la consulta con la información disponible. '
      + 'Probá reformularla o pedime otra cosa.',
  };
};

const reiniciarEstadoParaPruebas = () => {
  clienteGemini = null;
  modeloResuelto = null;
  descubrimientoIntentado = false;
};

module.exports = {
  MODELO_POR_DEFECTO,
  MAX_PASOS_TOOL,
  TIMEOUT_POR_LLAMADA_MS,
  TIMEOUT_TOTAL_MS,
  RESPUESTA_NO_DISPONIBLE,
  procesarChat,
  normalizarTextoVisible,
  resolverModelo,
  elegirModelo,
  reiniciarEstadoParaPruebas,
};
