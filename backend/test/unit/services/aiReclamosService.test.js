const test = require('node:test');
const assert = require('node:assert/strict');
const Contrato = require('../../../src/models/contrato');
const contratoController = require('../../../src/controllers/contratoController');
const reclamoController = require('../../../src/controllers/reclamoController');
const agrupamientoHelpers = require('../../../src/utils/agrupamientoHelpers');
const {
  ACCIONES,
  CATEGORIAS_IA,
  CATEGORIAS_RECLAMO,
  PRIORIDADES_IA,
  PRIORIDADES_RECLAMO,
  clasificarReclamo,
  gestionarReclamos,
} = require('../../../src/services/aiReclamosService');

const USUARIO_INQUILINO = { id: 'inquilino-1', roles: ['INQUILINO'] };

test('el servicio define las acciones y los enums completos de reclamos', () => {
  assert.deepEqual(ACCIONES, ['LISTAR_CONTRATOS', 'LISTAR_RECLAMOS', 'CLASIFICAR', 'CREAR']);
  assert.deepEqual(CATEGORIAS_IA, ['PLOMERIA', 'ELECTRICIDAD', 'ESTRUCTURAL', 'EDIFICIO', 'OTRO']);
  assert.deepEqual(CATEGORIAS_RECLAMO, [
    'PLOMERIA',
    'ELECTRICIDAD',
    'ESTRUCTURAL',
    'EDIFICIO',
    'OTRO',
    'GAS',
    'MANTENIMIENTO',
    'SERVICIOS',
    'SEGURIDAD',
  ]);
  assert.deepEqual(PRIORIDADES_IA, ['BAJA', 'MEDIA', 'ALTA']);
  assert.deepEqual(PRIORIDADES_RECLAMO, ['BAJA', 'MEDIA', 'ALTA', 'URGENTE']);
  assert.equal(CATEGORIAS_RECLAMO.includes('GAS'), true);
  assert.equal(PRIORIDADES_IA.includes('URGENTE'), false);
});

test('clasifica una pérdida de agua como PLOMERIA y prioridad ALTA con primeros auxilios', () => {
  const resultado = clasificarReclamo({
    asunto: 'Pérdida de agua',
    descripcion: 'Pierde agua bajo la pileta de la cocina.',
  });
  assert.equal(resultado.categoria, 'PLOMERIA');
  assert.equal(resultado.prioridad, 'ALTA');
  assert.match(resultado.justificacion, /plomeria/i);
  assert.ok(Array.isArray(resultado.primeros_auxilios));
  assert.ok(resultado.primeros_auxilios.some((auxilio) => /llave/i.test(auxilio)));
});

test('clasifica una pérdida de gas como PLOMERIA ALTA y ofrece primeros auxilios de gas', () => {
  const resultado = clasificarReclamo({
    asunto: 'Olor a gas',
    descripcion: 'Hay olor a gas en la cocina y no puedo cerrar la llave.',
  });
  assert.equal(resultado.categoria, 'PLOMERIA');
  assert.equal(resultado.prioridad, 'ALTA');
  assert.ok(resultado.primeros_auxilios.some((auxilio) => /gas/i.test(auxilio)));
});

test('clasifica un cortocircuito como ELECTRICIDAD ALTA', () => {
  const resultado = clasificarReclamo({
    asunto: 'Cortocircuito',
    descripcion: 'Saltó el disyuntor y hay chispas en el tablero.',
  });
  assert.equal(resultado.categoria, 'ELECTRICIDAD');
  assert.equal(resultado.prioridad, 'ALTA');
});

test('clasifica una grieta como ESTRUCTURAL y una consulta de factura como BAJA', () => {
  const estructural = clasificarReclamo({
    asunto: 'Grieta en la pared',
    descripcion: 'Apareció una grieta en la pared del balcón.',
  });
  assert.equal(estructural.categoria, 'ESTRUCTURAL');
  assert.equal(estructural.prioridad, 'ALTA');

  const consulta = clasificarReclamo({
    asunto: 'Factura de gas',
    descripcion: 'Quiero consultar el importe de la factura de gas.',
  });
  assert.equal(consulta.categoria, 'PLOMERIA');
  assert.equal(consulta.prioridad, 'BAJA');
});

test('clasifica pintura como OTRO y los problemas de edificio como EDIFICIO', () => {
  const pintura = clasificarReclamo({
    asunto: 'Pintura',
    descripcion: 'Quiero pintar el living.',
  });
  assert.equal(pintura.categoria, 'OTRO');
  assert.equal(pintura.prioridad, 'BAJA');

  const edificio = clasificarReclamo({
    asunto: 'Ascensor detenido',
    descripcion: 'El ascensor no anda desde ayer.',
  });
  assert.equal(edificio.categoria, 'EDIFICIO');
  assert.equal(edificio.prioridad, 'ALTA');

  const otro = clasificarReclamo({
    asunto: 'Consulta',
    descripcion: 'Necesito información general.',
  });
  assert.equal(otro.categoria, 'OTRO');
  assert.equal(otro.prioridad, 'BAJA');
});

