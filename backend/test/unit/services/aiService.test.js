const test = require('node:test');
const assert = require('node:assert/strict');
const { procesarChat } = require('../../../src/services/aiService');

test('procesarChat devuelve la respuesta final si Gemini no solicita herramientas', async () => {
  let solicitud;
  const resultado = await procesarChat([
    { role: 'system', content: 'Instrucciones privadas' },
    { role: 'user', content: 'Hola' },
  ], { id: 'usuario-1' }, {
    generateContent: async (request) => {
      solicitud = request;
      return { text: 'Hola.', functionCalls: [] };
    },
  });

  assert.deepEqual(resultado, { role: 'assistant', content: 'Hola.' });
  assert.equal(solicitud.config.systemInstruction, 'Instrucciones privadas');
  assert.deepEqual(solicitud.contents, [{ role: 'user', parts: [{ text: 'Hola' }] }]);
  assert.equal(solicitud.config.tools.length, 1);
});

test('procesarChat ejecuta herramientas y devuelve a Gemini la respuesta de función', async () => {
  const solicitudes = [];
  const llamadasTool = [];
  const respuestas = [
    {
      functionCalls: [{ name: 'gestionarReclamos', args: { accion: 'LISTAR_RECLAMOS' } }],
      candidates: [{
        content: {
          role: 'model',
          parts: [{ functionCall: { name: 'gestionarReclamos', args: { accion: 'LISTAR_RECLAMOS' } } }],
        },
      }],
    },
    { text: 'Tenés un reclamo abierto.', functionCalls: [] },
  ];

  const resultado = await procesarChat([
    { role: 'system', content: 'Instrucciones' },
    { role: 'user', content: 'Mostrame mis reclamos' },
  ], { id: 'inquilino-1', roles: ['INQUILINO'] }, {
    generateContent: async (request) => {
      solicitudes.push(request);
      return respuestas.shift();
    },
    executeTool: async (...args) => {
      llamadasTool.push(args);
      return { success: true, data: [{ asunto: 'Pérdida de agua' }] };
    },
  });

  assert.deepEqual(resultado, { role: 'assistant', content: 'Tenés un reclamo abierto.' });
  assert.deepEqual(llamadasTool, [['gestionarReclamos', { accion: 'LISTAR_RECLAMOS' }, { id: 'inquilino-1', roles: ['INQUILINO'] }]]);
  assert.deepEqual(solicitudes[1].contents.slice(-2), [
    {
      role: 'model',
      parts: [{ functionCall: { name: 'gestionarReclamos', args: { accion: 'LISTAR_RECLAMOS' } } }],
    },
    {
      role: 'user',
      parts: [{
        functionResponse: {
          name: 'gestionarReclamos',
          response: { result: { success: true, data: [{ asunto: 'Pérdida de agua' }] } },
        },
      }],
    },
  ]);
});

test('procesarChat conserva el resultado de clasificación para responder antes de crear un reclamo', async () => {
  const solicitudes = [];
  const llamada = {
    name: 'gestionarReclamos',
    args: {
      accion: 'CLASIFICAR',
      asunto: 'Pérdida de agua',
      descripcion: 'Hay una cañería rota en la cocina.',
    },
  };
  const resultadoClasificacion = {
    categoria: 'PLOMERIA',
    prioridad: 'ALTA',
    justificacion: 'La descripción indica una pérdida de agua.',
    primeros_auxilios: ['Cerrá la llave de paso.'],
  };

  const resultado = await procesarChat([
    { role: 'system', content: 'Pedí confirmación antes de crear reclamos.' },
    { role: 'user', content: 'Quiero reportar una pérdida de agua.' },
  ], { id: 'inquilino-1', roles: ['INQUILINO'] }, {
    generateContent: async (request) => {
      solicitudes.push(request);
      if (solicitudes.length === 1) {
        return {
          functionCalls: [llamada],
          candidates: [{
            content: {
              role: 'model',
              parts: [{ functionCall: llamada }],
            },
          }],
        };
      }
      return {
        text: 'La incidencia se clasifica como PLOMERÍA, con prioridad alta. ¿Confirmás que registre el reclamo?',
        functionCalls: [],
      };
    },
    executeTool: async () => ({ ok: true, resultado: resultadoClasificacion }),
  });

  assert.match(resultado.content, /PLOMERÍA.*prioridad alta/i);
  assert.match(resultado.content, /confirmás/i);
  assert.deepEqual(solicitudes[1].contents.slice(-2), [
    { role: 'model', parts: [{ functionCall: llamada }] },
    {
      role: 'user',
      parts: [{
        functionResponse: {
          name: 'gestionarReclamos',
          response: { result: resultadoClasificacion },
        },
      }],
    },
  ]);
});

test('procesarChat limita el número de rondas de herramientas y responde con un mensaje final', async () => {
  let llamadasModelo = 0;
  let llamadasTool = 0;
  const resultado = await procesarChat(
    [{ role: 'user', content: 'Listá mis reclamos' }],
    { id: 'inquilino-1' },
    {
      generateContent: async () => {
        llamadasModelo += 1;
        return {
          functionCalls: [{ name: 'gestionarReclamos', args: { accion: 'LISTAR_RECLAMOS' } }],
          candidates: [{
            content: {
              role: 'model',
              parts: [{ functionCall: { name: 'gestionarReclamos', args: { accion: 'LISTAR_RECLAMOS' } } }],
            },
          }],
        };
      },
      executeTool: async () => {
        llamadasTool += 1;
        return { ok: true, resultado: [] };
      },
    },
  );

  assert.equal(llamadasModelo, 3);
  assert.equal(llamadasTool, 3);
  assert.match(resultado.content, /No pude completar la consulta/i);
});
