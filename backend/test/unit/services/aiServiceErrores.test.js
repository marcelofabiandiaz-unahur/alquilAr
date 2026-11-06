const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MODELO_POR_DEFECTO,
  RESPUESTA_NO_DISPONIBLE,
  elegirModelo,
  normalizarTextoVisible,
  procesarChat,
  reiniciarEstadoParaPruebas,
  resolverModelo,
} = require('../../../src/services/aiService');
const { ejecutarToolParaModelo } = require('../../../src/services/aiToolsRegistry');
const { CODIGOS_IA } = require('../../../src/utils/aiErrors');

const USUARIO = { id: 'user-1', roles: ['INQUILINO'] };

const historial = [{ role: 'user', content: 'Hola' }];

const errorConStatus = (status, message = 'falla del proveedor') => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const respuestaConTool = (name, args) => ({
  functionCalls: [{ name, args }],
  candidates: [{
    content: {
      role: 'model',
      parts: [{ functionCall: { name, args } }],
    },
  }],
});

test.beforeEach(() => {
  reiniciarEstadoParaPruebas();
});

test('un 401 del proveedor se traduce a AUTENTICACION_PROVEEDOR sin reintentar', async () => {
  let llamadas = 0;

  await assert.rejects(
    procesarChat(historial, USUARIO, {
      generateContent: async () => {
        llamadas += 1;
        throw errorConStatus(401, 'API key not valid');
      },
      esperar: async () => {},
      listarModelos: async () => [],
    }),
    (error) => {
      assert.equal(error.name, 'AiError');
      assert.equal(error.codigo, CODIGOS_IA.AUTENTICACION_PROVEEDOR);
      assert.equal(error.status, 503);
      assert.equal(error.reintentable, false);
      return true;
    },
  );

  assert.equal(llamadas, 1);
});

test('un modelo inexistente sin alternativa se reporta como MODELO_INEXISTENTE', async () => {
  await assert.rejects(
    procesarChat(historial, USUARIO, {
      modelo: 'modelo-inventado',
      generateContent: async () => {
        throw errorConStatus(404, 'model not found');
      },
      listarModelos: async () => [],
      esperar: async () => {},
    }),
    (error) => {
      assert.equal(error.codigo, CODIGOS_IA.MODELO_INEXISTENTE);
      assert.equal(error.status, 503);
      return true;
    },
  );
});

test('ante un 404 se descubre un modelo alternativo y se reintenta una vez', async () => {
  const solicitudes = [];
  const respuestas = [
    () => { throw errorConStatus(404, 'model not found'); },
    () => ({ text: 'Hola desde el modelo alternativo.', functionCalls: [] }),
  ];

  const resultado = await procesarChat(historial, USUARIO, {
    modelo: 'modelo-viejo',
    generateContent: async (request) => {
      solicitudes.push(request);
      return respuestas.shift()();
    },
    listarModelos: async () => [
      { name: 'models/text-embedding-004' },
      { name: 'models/gemini-9.9-pro', supportedActions: ['generateContent'] },
      { name: 'models/gemini-9.9-flash', supportedActions: ['generateContent'] },
    ],
    esperar: async () => {},
  });

  assert.match(resultado.content, /modelo alternativo/i);
  assert.equal(solicitudes[0].model, 'modelo-viejo');
  assert.equal(solicitudes[1].model, 'gemini-9.9-flash');
});

test('un 429 reintenta una vez y devuelve la respuesta si el proveedor se recupera', async () => {
  let llamadas = 0;

  const resultado = await procesarChat(historial, USUARIO, {
    generateContent: async () => {
      llamadas += 1;
      if (llamadas === 1) throw errorConStatus(429, 'resource_exhausted');
      return { text: 'Respondido tras el límite.', functionCalls: [] };
    },
    listarModelos: async () => [],
    esperar: async () => {},
  });

  assert.match(resultado.content, /tras el límite/i);
  assert.equal(llamadas, 2);
});

test('un 429 persistente se reporta como LIMITE_PROVEEDOR', async () => {
  let llamadas = 0;

  await assert.rejects(
    procesarChat(historial, USUARIO, {
      generateContent: async () => {
        llamadas += 1;
        throw errorConStatus(429, 'quota exceeded');
      },
      listarModelos: async () => [],
      esperar: async () => {},
    }),
    (error) => {
      assert.equal(error.codigo, CODIGOS_IA.LIMITE_PROVEEDOR);
      assert.equal(error.reintentable, true);
      assert.equal(error.status, 503);
      return true;
    },
  );

  assert.equal(llamadas, 2);
});

test('un 500 persistente se reporta como PROVEEDOR y no como 502 genérico', async () => {
  let llamadas = 0;

  await assert.rejects(
    procesarChat(historial, USUARIO, {
      generateContent: async () => {
        llamadas += 1;
        throw errorConStatus(500, 'internal error');
      },
      listarModelos: async () => [],
      esperar: async () => {},
    }),
    (error) => {
      assert.equal(error.codigo, CODIGOS_IA.PROVEEDOR);
      assert.equal(error.status, 503);
      assert.match(error.detalleTecnico, /500/);
      return true;
    },
  );

  assert.equal(llamadas, 2);
});