test('clasificarReclamo exige una descripción', () => {
  assert.throws(() => clasificarReclamo({}), /Describí la incidencia/i);
});

test('LISTAR_CONTRATOS reutiliza el controlador, filtra vigentes y oculta datos del inquilino', async () => {
  const original = contratoController.listarContratos;
  try {
    contratoController.listarContratos = async (req, res) => {
      assert.equal(req.usuario.id, 'inquilino-1');
      res.json([
        {
          _id: 'contrato-1',
          estado: 'VIGENTE',
          id_propiedad: { direccion: 'Calle 123' },
          id_inquilino: { email: 'privado@ejemplo.com', dni: '12345678' },
          fecha_inicio: '2026-01-01',
          fecha_fin: '2026-12-31',
          monto_mensual: 50000,
          dia_vencimiento: 5,
        },
        {
          _id: 'contrato-2',
          estado: 'FINALIZADO',
          id_propiedad: { direccion: 'Calle 456' },
        },
      ]);
    };

    const resultado = await gestionarReclamos(USUARIO_INQUILINO, { accion: 'LISTAR_CONTRATOS' });

    assert.deepEqual(resultado, [{
      id: 'contrato-1',
      propiedad: 'Calle 123',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-12-31',
      monto_mensual: 50000,
      dia_vencimiento: 5,
    }]);
    assert.equal(JSON.stringify(resultado).includes('privado@ejemplo.com'), false);
    assert.equal(JSON.stringify(resultado).includes('12345678'), false);
  } finally {
    contratoController.listarContratos = original;
  }
});

test('LISTAR_CONTRATOS rechaza a usuarios que no son inquilinos', async () => {
  await assert.rejects(
    gestionarReclamos({ id: 'propietario-1', roles: ['PROPIETARIO'] }, { accion: 'LISTAR_CONTRATOS' }),
    /solo un inquilino/i,
  );
});

test('LISTAR_RECLAMOS reutiliza el controlador con la identidad del token', async () => {
  const original = reclamoController.listarReclamos;
  try {
    reclamoController.listarReclamos = async (req, res) => {
      assert.equal(req.usuario.id, 'inquilino-1');
      assert.deepEqual(req.usuario.roles, ['INQUILINO']);
      res.status(200).json({
        success: true,
        data: [{
          _id: 'reclamo-1',
          id_contrato: { _id: 'contrato-1' },
          id_propiedad: { direccion: 'Calle 123' },
          id_inquilino: 'dato-privado',
          asunto: 'Pérdida de agua',
          descripcion: 'Pierde agua bajo la pileta.',
          categoria: 'PLOMERIA',
          prioridad: 'ALTA',
          estado: 'PENDIENTE',
          fecha_creacion: '2026-10-21T00:00:00.000Z',
        }],
      });
    };

    const resultado = await gestionarReclamos(USUARIO_INQUILINO, { accion: 'LISTAR_RECLAMOS' });

    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].id, 'reclamo-1');
    assert.equal(resultado[0].propiedad, 'Calle 123');
    assert.equal(resultado[0].categoria, 'PLOMERIA');
    assert.equal(JSON.stringify(resultado).includes('dato-privado'), false);
  } finally {
    reclamoController.listarReclamos = original;
  }
});

test('CLASIFICAR no consulta datos y devuelve una propuesta', async () => {
  const resultado = await gestionarReclamos(USUARIO_INQUILINO, {
    accion: 'CLASIFICAR',
    asunto: 'No anda el ascensor',
    descripcion: 'El ascensor está detenido desde ayer.',
  });
  assert.equal(resultado.categoria, 'EDIFICIO');
  assert.equal(resultado.prioridad, 'ALTA');
  assert.ok(resultado.primeros_auxilios.length > 0);
});

