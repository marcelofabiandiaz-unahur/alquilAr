const test = require('node:test');
const assert = require('node:assert/strict');
const aiController = require('../../src/controllers/aiController');
const aiService = require('../../src/services/aiService');
const aiIntencionesService = require('../../src/services/aiIntencionesService');
const aiAgrupamientoService = require('../../src/services/aiAgrupamientoService');
const aiFinanzasService = require('../../src/services/aiFinanzasService');
const { AiError, CODIGOS_IA } = require('../../src/utils/aiErrors');

const originales = {
  procesarChat: aiService.procesarChat,
  ejecutarIntencion: aiIntencionesService.ejecutarIntencion,
  consultarResumen: aiAgrupamientoService.consultarResumenAgrupamiento,
  consultarSaldos: aiFinanzasService.consultarSaldos,
};

test.afterEach(() => {
  aiService.procesarChat = originales.procesarChat;
  aiIntencionesService.ejecutarIntencion = originales.ejecutarIntencion;
  aiAgrupamientoService.consultarResumenAgrupamiento = originales.consultarResumen;
  aiFinanzasService.consultarSaldos = originales.consultarSaldos;
});

const mockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const USUARIO_INQUILINO = { id: 'inquilino-1', roles: ['INQUILINO'] };
const USUARIO_PROPIETARIO = { id: 'propietario-1', roles: ['PROPIETARIO'] };
const USUARIO_ADMIN = { id: 'admin-1', roles: ['ADMINISTRADOR'] };

const pedidoChat = (extra = {}) => ({
  body: { mensajes: [{ role: 'user', content: 'Hola' }], ...extra },
  usuario: USUARIO_INQUILINO,
});

// ---------------------------------------------------------------------------
// Resumen del edificio (intención determinista)
// ---------------------------------------------------------------------------

test('RESUMEN_EDIFICIO usa el servicio real y respeta el alcance del administrador', async () => {
  let recibido;
  aiAgrupamientoService.consultarResumenAgrupamiento = async (usuario, args) => {
    recibido = { usuario, args };
    return {
      periodo: '2026-10',
      totalEstimadoMes: 1234.5,
      totalCobradoMes: 1000,
      totalPendienteMes: 234.5,
      reclamosAbiertos: 4,
      reclamosUrgentes: 2,
      agrupamiento: { _id: 'agrup-1', nombre: 'Edificio Norte' },
      unidadesTotales: 10,
      unidadesAlquiladas: 8,
      tasaOcupacion: 80,
      alcance: 'AGRUPAMIENTO',
    };
  };

  const resultado = await aiIntencionesService.ejecutarIntencion(
    aiIntencionesService.INTENCIONES.RESUMEN_EDIFICIO,
    USUARIO_ADMIN,
    { id_agrupamiento: 'agrup-1', periodo: '2026-10' },
  );

  assert.deepEqual(recibido.usuario, USUARIO_ADMIN);
  assert.deepEqual(recibido.args, { id_agrupamiento: 'agrup-1', periodo: '2026-10' });
  assert.equal(resultado.role, 'assistant');
  assert.match(resultado.content, /En el edificio Edificio Norte, para octubre de 2026/);
  assert.match(resultado.content, /1\.234,50/);
  assert.match(resultado.content, /4 reclamos abiertos/);
  assert.match(resultado.content, /2 de ellos son urgentes o de prioridad alta/);
  assert.match(resultado.content, /8 están alquiladas/);
  assert.ok(!/^- /m.test(resultado.content), 'no debe usar viñetas');
  assert.ok(!/[{}\[\]]/.test(resultado.content), 'no debe mostrar estructuras técnicas');
});

test('RESUMEN_EDIFICIO responde claro cuando no hay movimientos', async () => {
  aiAgrupamientoService.consultarResumenAgrupamiento = async () => ({
    periodo: '2026-10',
    totalEstimadoMes: 0,
    totalCobradoMes: 0,
    totalPendienteMes: 0,
    reclamosAbiertos: 0,
    reclamosUrgentes: 0,
    alcance: 'PROPIO',
  });

  const resultado = await aiIntencionesService.ejecutarIntencion(
    aiIntencionesService.INTENCIONES.RESUMEN_EDIFICIO,
    USUARIO_PROPIETARIO,
  );

  assert.match(resultado.content, /En tus contratos, para octubre de 2026 no hay movimientos registrados/);
  assert.match(resultado.content, /consultá con la administración/i);
});

