const test = require('node:test');
const assert = require('node:assert/strict');
const Contrato = require('../../../src/models/contrato');
const Propiedad = require('../../../src/models/propiedad');
const reclamoController = require('../../../src/controllers/reclamoController');
const pagoController = require('../../../src/controllers/pagoController');
const { toolsEsquemas, ejecutarToolSegura } = require('../../../src/services/aiToolsRegistry');

test('el registro publica exactamente dos herramientas para datos y gestión de reclamos', () => {
  const nombres = toolsEsquemas[0].functionDeclarations.map((tool) => tool.name);
  assert.deepEqual(nombres, [
    'consultarDatosAlquiler',
    'gestionarReclamos',
  ]);
  const consulta = toolsEsquemas[0].functionDeclarations.find((tool) => tool.name === 'consultarDatosAlquiler');
  assert.ok(consulta.parameters.properties.alcance);
  assert.ok(!Object.hasOwn(consulta.parameters.properties, 'id_usuario'));
  assert.ok(!Object.hasOwn(consulta.parameters.properties, 'id_inquilino'));
  const reclamos = toolsEsquemas[0].functionDeclarations.find((tool) => tool.name === 'gestionarReclamos');
  assert.deepEqual(reclamos.parameters.required, ['accion']);
  assert.deepEqual(reclamos.parameters.properties.accion.enum, ['LISTAR', 'CONTRATOS_VIGENTES', 'CREAR']);
  assert.ok(!Object.hasOwn(reclamos.parameters.properties, 'id_usuario'));
});

test('consultarDatosAlquiler reutiliza listarPagos con identidad del token y sin query del LLM', async () => {
  const originalPagos = pagoController.listarPagos;
  const originalContratos = Contrato.find;
  try {
    pagoController.listarPagos = async (req, res) => {
      assert.equal(req.usuario.id, 'inquilino-1');
      assert.deepEqual(req.query, {});
      res.status(200).json({
        success: true,
        data: [{
          _id: 'pago-1',
          id_contrato: 'contrato-1',
          mes_correspondiente: '202610',
          monto_total: 1000,
          estado: 'PENDIENTE',
          fecha_vencimiento: '2026-10-10',
          tipo: 'MENSUAL',
        }],
      });
    };
    Contrato.find = (filter) => {
      assert.deepEqual(filter, { id_inquilino: 'inquilino-1' });
      return {
        populate() { return this; },
        select() { return this; },
        sort: async () => [],
      };
    };
    const result = await ejecutarToolSegura('consultarDatosAlquiler', {
      alcance: 'PAGOS',
      id_usuario: 'otro-usuario',
    }, { id: 'inquilino-1', roles: ['INQUILINO'] });
    assert.ok(!Object.hasOwn(result, 'contratos'));
    assert.equal(result.pagos.length, 1);
    assert.equal(result.pagos[0].id, 'pago-1');
  } finally {
    pagoController.listarPagos = originalPagos;
    Contrato.find = originalContratos;
  }
});

test('consultarDatosAlquiler filtra contratos del propietario autenticado', async () => {
  const originalPropiedad = Propiedad.find;
  const originalContratos = Contrato.find;
  const originalPagos = pagoController.listarPagos;
  try {
    Propiedad.find = (filter) => {
      assert.deepEqual(filter, { id_propietario: 'prop-1' });
      return {
        select: async () => [{ _id: 'propiedad-a' }],
      };
    };
    Contrato.find = (filter) => {
      assert.deepEqual(filter, { id_propiedad: { $in: ['propiedad-a'] } });
      const chain = {
        populate() { return chain; },
        select() { return chain; },
        sort: async () => [{
          _id: 'contrato-prop',
          estado: 'VIGENTE',
          id_propiedad: { direccion: 'Av. Siempre Viva 742' },
          fecha_inicio: '2026-01-01',
          fecha_fin: '2026-12-31',
          monto_mensual: 50000,
          dia_vencimiento: 5,
        }],
      };
      return chain;
    };
    pagoController.listarPagos = async (req, res) => {
      res.status(200).json({ success: true, data: [] });
    };
    const result = await ejecutarToolSegura('consultarDatosAlquiler', {
      alcance: 'CONTRATOS',
      id_inquilino: 'otro',
    }, { id: 'prop-1', roles: ['PROPIETARIO'] });
    assert.ok(!Object.hasOwn(result, 'pagos'));
    assert.equal(result.contratos[0].propiedad, 'Av. Siempre Viva 742');
  } finally {
    Propiedad.find = originalPropiedad;
    Contrato.find = originalContratos;
    pagoController.listarPagos = originalPagos;
  }
});

test('consultarDatosAlquiler rechaza usuarios sin permiso operativo', async () => {
  await assert.rejects(
    ejecutarToolSegura('consultarDatosAlquiler', {}, { id: 'usuario-1', roles: ['USUARIO'] }),
    /permiso para consultar contratos/i,
  );
});

test('gestionarReclamos lista con la identidad verificada', async () => {
  const original = reclamoController.listarReclamos;
  try {
    reclamoController.listarReclamos = async (req, res) => {
      assert.equal(req.usuario.id, 'usuario-1');
      assert.deepEqual(req.usuario.roles, ['INQUILINO']);
      res.status(200).json({ success: true, data: [{ asunto: 'Consulta' }] });
    };
    const result = await ejecutarToolSegura('gestionarReclamos', { accion: 'LISTAR' }, {
      id: 'usuario-1',
      roles: ['INQUILINO'],
    });
    assert.deepEqual(result.data, [{ asunto: 'Consulta' }]);
  } finally {
    reclamoController.listarReclamos = original;
  }
});

test('gestionarReclamos crea un reclamo con los campos compatibles con la API', async () => {
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
    const result = await ejecutarToolSegura('gestionarReclamos', {
      accion: 'CREAR',
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

test('gestionarReclamos consulta solo contratos vigentes del inquilino autenticado', async () => {
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
    const result = await ejecutarToolSegura('gestionarReclamos', { accion: 'CONTRATOS_VIGENTES' }, {
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

test('las herramientas fallan explícitamente ante permisos o nombres/acciones no autorizados', async () => {
  await assert.rejects(
    ejecutarToolSegura('gestionarReclamos', { accion: 'CONTRATOS_VIGENTES' }, { id: 'usuario-1', roles: ['USUARIO'] }),
    /solo un inquilino/i,
  );
  await assert.rejects(
    ejecutarToolSegura('borrarTodosLosReclamos', {}, { id: 'usuario-1', roles: ['ADMINISTRADOR'] }),
    /no está autorizada/i,
  );
  await assert.rejects(
    ejecutarToolSegura('gestionarReclamos', { accion: 'ELIMINAR_TODO' }, { id: 'usuario-1', roles: ['ADMINISTRADOR'] }),
    /acción.*no está autorizada/i,
  );
});
