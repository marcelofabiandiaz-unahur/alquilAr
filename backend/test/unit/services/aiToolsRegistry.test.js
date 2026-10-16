const test = require('node:test');
const assert = require('node:assert/strict');
const contratoController = require('../../../src/controllers/contratoController');
const reclamoController = require('../../../src/controllers/reclamoController');
const { toolsEsquemas, ejecutarToolSegura } = require('../../../src/services/aiToolsRegistry');

test('el modelo recibe exactamente las dos herramientas definidas por el MVP', () => {
  const declaraciones = toolsEsquemas.flatMap((grupo) => grupo.functionDeclarations);
  assert.deepEqual(declaraciones.map((tool) => tool.name), [
    'consultarMisDatos',
    'clasificarYCrearReclamo',
  ]);
  const crear = declaraciones.find((tool) => tool.name === 'clasificarYCrearReclamo');
  assert.deepEqual(crear.parameters.required, ['id_contrato', 'asunto', 'descripcion', 'categoria']);
  assert.ok(crear.parameters.properties.categoria.enum.includes('SERVICIOS'));
  assert.ok(!Object.hasOwn(crear.parameters.properties, 'usuarioId'));
});

test('consultarMisDatos reutiliza los controladores y filtra los datos sensibles', async () => {
  const original = contratoController.listarContratos;
  try {
    contratoController.listarContratos = async (req, res) => {
      assert.equal(req.usuario.id, 'propietario-1');
      assert.deepEqual(req.usuario.roles, ['PROPIETARIO']);
      res.json([{
        _id: 'contrato-1',
        estado: 'VIGENTE',
        id_propiedad: { direccion: 'Calle 123' },
        id_inquilino: { nombre: 'Nombre privado', dni: '12345678' },
        monto_mensual: 200000,
      }]);
    };
    const result = await ejecutarToolSegura('consultarMisDatos', { tipo: 'CONTRATOS' }, {
      id: 'propietario-1',
      roles: ['PROPIETARIO'],
    });
    assert.deepEqual(result, [{
      id: 'contrato-1',
      estado: 'VIGENTE',
      propiedad: 'Calle 123',
      fecha_inicio: undefined,
      fecha_fin: undefined,
      monto_mensual: 200000,
    }]);
    assert.equal(JSON.stringify(result).includes('12345678'), false);
  } finally {
    contratoController.listarContratos = original;
  }
});

test('consultarMisDatos devuelve los reclamos autorizados del usuario', async () => {
  const original = reclamoController.listarReclamos;
  try {
    reclamoController.listarReclamos = async (req, res) => {
      assert.equal(req.usuario.id, 'inquilino-1');
      res.status(200).json({
        success: true,
        data: [{ _id: 'reclamo-1', asunto: 'Pérdida', id_inquilino: 'dato-privado' }],
      });
    };
    const result = await ejecutarToolSegura('consultarMisDatos', { tipo: 'RECLAMOS' }, {
      id: 'inquilino-1',
      roles: ['INQUILINO'],
    });
    assert.deepEqual(result, [{
      id: 'reclamo-1',
      asunto: 'Pérdida',
      descripcion: undefined,
      categoria: undefined,
      prioridad: undefined,
      estado: undefined,
      fecha_creacion: undefined,
    }]);
    assert.equal(JSON.stringify(result).includes('dato-privado'), false);
  } finally {
    reclamoController.listarReclamos = original;
  }
});

test('clasificarYCrearReclamo pasa la clasificación al controlador y usa la identidad autenticada', async () => {
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
        data: { _id: 'reclamo-1', asunto: 'Pérdida de agua', categoria: 'PLOMERIA', estado: 'PENDIENTE' },
        message: 'Reclamo registrado.',
      });
    };
    const result = await ejecutarToolSegura('clasificarYCrearReclamo', {
      id_contrato: 'contrato-1',
      asunto: 'Pérdida de agua',
      descripcion: 'Pierde agua bajo la pileta.',
      categoria: 'PLOMERIA',
      prioridad: 'ALTA',
    }, { id: 'inquilino-1', roles: ['INQUILINO'] });
    assert.equal(result.success, true);
    assert.equal(result.data.id, 'reclamo-1');
    assert.equal(result.message, 'Reclamo registrado.');
  } finally {
    reclamoController.crearReclamo = original;
  }
});

test('rechaza tipos de consulta, roles y argumentos no permitidos', async () => {
  await assert.rejects(
    ejecutarToolSegura('consultarMisDatos', { tipo: 'USUARIOS' }, {
      id: 'usuario-1',
      roles: ['USUARIO'],
    }),
    /requiere una cuenta autenticada/i,
  );
  await assert.rejects(
    ejecutarToolSegura('consultarMisDatos', { tipo: 'PAGOS' }, {
      id: 'inquilino-1',
      roles: ['INQUILINO'],
    }),
    /tipo de consulta no está autorizado/i,
  );
  await assert.rejects(
    ejecutarToolSegura('clasificarYCrearReclamo', {}, { id: 'usuario-1', roles: ['USUARIO'] }),
    /solo un inquilino/i,
  );
  await assert.rejects(
    ejecutarToolSegura('clasificarYCrearReclamo', { usuarioId: 'ajeno' }, {
      id: 'inquilino-1',
      roles: ['INQUILINO'],
    }),
    /campos no autorizados/i,
  );
  await assert.rejects(
    ejecutarToolSegura('borrarTodosLosReclamos', {}, {
      id: 'usuario-1',
      roles: ['ADMINISTRADOR'],
    }),
    /no está autorizada/i,
  );
});