test('RESUMEN_EDIFICIO propaga SIN_PERMISO sin convertirlo en error de conexión', async () => {
  aiAgrupamientoService.consultarResumenAgrupamiento = async () => {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'No tenés permiso para consultar este agrupamiento.', {
      status: 403,
    });
  };

  await assert.rejects(
    aiIntencionesService.ejecutarIntencion(
      aiIntencionesService.INTENCIONES.RESUMEN_EDIFICIO,
      USUARIO_INQUILINO,
      { id_agrupamiento: 'agrup-ajeno' },
    ),
    (error) => error.codigo === CODIGOS_IA.SIN_PERMISO && error.status === 403,
  );
});

// ---------------------------------------------------------------------------
// Saldos (intención determinista)
// ---------------------------------------------------------------------------

test('MIS_SALDOS arma el detalle de cuotas del inquilino', async () => {
  let recibido;
  aiFinanzasService.consultarSaldos = async (usuario, args) => {
    recibido = { usuario, args };
    return {
      totalPendiente: 1500,
      totalAtrasado: 500,
      proximoVencimiento: '2026-10-10',
      cuotas: [
        {
          mes_correspondiente: '202610',
          monto: 1500,
          fecha_vencimiento: '2026-10-10',
          estado: 'PENDIENTE',
          atrasada: true,
        },
      ],
    };
  };

  const resultado = await aiIntencionesService.ejecutarIntencion(
    aiIntencionesService.INTENCIONES.MIS_SALDOS,
    USUARIO_INQUILINO,
  );

  assert.deepEqual(recibido.usuario, USUARIO_INQUILINO);
  assert.deepEqual(recibido.args, {});
  assert.match(resultado.content, /Tenés un total pendiente de/i);
  assert.match(resultado.content, /1\.500,00/);
  assert.match(resultado.content, /500,00 están atrasados/);
  assert.match(resultado.content, /próximo vencimiento es el 10\/10\/2026/i);
  assert.match(resultado.content, /cuota de 10\/2026 es de.*1\.500,00.*10\/10\/2026.*atrasada/i);
  assert.ok(!/^- /m.test(resultado.content), 'no debe usar viñetas');
  assert.ok(!/[{}\[\]]/.test(resultado.content), 'no debe mostrar estructuras técnicas');
});

test('MIS_SALDOS responde sin deuda según el rol', async () => {
  aiFinanzasService.consultarSaldos = async () => ({
    totalPendiente: 0,
    totalAtrasado: 0,
    proximoVencimiento: null,
    cuotas: [],
  });

  const inquilino = await aiIntencionesService.ejecutarIntencion(
    aiIntencionesService.INTENCIONES.MIS_SALDOS,
    USUARIO_INQUILINO,
  );
  assert.match(inquilino.content, /No tenés pagos pendientes/i);

  const propietario = await aiIntencionesService.ejecutarIntencion(
    aiIntencionesService.INTENCIONES.MIS_SALDOS,
    USUARIO_PROPIETARIO,
  );
  assert.match(propietario.content, /No hay pagos pendientes en tus contratos/i);
});

test('MIS_SALDOS recorta el detalle cuando hay muchas cuotas', async () => {
  const cuotas = Array.from({ length: 10 }, (_, indice) => ({
    mes_correspondiente: `2026${String(indice + 1).padStart(2, '0')}`,
    monto: 1000,
    fecha_vencimiento: `2026-${String(indice + 1).padStart(2, '0')}-10`,
    estado: 'PENDIENTE',
    atrasada: false,
  }));
  aiFinanzasService.consultarSaldos = async () => ({
    totalPendiente: 10000,
    totalAtrasado: 0,
    proximoVencimiento: cuotas[0].fecha_vencimiento,
    cuotas,
  });

  const resultado = await aiIntencionesService.ejecutarIntencion(
    aiIntencionesService.INTENCIONES.MIS_SALDOS,
    USUARIO_PROPIETARIO,
  );

  assert.equal(
    (resultado.content.match(/La cuota de \d{2}\/2026/g) || []).length,
    aiIntencionesService.MAX_CUOTAS_DETALLE,
  );
  assert.match(resultado.content, /hay 2 cuotas más/);
});

test('ejecutarIntencion exige identidad y valida el nombre de la intención', async () => {
  await assert.rejects(
    aiIntencionesService.ejecutarIntencion('RESUMEN_EDIFICIO', {}),
    (error) => error.codigo === CODIGOS_IA.SIN_PERMISO && error.status === 401,
  );

  await assert.rejects(
    aiIntencionesService.ejecutarIntencion('BORRAR_TODO', USUARIO_ADMIN),
    (error) => error.codigo === CODIGOS_IA.VALIDACION && error.status === 400,
  );
});

// ---------------------------------------------------------------------------
// Controlador: ruta determinista y mapeo de errores
// ---------------------------------------------------------------------------

