const test = require('node:test');
const assert = require('node:assert/strict');
<<<<<<< HEAD
const contratoController = require('../../../src/controllers/contratoController');
=======
const Contrato = require('../../../src/models/contrato');
const Propiedad = require('../../../src/models/propiedad');
>>>>>>> 8284b23b38864f8821ddb08932ca7993b9abcfe7
const reclamoController = require('../../../src/controllers/reclamoController');
const pagoController = require('../../../src/controllers/pagoController');
const { toolsEsquemas, ejecutarToolSegura } = require('../../../src/services/aiToolsRegistry');

<<<<<<< HEAD
test('el modelo recibe exactamente las dos herramientas definidas por el MVP', () => {
  const declaraciones = toolsEsquemas.flatMap((grupo) => grupo.functionDeclarations);
  assert.deepEqual(declaraciones.map((tool) => tool.name), [
    'consultarMisDatos',
    'clasificarYCrearReclamo',
  ]);
  const crear = declaraciones.find((tool) => tool.name === 'clasificarYCrearReclamo');
=======
test('el registro declara consulta de datos, contratos, reclamos y creación de reclamos', () => {
  const nombres = toolsEsquemas[0].functionDeclarations.map((tool) => tool.name);
  assert.deepEqual(nombres, [
    'consultarDatosAlquiler',
    'listarMisContratosVigentes',
    'listarMisReclamos',
    'crearNuevoReclamo',
  ]);
  const consulta = toolsEsquemas[0].functionDeclarations.find((tool) => tool.name === 'consultarDatosAlquiler');
  assert.ok(consulta.parameters.properties.alcance);
  assert.ok(!Object.hasOwn(consulta.parameters.properties, 'id_usuario'));
  assert.ok(!Object.hasOwn(consulta.parameters.properties, 'id_inquilino'));
  const crear = toolsEsquemas[0].functionDeclarations.find((tool) => tool.name === 'crearNuevoReclamo');
>>>>>>> 8284b23b38864f8821ddb08932ca7993b9abcfe7
  assert.deepEqual(crear.parameters.required, ['id_contrato', 'asunto', 'descripcion', 'categoria']);
  assert.ok(crear.parameters.properties.categoria.enum.includes('SERVICIOS'));
  assert.ok(!Object.hasOwn(crear.parameters.properties, 'usuarioId'));
});

<<<<<<< HEAD
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
=======
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

test('listarMisReclamos reutiliza el controlador con la identidad verificada', async () => {
>>>>>>> 8284b23b38864f8821ddb08932ca7993b9abcfe7
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