test('un timeout del proveedor se reporta como TIMEOUT con status 504', async () => {
  let llamadas = 0;

  await assert.rejects(
    procesarChat(historial, USUARIO, {
      generateContent: async (request) => {
        llamadas += 1;
        assert.ok(request.config.abortSignal);
        return new Promise(() => {});
      },
      listarModelos: async () => [],
      esperar: async () => {},
      timeoutPorLlamadaMs: 10,
      timeoutTotalMs: 100,
    }),
    (error) => {
      assert.equal(error.codigo, CODIGOS_IA.TIMEOUT);
      assert.equal(error.status, 504);
      assert.equal(error.reintentable, true);
      return true;
    },
  );

  assert.equal(llamadas, 2);
});

test('un error de herramienta se envía al modelo de forma estructurada', async () => {
  const solicitudes = [];
  const respuestas = [
    respuestaConTool('consultarFinanzas', { accion: 'SALDOS' }),
    { text: 'No tenés permisos para consultar saldos.', functionCalls: [] },
  ];

  const resultado = await procesarChat(historial, USUARIO, {
    generateContent: async (request) => {
      solicitudes.push(request);
      return respuestas.shift();
    },
    executeTool: async () => ({
      ok: false,
      codigo: CODIGOS_IA.SIN_PERMISO,
      mensaje: 'No tenés permisos para consultar saldos.',
    }),
    listarModelos: async () => [],
  });

  assert.match(resultado.content, /permisos/i);
  assert.deepEqual(solicitudes[1].contents.at(-1), {
    role: 'user',
    parts: [{
      functionResponse: {
        name: 'consultarFinanzas',
        response: {
          result: null,
          error: true,
          codigo: CODIGOS_IA.SIN_PERMISO,
          mensaje: 'No tenés permisos para consultar saldos.',
        },
      },
    }],
  });
});

test('un reintento del proveedor no vuelve a ejecutar la herramienta', async () => {
  let llamadasModelo = 0;
  let llamadasTool = 0;

  const resultado = await procesarChat(historial, USUARIO, {
    generateContent: async () => {
      llamadasModelo += 1;
      if (llamadasModelo === 1) {
        return respuestaConTool('gestionarReclamos', { accion: 'CREAR' });
      }
      if (llamadasModelo === 2) throw errorConStatus(429, 'rate limited');
      return { text: 'Listo, el reclamo no se duplicó.', functionCalls: [] };
    },
    executeTool: async () => {
      llamadasTool += 1;
      return { ok: true, resultado: { creado: true, id: 'reclamo-1' } };
    },
    listarModelos: async () => [],
    esperar: async () => {},
  });

  assert.match(resultado.content, /no se duplicó/i);
  assert.equal(llamadasTool, 1);
  assert.equal(llamadasModelo, 3);
});

test('ejecutarToolParaModelo no lanza y clasifica los permisos', async () => {
  const resultado = await ejecutarToolParaModelo(
    'consultarDatosAlquiler',
    {},
    { id: 'user-1', roles: ['USUARIO'] },
  );

  assert.deepEqual(resultado, {
    ok: false,
    codigo: CODIGOS_IA.SIN_PERMISO,
    mensaje: 'No tenés permiso para consultar contratos.',
  });

  const desconocida = await ejecutarToolParaModelo('herramientaInexistente', {}, USUARIO);
  assert.equal(desconocida.ok, false);
  assert.equal(desconocida.codigo, CODIGOS_IA.INTERNO);
});

test('elegirModelo prefiere un modelo flash utilizable y descarta los que no generan texto', () => {
  assert.equal(
    elegirModelo([
      { name: 'models/text-embedding-004' },
      { name: 'models/gemini-9-flash-image' },
      { name: 'models/gemini-9-pro' },
      { name: 'models/gemini-9-flash' },
    ]),
    'gemini-9-flash',
  );

  assert.equal(
    elegirModelo([
      { name: 'models/gemini-9-pro', supportedActions: ['embedContent'] },
      { name: 'models/text-embedding-004' },
    ]),
    null,
  );
});

test('normalizarTextoVisible convierte salidas técnicas en una respuesta amable', () => {
  assert.equal(normalizarTextoVisible('{"resultado": []}'), RESPUESTA_NO_DISPONIBLE);
  assert.equal(normalizarTextoVisible('[{"id": 1}]'), RESPUESTA_NO_DISPONIBLE);
  assert.equal(normalizarTextoVisible('```json\n{"accion":"SALDOS"}\n```'), RESPUESTA_NO_DISPONIBLE);
  assert.equal(normalizarTextoVisible('   '), '');
  assert.match(normalizarTextoVisible('Hola, ¿en qué te ayudo?'), /^Hola/);
  assert.match(normalizarTextoVisible('Texto ```code``` final'), /^Texto\s+final$/);
});

test('procesarChat nunca devuelve JSON crudo al usuario', async () => {
  const resultado = await procesarChat(historial, USUARIO, {
    generateContent: async () => ({ text: '{"resultado":[1,2,3]}', functionCalls: [] }),
    listarModelos: async () => [],
  });

  assert.equal(resultado.content, RESPUESTA_NO_DISPONIBLE);
});

test('resolverModelo respeta opciones, variable de entorno y valor por defecto', () => {
  const original = process.env.GEMINI_MODEL;

  try {
    delete process.env.GEMINI_MODEL;
    assert.equal(resolverModelo({}), MODELO_POR_DEFECTO);

    process.env.GEMINI_MODEL = 'modelo-desde-env';
    assert.equal(resolverModelo({}), 'modelo-desde-env');
    assert.equal(resolverModelo({ modelo: 'modelo-explicito' }), 'modelo-explicito');
  } finally {
    if (original === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = original;
  }
});
