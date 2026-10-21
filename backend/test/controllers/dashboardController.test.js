const test = require('node:test');
const assert = require('node:assert/strict');
const Pago = require('../../src/models/pago');
const Propiedad = require('../../src/models/propiedad');
const Reclamo = require('../../src/models/reclamo');
const Contrato = require('../../src/models/contrato');
const { obtenerResumen } = require('../../src/controllers/dashboardController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, inquilinoId, propiedadId, contratoId } = require('../helpers/fixtures/ids');

const originales = {
  pagoAggregate: Pago.aggregate,
  reclamoCountDocuments: Reclamo.countDocuments,
  propiedadFind: Propiedad.find,
  contratoFind: Contrato.find,
};

test.afterEach(() => {
  Pago.aggregate = originales.pagoAggregate;
  Reclamo.countDocuments = originales.reclamoCountDocuments;
  Propiedad.find = originales.propiedadFind;
  Contrato.find = originales.contratoFind;
});

test('resume métricas del mes y limita el dashboard al propietario autenticado', async () => {
  let filtroContratos;
  let filtroPropiedades;
  let filtroReclamos;
  let pipelinePagos;
  Contrato.find = (filtro) => {
    filtroContratos = filtro;
    return Promise.resolve([{ _id: contratoId }]);
  };
  Propiedad.find = (filtro) => {
    filtroPropiedades = filtro;
    return { select: async () => [{ _id: propiedadId }] };
  };
  Pago.aggregate = async (pipeline) => {
    pipelinePagos = pipeline;
    return [{
      periodo: [{ totalEstimadoMes: 500000, totalPendienteMes: 250000 }],
      cobros: [{ totalCobradoMes: 375000 }],
    }];
  };
  Reclamo.countDocuments = async (filtro) => {
    filtroReclamos = filtro;
    return 2;
  };

  const res = mockRes();
  await obtenerResumen({
    usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(filtroContratos, { id_propiedad: { $in: [propiedadId] } });
  assert.deepEqual(filtroPropiedades, { id_propietario: usuarioId });
  assert.deepEqual(filtroReclamos.estado, { $nin: ['RESUELTO', 'CANCELADO'] });
  assert.deepEqual(filtroReclamos.id_propiedad, { $in: [propiedadId] });
  assert.deepEqual(pipelinePagos[0].$match.id_contrato.$in, [contratoId]);
  assert.deepEqual(pipelinePagos[1].$facet.periodo[0].$match.mes_correspondiente.$in, [
    res.body.data.periodo.replace('-', ''),
    res.body.data.periodo,
  ]);
  assert.deepEqual(res.body.data, {
    periodo: res.body.data.periodo,
    totalEstimadoMes: 500000,
    totalPendienteMes: 250000,
    totalCobradoMes: 375000,
    reclamosAbiertos: 2,
  });
});

test('limita las métricas del inquilino a sus contratos y reclamos', async () => {
  let filtroContratos;
  let filtroReclamos;
  Contrato.find = (filtro) => {
    filtroContratos = filtro;
    return Promise.resolve([{ _id: contratoId }]);
  };
  Pago.aggregate = async () => [{ periodo: [], cobros: [] }];
  Reclamo.countDocuments = async (filtro) => {
    filtroReclamos = filtro;
    return 0;
  };

  const res = mockRes();
  await obtenerResumen({
    usuario: { id: inquilinoId, roles: ['INQUILINO'] },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(filtroContratos, { id_inquilino: inquilinoId });
  assert.deepEqual(filtroReclamos.id_inquilino, inquilinoId);
  assert.equal(res.body.data.totalEstimadoMes, 0);
  assert.equal(res.body.data.totalPendienteMes, 0);
  assert.equal(res.body.data.totalCobradoMes, 0);
});

test('rechaza el resumen para usuarios sin rol operativo', async () => {
  const res = mockRes();
  await obtenerResumen({ usuario: { id: usuarioId, roles: ['USUARIO'] } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('responde error explícito cuando falla una agregación', async () => {
  Contrato.find = () => Promise.resolve([{ _id: contratoId }]);
  Pago.aggregate = async () => {
    throw new Error('database error');
  };
  const res = mockRes();
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    await obtenerResumen({
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);
  } finally {
    console.error = errorOriginal;
  }
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'No se pudo consultar el resumen del dashboard.');
});
