const test = require('node:test');
const assert = require('node:assert/strict');
const Contrato = require('../../../src/models/contrato');
const reclamoController = require('../../../src/controllers/reclamoController');
const { toolsEsquemas, ejecutarToolSegura } = require('../../../src/services/aiToolsRegistry');

test('el registro declara herramientas para listar contratos y reclamos y para crear reclamos', () => {
  const nombres = toolsEsquemas[0].functionDeclarations.map((tool) => tool.name);
  assert.deepEqual(nombres, [
    'listarMisContratosVigentes',
    'listarMisReclamos',
    'crearNuevoReclamo',
  ]);
  const crear = toolsEsquemas[0].functionDeclarations.find((tool) => tool.name === 'crearNuevoReclamo');
  assert.deepEqual(crear.parameters.required, ['id_contrato', 'asunto', 'descripcion', 'categoria']);
  assert.ok(!Object.hasOwn(crear.parameters.properties, 'propiedadId'));
});

test('listarMisReclamos reutiliza el controlador con la identidad verificada', async () => {
  const original = reclamoController.listarReclamos;
  try {
    reclamoController.listarReclamos = async (req, res) => {
      assert.equal(req.usuario.id, 'usuario-1');
      assert.deepEqual(req.usuario.roles, ['INQUILINO']);
      res.status(200).json({ success: true, data: [{ asunto: 'Consulta' }] });
    };
    const result = await ejecutarToolSegura('listarMisReclamos', {}, {
      id: 'usuario-1',
      roles: ['INQUILINO'],
    });
    assert.deepEqual(result.data, [{ asunto: 'Consulta' }]);
  } finally {
    reclamoController.listarReclamos = original;
  }
});

test('crearNuevoReclamo pasa el contrato y campos compatibles con la API de reclamos', async () => {
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
      res.status(201).json({ success: true, data: { _id: 'reclamo-1' } });
    };
    const result = await ejecutarToolSegura('crearNuevoReclamo', {
      id_contrato: 'contrato-1',
      asunto: 'Pérdida de agua',
      descripcion: 'Pierde agua bajo la pileta.',
      categoria: 'PLOMERIA',
      prioridad: 'ALTA',
    }, { id: 'inquilino-1', roles: ['INQUILINO'] });
    assert.equal(result.data._id, 'reclamo-1');
  } finally {
    reclamoController.crearReclamo = original;
  }
});

test('listarMisContratosVigentes consulta solo contratos vigentes del inquilino autenticado', async () => {
  const original = Contrato.find;
  try {
    Contrato.find = (filter) => {
      assert.deepEqual(filter, { id_inquilino: 'inquilino-1', estado: 'VIGENTE' });
      return {
        select(fields) {
          assert.equal(fields, '_id id_propiedad fecha_inicio fecha_fin');
          return {
            populate: async (field, projection) => {
              assert.equal(field, 'id_propiedad');
              assert.equal(projection, 'direccion');
              return [{
                _id: 'contrato-1',
                id_propiedad: { direccion: 'Calle 123' },
                fecha_inicio: '2026-01-01',
                fecha_fin: '2026-12-31',
              }];
            },
          };
        },
      };
    };
    const result = await ejecutarToolSegura('listarMisContratosVigentes', {}, {
      id: 'inquilino-1',
      roles: ['INQUILINO'],
    });
    assert.deepEqual(result, [{
      id: 'contrato-1',
      propiedad: 'Calle 123',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-12-31',
    }]);
  } finally {
    Contrato.find = original;
  }
});

test('las herramientas fallan explícitamente ante permisos o nombres no autorizados', async () => {
  await assert.rejects(
    ejecutarToolSegura('listarMisContratosVigentes', {}, { id: 'usuario-1', roles: ['USUARIO'] }),
    /solo un inquilino/i,
  );
  await assert.rejects(
    ejecutarToolSegura('borrarTodosLosReclamos', {}, { id: 'usuario-1', roles: ['ADMINISTRADOR'] }),
    /no está autorizada/i,
  );
});
