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
      functionCalls: [{ name: 'listarMisReclamos', args: {} }],
      candidates: [{
        content: {
          role: 'model',
          parts: [{ functionCall: { name: 'listarMisReclamos', args: {} } }],
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
  assert.deepEqual(llamadasTool, [['listarMisReclamos', {}, { id: 'inquilino-1', roles: ['INQUILINO'] }]]);
  assert.deepEqual(solicitudes[1].contents.slice(-2), [
    {
      role: 'model',
      parts: [{ functionCall: { name: 'listarMisReclamos', args: {} } }],
    },
    {
      role: 'user',
      parts: [{
        functionResponse: {
          name: 'listarMisReclamos',
          response: { result: { success: true, data: [{ asunto: 'Pérdida de agua' }] } },
        },
      }],
    },
  ]);
});

test('procesarChat limita el número de rondas de herramientas', async () => {
  let llamadas = 0;
  await assert.rejects(
    procesarChat([{ role: 'user', content: 'Listá mis reclamos' }], { id: 'inquilino-1' }, {
      generateContent: async () => {
        llamadas += 1;
        return {
          functionCalls: [{ name: 'listarMisReclamos', args: {} }],
          candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'listarMisReclamos', args: {} } }] } }],
        };
      },
      executeTool: async () => [],
    }),
    /máximo de pasos/i,
  );
  assert.equal(llamadas, 6);
});
