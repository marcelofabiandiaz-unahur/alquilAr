const test = require('node:test');
const assert = require('node:assert/strict');
const Contrato = require('../../../src/models/contrato');
const Propiedad = require('../../../src/models/propiedad');
const pagoController = require('../../../src/controllers/pagoController');
const aiReclamosService = require('../../../src/services/aiReclamosService');
const aiFinanzasService = require('../../../src/services/aiFinanzasService');
const aiAgrupamientoService = require('../../../src/services/aiAgrupamientoService');
const { toolsEsquemas, ejecutarToolSegura } = require('../../../src/services/aiToolsRegistry');
const { CODIGOS_IA } = require('../../../src/utils/aiErrors');

const USUARIO_INQUILINO = { id: 'inquilino-1', roles: ['INQUILINO'] };
const USUARIO_SIN_ROL_OPERATIVO = { id: 'usuario-1', roles: ['USUARIO'] };

test('el registro expone exactamente las cuatro herramientas del asistente', () => {
  const declaraciones = toolsEsquemas.flatMap((grupo) => grupo.functionDeclarations);
  assert.deepEqual(declaraciones.map((tool) => tool.name), [
    'consultarDatosAlquiler',
    'gestionarReclamos',
    'consultarFinanzas',
    'consultarResumenAgrupamiento',
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
  assert.deepEqual(
    reclamos.parameters.properties.categoria.enum,
    aiReclamosService.CATEGORIAS_IA,
  );
  assert.deepEqual(
    reclamos.parameters.properties.prioridad.enum,
    aiReclamosService.PRIORIDADES_IA,
  );
  assert.deepEqual(reclamos.parameters.properties.categoria.enum, [
    'PLOMERIA',
    'ELECTRICIDAD',
    'ESTRUCTURAL',
    'EDIFICIO',
    'OTRO',
  ]);
  assert.deepEqual(reclamos.parameters.properties.prioridad.enum, ['BAJA', 'MEDIA', 'ALTA']);
  assert.ok(!Object.hasOwn(reclamos.parameters.properties, 'usuarioId'));
  assert.ok(!Object.hasOwn(reclamos.parameters.properties, 'id_inquilino'));

  const finanzas = declaraciones.find((tool) => tool.name === 'consultarFinanzas');
  assert.deepEqual(finanzas.parameters.properties.accion.enum, [
    'SALDOS',
    'ANALIZAR_COMPROBANTE',
    'RECORDATORIO_MORA',
  ]);
  assert.ok(finanzas.parameters.properties.texto);
  assert.ok(!Object.hasOwn(finanzas.parameters.properties, 'id_usuario'));

  const resumen = declaraciones.find((tool) => tool.name === 'consultarResumenAgrupamiento');
  assert.ok(resumen.parameters.properties.id_agrupamiento);
  assert.ok(resumen.parameters.properties.periodo);
  assert.ok(!Object.hasOwn(resumen.parameters.properties, 'id_propietario'));
});

test('consultarDatosAlquiler reutiliza listarPagos con identidad del token y sin query del LLM', async () => {
  const originalPagos = pagoController.listarPagos;
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
    const result = await ejecutarToolSegura('consultarDatosAlquiler', {
      alcance: 'PAGOS',
    }, USUARIO_INQUILINO);
    assert.ok(!Object.hasOwn(result, 'contratos'));
    assert.equal(result.pagos.length, 1);
    assert.equal(result.pagos[0].id, 'pago-1');
  } finally {
    pagoController.listarPagos = originalPagos;
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
    pagoController.listarPagos = async (_req, res) => {
      res.status(200).json({ success: true, data: [] });
    };
    const result = await ejecutarToolSegura('consultarDatosAlquiler', {
      alcance: 'CONTRATOS',
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

test('finanzas y resumen clasifican la falta de rol como SIN_PERMISO', async () => {
  await assert.rejects(
    ejecutarToolSegura('consultarFinanzas', { accion: 'SALDOS' }, USUARIO_SIN_ROL_OPERATIVO),
    (error) => error.codigo === CODIGOS_IA.SIN_PERMISO && error.status === 403,
  );

  await assert.rejects(
    ejecutarToolSegura('consultarResumenAgrupamiento', {}, USUARIO_SIN_ROL_OPERATIVO),
    (error) => error.codigo === CODIGOS_IA.SIN_PERMISO && error.status === 403,
  );
});

test('las herramientas rechazan campos de identidad inyectados por el LLM', async () => {
  await assert.rejects(
    ejecutarToolSegura('consultarDatosAlquiler', {
      alcance: 'PAGOS',
      id_usuario: 'otro-usuario',
    }, USUARIO_INQUILINO),
    /campos no autorizados: id_usuario/i,
  );
  await assert.rejects(
    ejecutarToolSegura('gestionarReclamos', {
      accion: 'LISTAR_RECLAMOS',
      id_inquilino: 'otro-usuario',
    }, USUARIO_INQUILINO),
    /campos no autorizados: id_inquilino/i,
  );
  await assert.rejects(
    ejecutarToolSegura('consultarFinanzas', {
      accion: 'SALDOS',
      roles: ['ADMINISTRADOR'],
    }, USUARIO_INQUILINO),
    /campos no autorizados: roles/i,
  );
});

test('gestionarReclamos delega en el servicio con identidad y argumentos', async () => {
  const original = aiReclamosService.gestionarReclamos;
  try {
    aiReclamosService.gestionarReclamos = async (usuario, args) => {
      assert.deepEqual(usuario, USUARIO_INQUILINO);
      assert.deepEqual(args, { accion: 'LISTAR_RECLAMOS' });
      return [{ id: 'reclamo-1' }];
    };
    const resultado = await ejecutarToolSegura('gestionarReclamos', {
      accion: 'LISTAR_RECLAMOS',
    }, USUARIO_INQUILINO);
    assert.deepEqual(resultado, [{ id: 'reclamo-1' }]);
  } finally {
    aiReclamosService.gestionarReclamos = original;
  }
});

test('consultarFinanzas delega en el servicio financiero con identidad y argumentos', async () => {
  const original = aiFinanzasService.gestionarFinanzas;
  try {
    aiFinanzasService.gestionarFinanzas = async (usuario, args) => {
      assert.deepEqual(usuario, USUARIO_INQUILINO);
      assert.deepEqual(args, { accion: 'ANALIZAR_COMPROBANTE', texto: 'Total $10.000' });
      return { extraido: true, monto: 10000 };
    };
    const resultado = await ejecutarToolSegura('consultarFinanzas', {
      accion: 'ANALIZAR_COMPROBANTE',
      texto: 'Total $10.000',
    }, USUARIO_INQUILINO);
    assert.equal(resultado.monto, 10000);
  } finally {
    aiFinanzasService.gestionarFinanzas = original;
  }
});

test('consultarResumenAgrupamiento delega en el servicio con identidad y argumentos', async () => {
  const original = aiAgrupamientoService.consultarResumenAgrupamiento;
  try {
    aiAgrupamientoService.consultarResumenAgrupamiento = async (usuario, args) => {
      assert.deepEqual(usuario, USUARIO_INQUILINO);
      assert.deepEqual(args, { id_agrupamiento: 'agrupamiento-1', periodo: '2026-10' });
      return { totalCobradoMes: 0, reclamosUrgentes: 0 };
    };
    const resultado = await ejecutarToolSegura('consultarResumenAgrupamiento', {
      id_agrupamiento: 'agrupamiento-1',
      periodo: '2026-10',
    }, USUARIO_INQUILINO);
    assert.equal(resultado.reclamosUrgentes, 0);
  } finally {
    aiAgrupamientoService.consultarResumenAgrupamiento = original;
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
  await assert.rejects(
    ejecutarToolSegura('gestionarReclamos', { accion: 'ELIMINAR_TODO' }, { id: 'usuario-1', roles: ['ADMINISTRADOR'] }),
    /acción de reclamos no es válida/i,
  );
});
