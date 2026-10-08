const { GoogleGenAI } = require('@google/genai');
const { toolsEsquemas, ejecutarToolSegura } = require('./aiToolsRegistry');

const MODELO_GEMINI = 'gemini-3.8-flash';
const MAX_PASOS_TOOL = 5;
let clienteGemini;

const obtenerClienteGemini = () => {
  if (clienteGemini) return clienteGemini;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Falta configurar GEMINI_API_KEY en el entorno del backend.');
  }
  clienteGemini = new GoogleGenAI({ apiKey });
  return clienteGemini;
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

  for (let paso = 0; paso <= MAX_PASOS_TOOL; paso += 1) {
    const response = await generarContenido({
      model: MODELO_GEMINI,
      contents,
      config: {
        systemInstruction: instruccionSistema,
        tools: toolsEsquemas,
      },
    });
    const functionCalls = response.functionCalls || [];
    if (functionCalls.length === 0) {
      if (typeof response.text !== 'string' || !response.text.trim()) {
        throw new Error('Gemini no devolvió una respuesta de texto.');
      }
      return { role: 'assistant', content: response.text };
    }
    if (paso === MAX_PASOS_TOOL) {
      throw new Error('Gemini superó el máximo de pasos de herramientas permitidos.');
    }

    const contenidoModelo = response.candidates?.[0]?.content;
    if (!contenidoModelo) {
      throw new Error('Gemini solicitó una herramienta sin devolver el contenido de la conversación.');
    }
    contents.push(contenidoModelo);

    const functionResponses = [];
    for (const call of functionCalls) {
      const resultado = await ejecutarTool(call.name, call.args || {}, usuarioAutenticado);
      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: { result: resultado },
        },
      });
    }
    contents.push({ role: 'user', parts: functionResponses });
  }

  throw new Error('No se pudo completar la conversación con Gemini.');
};

module.exports = { procesarChat };
