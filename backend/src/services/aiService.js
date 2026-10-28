const { GoogleGenAI } = require('@google/genai');
const { toolsEsquemas, ejecutarToolSegura } = require('./aiToolsRegistry');

const MODELO_GEMINI = 'gemini-3.8-flash';
const TIMEOUT_GEMINI_MS = 10000;
let clienteGemini;

const obtenerClienteGemini = () => {
  if (clienteGemini) return clienteGemini;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Falta configurar GEMINI_API_KEY en el entorno del backend.');
  }
  clienteGemini = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: TIMEOUT_GEMINI_MS,
      retryOptions: { attempts: 1 },
    },
  });
  return clienteGemini;
};

const textoSeguro = (valor, alternativa = 'Sin dato') =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : alternativa;

const resumirHerramienta = (nombre, argumentos, resultado) => {
  if (nombre === 'consultarDatosAlquiler') {
    const secciones = [];
    if (Array.isArray(resultado?.contratos)) {
      const contratos = argumentos?.estado_contrato
        ? resultado.contratos.filter((contrato) => contrato.estado === argumentos.estado_contrato)
        : resultado.contratos;
      secciones.push(contratos.length
        ? `Contratos (${contratos.length}): ${contratos.slice(0, 8).map((contrato) =>
          `${textoSeguro(contrato.propiedad, 'Propiedad')} — ${textoSeguro(contrato.estado)}`
          + `${contrato.fecha_fin ? `, vence ${contrato.fecha_fin}` : ''}`).join('; ')}.`
        : argumentos?.estado_contrato
          ? `No se encontraron contratos con estado ${argumentos.estado_contrato} visibles en tu cuenta.`
          : 'No se encontraron contratos visibles en tu cuenta.');
    }
    if (Array.isArray(resultado?.pagos)) {
      const pagos = argumentos?.estado_pago
        ? resultado.pagos.filter((pago) => pago.estado === argumentos.estado_pago)
        : argumentos?.alcance === 'PAGOS'
          ? resultado.pagos
          : resultado.pagos.filter((pago) => ['PENDIENTE', 'ATRASADO', 'INGRESADO'].includes(pago.estado));
      secciones.push(pagos.length
        ? `Pagos${argumentos?.estado_pago ? ` con estado ${argumentos.estado_pago}` : argumentos?.alcance === 'PAGOS' ? '' : ' pendientes o en revisión'} (${pagos.length}): ${
          pagos.slice(0, 8).map((pago) => `${textoSeguro(pago.mes_correspondiente, 'Período')} — `
            + `${textoSeguro(pago.estado)} — $${pago.monto_total ?? 'sin monto'}`
            + `${pago.propiedad ? ` — ${pago.propiedad}` : ''}`).join('; ')}.`
        : argumentos?.estado_pago
          ? `No se encontraron pagos con estado ${argumentos.estado_pago}.`
          : argumentos?.alcance === 'PAGOS'
          ? 'No se encontraron pagos visibles en tu cuenta.'
          : 'No hay pagos pendientes o en revisión en la información consultada.');
      if (pagos.length > 8) {
        secciones[secciones.length - 1] += ` Se muestran 8 de ${pagos.length}.`;
      }
    }
    return secciones.length
      ? secciones.join(' ')
      : 'No encontré información de alquiler para tu cuenta.';
  }

  const datos = Array.isArray(resultado?.data) ? resultado.data : resultado;
  if (nombre === 'gestionarReclamos' && argumentos?.accion === 'CREAR') {
    const reclamo = resultado?.data;
    return resultado?.success === true
      ? `El reclamo "${textoSeguro(reclamo?.asunto, 'Reclamo')}" se registró correctamente.`
      : 'El servidor no confirmó el registro del reclamo.';
  }
  if (Array.isArray(datos)) {
    if (datos.length === 0) {
      return argumentos?.accion === 'CONTRATOS_VIGENTES'
        ? 'No tenés contratos vigentes disponibles para iniciar un reclamo.'
        : 'No se encontraron reclamos visibles en tu cuenta.';
    }
    if (argumentos?.accion === 'CONTRATOS_VIGENTES') {
      return `Contratos vigentes (${datos.length}): ${datos.map((contrato) =>
        `${textoSeguro(contrato.propiedad, 'Propiedad')} — hasta ${textoSeguro(contrato.fecha_fin)}`).join('; ')}.`;
    }
    return `Reclamos (${datos.length}): ${datos.map((reclamo) =>
      `${textoSeguro(reclamo.asunto, 'Reclamo')} — ${textoSeguro(reclamo.estado)}`
      + `${reclamo.prioridad ? `, prioridad ${reclamo.prioridad}` : ''}`).join('; ')}.`;
  }
  return 'La herramienta no devolvió información en un formato reconocible. No se realizó ninguna otra acción.';
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
  const ejecutarTool = opciones.executeTool || ejecutarToolSegura;
  const herramientas = opciones.herramientas || toolsEsquemas;

  const response = await generarContenido({
    model: MODELO_GEMINI,
    contents,
    config: {
      systemInstruction: instruccionSistema,
      ...(herramientas.length > 0 && { tools: herramientas }),
      maxOutputTokens: 256,
      temperature: 0.2,
      thinkingLevel: 'MINIMAL',
      httpOptions: {
        timeout: TIMEOUT_GEMINI_MS,
        retryOptions: { attempts: 1 },
      },
    },
  });
  const functionCalls = response.functionCalls || [];
  if (functionCalls.length === 0) {
    if (typeof response.text !== 'string' || !response.text.trim()) {
      throw new Error('Gemini no devolvió una respuesta de texto.');
    }
    return { role: 'assistant', content: response.text };
  }

  const resúmenes = [];
  for (const call of functionCalls) {
    const resultado = await ejecutarTool(call.name, call.args || {}, usuarioAutenticado);
    resúmenes.push(resumirHerramienta(call.name, call.args || {}, resultado));
  }
  return { role: 'assistant', content: resúmenes.join('\n') };
};

module.exports = { procesarChat, resumirHerramienta };
