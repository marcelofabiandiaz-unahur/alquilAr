const test = require('node:test');
const assert = require('node:assert/strict');
const Agrupamiento = require('../src/models/agrupamiento');
const Contrato = require('../src/models/contrato');
const Propiedad = require('../src/models/propiedad');
const pagoController = require('../src/controllers/pagoController');
const reclamoController = require('../src/controllers/reclamoController');
const aiController = require('../src/controllers/aiController');
const aiService = require('../src/services/aiService');
const aiReclamosService = require('../src/services/aiReclamosService');
const { extraerDatosComprobante } = require('../src/services/aiFinanzasService');
const { ejecutarToolSegura } = require('../src/services/aiToolsRegistry');

const USUARIO_INQUILINO = { id: 'inquilino-1', roles: ['INQUILINO'] };
const USUARIO_OTRO_INQUILINO = { id: 'inquilino-2', roles: ['INQUILINO'] };

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

test('prompt injection: la herramienta rechaza identidad y roles inyectados', async () => {
  await assert.rejects(
    ejecutarToolSegura('consultarResumenAgrupamiento', {
      id_usuario: USUARIO_OTRO_INQUILINO.id,
      roles: ['ADMINISTRADOR'],
    }, USUARIO_INQUILINO),
    /campos no autorizados/i,
  );

  await assert.rejects(
    ejecutarToolSegura('gestionarReclamos', {
      accion: 'LISTAR_RECLAMOS',
      id_inquilino: USUARIO_OTRO_INQUILINO.id,
    }, USUARIO_INQUILINO),
    /campos no autorizados/i,
  );
});

test('la identidad se toma del token y no de los argumentos del LLM', async () => {
  const original = pagoController.listarPagos;
  try {
    pagoController.listarPagos = async (req, res) => {
      assert.equal(req.usuario.id, USUARIO_INQUILINO.id);
      assert.deepEqual(req.query, {});
      res.status(200).json({ success: true, data: [] });
    };

    await ejecutarToolSegura('consultarDatosAlquiler', {
      alcance: 'PAGOS',
    }, USUARIO_INQUILINO);
  } finally {
    pagoController.listarPagos = original;
  }
});

test('aislamiento multi-tenant: un agrupamiento ajeno responde 403 y no filtra datos', async () => {
  const originalFindById = Agrupamiento.findById;
  const originalPropiedadFind = Propiedad.find;
  const originalContratoFind = Contrato.find;
  const originalContratoExists = Contrato.exists;
  const idAgrupamientoAjeno = '507f1f77bcf86cd799439011';
  try {
    Agrupamiento.findById = async () => ({
      _id: idAgrupamientoAjeno,
      nombre: 'Edificio ajeno',
      id_administrador: 'admin-1',
      gestores: [],
    });
    Propiedad.find = () => ({
      select: async () => [{ _id: 'propiedad-ajena' }],
    });
    Contrato.find = () => [];
    Contrato.exists = async () => false;

    await assert.rejects(
      ejecutarToolSegura('consultarResumenAgrupamiento', {
        id_agrupamiento: idAgrupamientoAjeno,
      }, USUARIO_INQUILINO),
      /permiso para consultar este agrupamiento/i,
    );
  } finally {
    Agrupamiento.findById = originalFindById;
    Propiedad.find = originalPropiedadFind;
    Contrato.find = originalContratoFind;
    Contrato.exists = originalContratoExists;
  }
});

test('un error 500 del backend no se reporta como creación exitosa', async () => {
  const original = reclamoController.crearReclamo;
  try {
    reclamoController.crearReclamo = async (_req, res) => {
      res.status(500).json({
        success: false,
        data: null,
        message: 'No se pudo registrar el reclamo.',
      });
    };

    await assert.rejects(
      ejecutarToolSegura('gestionarReclamos', {
        accion: 'CREAR',
        id_contrato: 'contrato-1',
        asunto: 'Pérdida de agua',
        descripcion: 'Pierde agua bajo la pileta.',
      }, USUARIO_INQUILINO),
      (error) => {
        assert.match(error.message, /No se pudo registrar el reclamo/i);
        assert.equal(Object.hasOwn(error, 'creado'), false);
        return true;
      },
    );
  } finally {
    reclamoController.crearReclamo = original;
  }
});

