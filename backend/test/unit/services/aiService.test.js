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

test('procesarChat ejecuta la herramienta una vez y resume el resultado sin otra consulta a Gemini', async () => {
  let llamadasGemini = 0;
  const llamadasTool = [];

  const resultado = await procesarChat([
    { role: 'system', content: 'Instrucciones' },
    { role: 'user', content: 'Mostrame mis reclamos' },
  ], { id: 'inquilino-1', roles: ['INQUILINO'] }, {
    generateContent: async (request) => {
      llamadasGemini += 1;
      assert.equal(request.config.maxOutputTokens, 256);
      assert.equal(request.config.thinkingLevel, 'MINIMAL');
      assert.deepEqual(request.config.httpOptions, {
        timeout: 10000,
        retryOptions: { attempts: 1 },
      });
      return {
        functionCalls: [{ name: 'gestionarReclamos', args: { accion: 'LISTAR' } }],
      };
    },
    executeTool: async (...args) => {
      llamadasTool.push(args);
      return {
        success: true,
        data: [{ asunto: 'Pérdida de agua', estado: 'PENDIENTE', prioridad: 'ALTA' }],
      };
    },
  });

  assert.deepEqual(resultado, {
    role: 'assistant',
    content: 'Reclamos (1): Pérdida de agua — PENDIENTE, prioridad ALTA.',
  });
  assert.equal(llamadasGemini, 1);
  assert.deepEqual(llamadasTool, [['gestionarReclamos', { accion: 'LISTAR' }, { id: 'inquilino-1', roles: ['INQUILINO'] }]]);
});

test('procesarChat respeta filtros de estado para consultas de contratos y pagos', async () => {
  const resultado = await procesarChat([
    { role: 'system', content: 'Instrucciones' },
    { role: 'user', content: '¿Qué pagos tengo atrasados?' },
  ], { id: 'inquilino-1', roles: ['INQUILINO'] }, {
    generateContent: async () => ({
      functionCalls: [{
        name: 'consultarDatosAlquiler',
        args: { alcance: 'PAGOS', estado_pago: 'ATRASADO' },
      }],
    }),
    executeTool: async () => ({
      pagos: [
        { mes_correspondiente: '202610', estado: 'ATRASADO', monto_total: 5000 },
        { mes_correspondiente: '202611', estado: 'PENDIENTE', monto_total: 6000 },
      ],
    }),
  });

  assert.deepEqual(resultado, {
    role: 'assistant',
    content: 'Pagos con estado ATRASADO (1): 202610 — ATRASADO — $5000.',
  });
});

test('procesarChat no ejecuta herramientas si la respuesta de Gemini solo contiene texto', async () => {
  await assert.rejects(
    procesarChat([{ role: 'user', content: 'Hola' }], { id: 'inquilino-1' }, {
      generateContent: async () => ({ text: '', functionCalls: [] }),
    }),
    /no devolvió una respuesta de texto/i,
  );
});