test('CREAR usa la clasificación del servidor cuando no llega categoría ni prioridad', async () => {
  const original = reclamoController.crearReclamo;
  try {
    reclamoController.crearReclamo = async (req, res) => {
      assert.equal(req.usuario.id, 'inquilino-1');
      assert.deepEqual(req.body, {
        id_contrato: 'contrato-1',
        asunto: 'Pérdida de agua',
        descripcion: 'Pierde agua bajo la pileta.',
        categoria: 'PLOMERIA',
        prioridad: 'ALTA',
      });
      res.status(201).json({
        success: true,
        data: {
          _id: 'reclamo-1',
          id_contrato: 'contrato-1',
          id_propiedad: { direccion: 'Calle 123' },
          asunto: 'Pérdida de agua',
          descripcion: 'Pierde agua bajo la pileta.',
          categoria: 'PLOMERIA',
          prioridad: 'ALTA',
          estado: 'PENDIENTE',
          fecha_creacion: '2026-10-21T00:00:00.000Z',
        },
        message: 'Reclamo registrado.',
      });
    };

    const resultado = await gestionarReclamos(USUARIO_INQUILINO, {
      accion: 'CREAR',
      id_contrato: 'contrato-1',
      asunto: 'Pérdida de agua',
      descripcion: 'Pierde agua bajo la pileta.',
    });

    assert.equal(resultado.creado, true);
    assert.equal(resultado.reclamo.id, 'reclamo-1');
    assert.equal(resultado.mensaje, 'Reclamo registrado.');
    assert.ok(Array.isArray(resultado.primeros_auxilios));
    assert.ok(resultado.primeros_auxilios.length > 0);
  } finally {
    reclamoController.crearReclamo = original;
  }
});

test('CREAR valida que el contrato pertenezca al agrupamiento indicado', async () => {
  const originalCrear = reclamoController.crearReclamo;
  const originalResolver = agrupamientoHelpers.resolverAlcanceAgrupamiento;
  const originalExists = Contrato.exists;
  const idAgrupamiento = '507f1f77bcf86cd799439011';
  try {
    agrupamientoHelpers.resolverAlcanceAgrupamiento = async () => ({
      agrupamiento: { _id: idAgrupamiento },
      propiedades: [{ _id: 'propiedad-1' }],
      error: null,
    });
    Contrato.exists = async (filtro) => {
      assert.deepEqual(filtro, {
        _id: 'contrato-1',
        id_propiedad: { $in: ['propiedad-1'] },
      });
      return null;
    };
    reclamoController.crearReclamo = async () => {
      throw new Error('No debería llamarse al controlador con un contrato ajeno.');
    };

    await assert.rejects(
      gestionarReclamos(USUARIO_INQUILINO, {
        accion: 'CREAR',
        id_contrato: 'contrato-1',
        asunto: 'Reclamo',
        descripcion: 'Descripción',
        id_agrupamiento: idAgrupamiento,
      }),
      /no pertenece al agrupamiento/i,
    );
  } finally {
    reclamoController.crearReclamo = originalCrear;
    agrupamientoHelpers.resolverAlcanceAgrupamiento = originalResolver;
    Contrato.exists = originalExists;
  }
});

test('CREAR propaga el error del controlador y no confirma la creación', async () => {
  const original = reclamoController.crearReclamo;
  try {
    reclamoController.crearReclamo = async (_req, res) => {
      res.status(403).json({
        success: false,
        data: null,
        message: 'Solo el inquilino del contrato puede crear un reclamo.',
      });
    };

    await assert.rejects(
      gestionarReclamos(USUARIO_INQUILINO, {
        accion: 'CREAR',
        id_contrato: 'contrato-ajeno',
        asunto: 'Reclamo',
        descripcion: 'Intento sobre un contrato ajeno.',
      }),
      /Solo el inquilino del contrato/i,
    );
  } finally {
    reclamoController.crearReclamo = original;
  }
});

test('CREAR rechaza roles y campos no autorizados antes de llamar al controlador', async () => {
  const original = reclamoController.crearReclamo;
  let llamado = false;
  try {
    reclamoController.crearReclamo = async () => {
      llamado = true;
    };

    await assert.rejects(
      gestionarReclamos({ id: 'usuario-1', roles: ['USUARIO'] }, {
        accion: 'CREAR',
        id_contrato: 'contrato-1',
        asunto: 'Reclamo',
        descripcion: 'Descripción',
      }),
      /solo un inquilino/i,
    );

    await assert.rejects(
      gestionarReclamos(USUARIO_INQUILINO, {
        accion: 'CREAR',
        id_contrato: 'contrato-1',
        asunto: 'Reclamo',
        descripcion: 'Descripción',
        id_inquilino: 'otro-usuario',
      }),
      /campos no autorizados/i,
    );

    assert.equal(llamado, false);
  } finally {
    reclamoController.crearReclamo = original;
  }
});

test('gestionarReclamos exige sesión y una acción válida', async () => {
  await assert.rejects(
    gestionarReclamos({}, { accion: 'LISTAR_RECLAMOS' }),
    /sesión autenticada/i,
  );
  await assert.rejects(
    gestionarReclamos(USUARIO_INQUILINO, { accion: 'BORRAR_TODO' }),
    /acción de reclamos no es válida/i,
  );
});