test('extrae monto y fecha del texto del comprobante', () => {
  const resultado = extraerDatosComprobante(
    'Comprobante de pago. Total: ARS 1.234,56. Fecha: 05/10/2026. Gracias.',
  );
  assert.equal(resultado.extraido, true);
  assert.equal(resultado.monto, 1234.56);
  assert.equal(resultado.moneda, 'ARS');
  assert.equal(resultado.fecha, '2026-10-05');
  assert.equal(resultado.confianza, 0.95);
  assert.equal(resultado.advertencia, null);

  const incompleto = extraerDatosComprobante('Pago recibido sin más datos.');
  assert.equal(incompleto.extraido, false);
  assert.equal(incompleto.monto, null);
  assert.equal(incompleto.fecha, null);
  assert.match(incompleto.advertencia, /Verificá/i);
});

test('el historial se trunca a 10 mensajes antes de llamar al modelo', async () => {
  const originalProcesarChat = aiService.procesarChat;
  try {
    aiService.procesarChat = async (historial) => {
      const mensajes = historial.filter((mensaje) => mensaje.role !== 'system');
      assert.equal(mensajes.length, 10);
      assert.equal(mensajes[0].role, 'user');
      assert.equal(mensajes[mensajes.length - 1].role, 'user');
      return { role: 'assistant', content: 'ok' };
    };
    const res = mockRes();

    await aiController.chatAsistente({
      body: {
        mensajes: Array.from({ length: 25 }, (_, indice) => ({
          role: 'user',
          content: `mensaje-${indice + 1}`,
        })),
      },
      usuario: USUARIO_INQUILINO,
    }, res);

    assert.equal(res.statusCode, 200);
  } finally {
    aiService.procesarChat = originalProcesarChat;
  }
});

test('un pedido fuera de dominio responde sin ejecutar herramientas', async () => {
  let herramientaEjecutada = false;
  const respuesta = await aiService.procesarChat(
    [
      { role: 'system', content: 'Sos el asistente de AlquilAR.' },
      { role: 'user', content: '¿Quién ganó el mundial de fútbol?' },
    ],
    USUARIO_INQUILINO,
    {
      generateContent: async () => ({
        text: 'Solo puedo ayudarte con consultas de alquileres, reclamos y finanzas.',
        functionCalls: [],
      }),
      executeTool: async () => {
        herramientaEjecutada = true;
        throw new Error('No se debe ejecutar ninguna herramienta para pedidos fuera de dominio.');
      },
    },
  );

  assert.match(respuesta.content, /alquileres, reclamos y finanzas/i);
  assert.equal(herramientaEjecutada, false);
});

test('CLASIFICAR propone categoría, prioridad y primeros auxilios sin persistir', async () => {
  const original = reclamoController.crearReclamo;
  let crearLlamado = false;
  try {
    reclamoController.crearReclamo = async () => {
      crearLlamado = true;
    };
    const propuesta = await aiReclamosService.gestionarReclamos(USUARIO_INQUILINO, {
      accion: 'CLASIFICAR',
      asunto: 'Chispas en el tablero',
      descripcion: 'Hay chispas y olor a quemado en el tablero eléctrico.',
    });
    assert.equal(propuesta.categoria, 'ELECTRICIDAD');
    assert.equal(propuesta.prioridad, 'ALTA');
    assert.ok(propuesta.primeros_auxilios.length > 0);
    assert.equal(crearLlamado, false);
  } finally {
    reclamoController.crearReclamo = original;
  }
});