test('chatAsistente ejecuta la intención sin llamar a Gemini', async () => {
  let procesarChatLlamado = false;
  let intencionRecibida;
  aiService.procesarChat = async () => {
    procesarChatLlamado = true;
    return { role: 'assistant', content: 'no debería usarse' };
  };
  aiIntencionesService.ejecutarIntencion = async (intencion, usuario, opciones) => {
    intencionRecibida = { intencion, usuario, opciones };
    return { role: 'assistant', content: 'Resumen listo.' };
  };
  const res = mockRes();

  await aiController.chatAsistente(
    pedidoChat({ intencion: 'RESUMEN_EDIFICIO', contexto: { periodo: '2026-10' } }),
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.intencion, 'RESUMEN_EDIFICIO');
  assert.equal(res.body.resultado.content, 'Resumen listo.');
  assert.equal(procesarChatLlamado, false);
  assert.equal(intencionRecibida.intencion, 'RESUMEN_EDIFICIO');
  assert.equal(intencionRecibida.usuario, USUARIO_INQUILINO);
  assert.equal(intencionRecibida.opciones.periodo, '2026-10');
});

test('chatAsistente rechaza una intención desconocida sin llamar a Gemini', async () => {
  let llamado = false;
  aiService.procesarChat = async () => {
    llamado = true;
    return { role: 'assistant', content: 'no' };
  };
  const res = mockRes();

  await aiController.chatAsistente(pedidoChat({ intencion: 'INVENTADA' }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.codigo, CODIGOS_IA.VALIDACION);
  assert.equal(llamado, false);
});

test('chatAsistente resuelve SIN_PERMISO dentro de la conversación con HTTP 200', async () => {
  aiIntencionesService.ejecutarIntencion = async () => {
    throw new AiError(CODIGOS_IA.SIN_PERMISO, 'No tenés permiso para consultar este agrupamiento.', {
      status: 403,
    });
  };
  const res = mockRes();

  await aiController.chatAsistente(
    pedidoChat({ intencion: 'RESUMEN_EDIFICIO' }),
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.codigo, CODIGOS_IA.SIN_PERMISO);
  assert.match(res.body.resultado.content, /No tenés permiso/i);
});

test('chatAsistente mapea errores del proveedor a códigos útiles y sin detalles técnicos', async () => {
  const casos = [
    {
      codigo: CODIGOS_IA.AUTENTICACION_PROVEEDOR,
      status: 503,
      mensaje: 'No pude autenticarme con el proveedor.',
    },
    {
      codigo: CODIGOS_IA.MODELO_INEXISTENTE,
      status: 503,
      mensaje: 'El modelo configurado no existe.',
    },
    {
      codigo: CODIGOS_IA.CONFIGURACION,
      status: 503,
      mensaje: 'Falta configurar la API key.',
    },
    {
      codigo: CODIGOS_IA.PROVEEDOR,
      status: 503,
      mensaje: 'El proveedor devolvió 503.',
    },
    {
      codigo: CODIGOS_IA.TIMEOUT,
      status: 504,
      mensaje: 'El proveedor tardó 20000 ms.',
    },
    {
      codigo: CODIGOS_IA.INTERNO,
      status: 500,
      mensaje: 'detalle interno sensible',
    },
  ];

  for (const caso of casos) {
    aiService.procesarChat = async () => {
      throw new AiError(caso.codigo, caso.mensaje, {
        status: caso.status,
        detalleTecnico: 'detalle-interno-no-expuesto',
      });
    };
    const res = mockRes();

    // eslint-disable-next-line no-await-in-loop
    await aiController.chatAsistente(pedidoChat(), res);

    assert.equal(res.statusCode, caso.status, `status para ${caso.codigo}`);
    assert.equal(res.body.codigo, caso.codigo);
    assert.equal(typeof res.body.mensaje, 'string');
    assert.equal(typeof res.body.reintentable, 'boolean');
    assert.ok(!JSON.stringify(res.body).includes('detalle-interno-no-expuesto'));
    assert.ok(!JSON.stringify(res.body).includes(caso.mensaje));
  }
});

test('chatAsistente valida el agrupamiento del contexto antes de ejecutar', async () => {
  let llamado = false;
  aiIntencionesService.ejecutarIntencion = async () => {
    llamado = true;
    return { role: 'assistant', content: 'no' };
  };
  const res = mockRes();

  await aiController.chatAsistente(
    pedidoChat({ intencion: 'RESUMEN_EDIFICIO', contexto: { id_agrupamiento: 'no-es-un-id' } }),
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.codigo, CODIGOS_IA.VALIDACION);
  assert.equal(llamado, false);
});
