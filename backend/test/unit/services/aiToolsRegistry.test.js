const test = require('node:test');
const assert = require('node:assert/strict');
const Contrato = require('../../../src/models/contrato');
const Propiedad = require('../../../src/models/propiedad');
const pagoController = require('../../../src/controllers/pagoController');
const aiReclamosService = require('../../../src/services/aiReclamosService');
const { toolsEsquemas, ejecutarToolSegura } = require('../../../src/services/aiToolsRegistry');

test('el registro expone exactamente las dos herramientas del MVP', () => {
  const declaraciones = toolsEsquemas.flatMap((grupo) => grupo.functionDeclarations);
  assert.deepEqual(declaraciones.map((tool) => tool.name), [
    'consultarDatosAlquiler',
    'gestionarReclamos',
  ]);

  const consulta = declaraciones.find((tool) => tool.name === 'consultarDatosAlquiler');
  assert.ok(consulta.parameters.properties.alcance);
  assert.ok(!Object.hasOwn(consulta.parameters.properties, 'id_usuario'));
  assert.ok(!Object.hasOwn(consulta.parameters.properties, 'id_inquilino'));

  const reclamos = declaraciones.find((tool) => tool.name === 'gestionarReclamos');
  assert.deepEqual(reclamos.parameters.required, ['accion']);
  assert.deepEqual(reclamos.parameters.properties.accion.enum, [
    'LISTAR_CONTRATOS',
    'LISTAR_RECLAMOS',
    'CLASIFICAR',
    'CREAR',
  ]);
  assert.ok(reclamos.parameters.properties.categoria.enum.includes('PLOMERIA'));
  assert.ok(reclamos.parameters.properties.categoria.enum.includes('SERVICIOS'));
  assert.ok(reclamos.parameters.properties.categoria.enum.includes('SEGURIDAD'));
  assert.ok(!Object.hasOwn(reclamos.parameters.properties, 'usuarioId'));
  assert.ok(!Object.hasOwn(reclamos.parameters.properties, 'id_inquilino'));
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

test('gestionarReclamos delega en el servicio con identidad y argumentos', async () => {
  const original = aiReclamosService.gestionarReclamos;
  try {
    aiReclamosService.gestionarReclamos = async (usuario, args) => {
      assert.deepEqual(usuario, { id: 'inquilino-1', roles: ['INQUILINO'] });
      assert.deepEqual(args, { accion: 'LISTAR_RECLAMOS' });
      return [{ id: 'reclamo-1' }];
    };
    const resultado = await ejecutarToolSegura('gestionarReclamos', {
      accion: 'LISTAR_RECLAMOS',
    }, { id: 'inquilino-1', roles: ['INQUILINO'] });
    assert.deepEqual(resultado, [{ id: 'reclamo-1' }]);
  } finally {
    aiReclamosService.gestionarReclamos = original;
  }
});

test('las herramientas exigen sesión y fallan ante nombres no autorizados', async () => {
  await assert.rejects(
    ejecutarToolSegura('gestionarReclamos', { accion: 'LISTAR_RECLAMOS' }, {}),
    /sesión autenticada/i,
  );
  await assert.rejects(
    ejecutarToolSegura('borrarTodosLosReclamos', {}, { id: 'usuario-1', roles: ['ADMINISTRADOR'] }),
    /no está autorizada/i,
  );
});
