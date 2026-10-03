const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Gasto = require('../../src/models/gasto');
const Propiedad = require('../../src/models/propiedad');
const Contrato = require('../../src/models/contrato');
const {
  crearGasto,
  listarGastos,
  obtenerGasto,
  actualizarGasto,
  eliminarGasto,
} = require('../../src/controllers/gastoController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, otroId, propiedadId } = require('../helpers/fixtures/ids');

describe('gastoController', () => {
  let original;

  beforeEach(() => {
    original = {
      gastoFind: Gasto.find,
      gastoFindById: Gasto.findById,
      gastoSave: Gasto.prototype.save,
      propiedadFind: Propiedad.find,
      propiedadFindById: Propiedad.findById,
      contratoExists: Contrato.exists,
    };
  });

  afterEach(() => {
    Gasto.find = original.gastoFind;
    Gasto.findById = original.gastoFindById;
    Gasto.prototype.save = original.gastoSave;
    Propiedad.find = original.propiedadFind;
    Propiedad.findById = original.propiedadFindById;
    Contrato.exists = original.contratoExists;
  });

  it('crea un gasto con las relaciones y campos del DER', async () => {
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: usuarioId });
    Gasto.prototype.save = async function save() {};
    const res = mockRes();

    await crearGasto({
      body: {
        id_propiedad: propiedadId,
        fecha_emision: '2026-10-01',
        monto_total: 12000,
        tipo: 'MANTENIMIENTO',
        comprobantes: ['https://example.com/recibo.pdf'],
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.id_propiedad.toString(), propiedadId);
    assert.deepEqual(res.body.data.comprobantes, ['https://example.com/recibo.pdf']);
  });

  it('rechaza gastos en propiedad ajena', async () => {
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: otroId });
    const res = mockRes();

    await crearGasto({
      body: {
        id_propiedad: propiedadId,
        fecha_emision: '2026-10-01',
        monto_total: 12000,
        tipo: 'SERVICIO',
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('filtra gastos por propiedad y rango de fechas', async () => {
    Propiedad.find = () => ({ select: async () => [{ _id: propiedadId }] });
    Gasto.find = (filter) => {
      assert.equal(filter.id_propiedad.$in[0].toString(), propiedadId);
      assert.ok(filter.fecha_emision.$gte instanceof Date);
      assert.ok(filter.fecha_emision.$lte instanceof Date);
      return {
        populate: () => ({
          sort: async () => [],
        }),
      };
    };
    const res = mockRes();

    await listarGastos({
      query: { desde: '2026-10-01', hasta: '2026-10-31' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, []);
  });

  it('rechaza cambios a gastos de otra propiedad', async () => {
    Gasto.findById = async () => ({ id_propiedad: propiedadId });
    Propiedad.findById = async () => ({ id_propietario: otroId });
    const res = mockRes();

    await actualizarGasto({
      params: { id: '111111111111111111111111' },
      body: { estado_pago: 'PAGADO' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('rechaza consultas de gastos de usuarios sin rol operativo', async () => {
    const res = mockRes();
    await listarGastos({ query: {}, usuario: { id: usuarioId, roles: ['USUARIO'] } }, res);
    assert.equal(res.statusCode, 403);
  });

  it('valida propiedad, período y estado en filtros de gastos', async () => {
    Propiedad.find = () => ({ select: async () => [{ _id: propiedadId }] });

    const idInvalido = mockRes();
    await listarGastos({
      query: { id_propiedad: 'invalido' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, idInvalido);
    assert.equal(idInvalido.statusCode, 400);

    const fechaInvalida = mockRes();
    await listarGastos({
      query: { desde: 'no-es-fecha' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, fechaInvalida);
    assert.equal(fechaInvalida.statusCode, 400);

    const rangoInvertido = mockRes();
    await listarGastos({
      query: { desde: '2026-10-31', hasta: '2026-10-01' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, rangoInvertido);
    assert.equal(rangoInvertido.statusCode, 400);

    const estadoInvalido = mockRes();
    await listarGastos({
      query: { estado_pago: 'DESCONOCIDO' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, estadoInvalido);
    assert.equal(estadoInvalido.statusCode, 400);
  });

  it('valida los campos y comprobantes al crear un gasto', async () => {
    const incompleto = mockRes();
    await crearGasto({ body: {}, usuario: { id: usuarioId, roles: ['PROPIETARIO'] } }, incompleto);
    assert.equal(incompleto.statusCode, 400);

    const montoInvalido = mockRes();
    await crearGasto({
      body: { id_propiedad: propiedadId, fecha_emision: '2026-10-01', monto_total: -1, tipo: 'SERVICIO' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, montoInvalido);
    assert.equal(montoInvalido.statusCode, 400);

    const comprobanteInvalido = mockRes();
    await crearGasto({
      body: {
        id_propiedad: propiedadId,
        fecha_emision: '2026-10-01',
        monto_total: 1,
        tipo: 'SERVICIO',
        comprobantes: ['http://example.com/recibo.pdf'],
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, comprobanteInvalido);
    assert.equal(comprobanteInvalido.statusCode, 400);
  });

  it('devuelve 404 cuando la propiedad del nuevo gasto no existe', async () => {
    Propiedad.findById = async () => null;
    const res = mockRes();
    await crearGasto({
      body: { id_propiedad: propiedadId, fecha_emision: '2026-10-01', monto_total: 1, tipo: 'SERVICIO' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);
    assert.equal(res.statusCode, 404);
  });

  it('valida la consulta individual de un gasto y sus permisos', async () => {
    const idInvalido = mockRes();
    await obtenerGasto({ params: { id: 'mal' }, usuario: { id: usuarioId, roles: ['PROPIETARIO'] } }, idInvalido);
    assert.equal(idInvalido.statusCode, 400);

    Gasto.findById = () => ({ populate: async () => null });
    const inexistente = mockRes();
    await obtenerGasto({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, inexistente);
    assert.equal(inexistente.statusCode, 404);

    Gasto.findById = () => ({ populate: async () => ({ id_propiedad: propiedadId }) });
    Propiedad.findById = async () => ({ id_propietario: otroId });
    const prohibido = mockRes();
    await obtenerGasto({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, prohibido);
    assert.equal(prohibido.statusCode, 403);
  });

  it('permite al inquilino consultar gastos de una propiedad con contrato vigente', async () => {
    Gasto.findById = () => ({ populate: async () => ({ id_propiedad: propiedadId }) });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: otroId });
    Contrato.exists = async () => true;
    const res = mockRes();

    await obtenerGasto({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 200);
  });

  it('valida comprobantes al actualizar gastos y elimina gastos autorizados', async () => {
    const gasto = { id_propiedad: propiedadId, save: async () => {}, deleteOne: async () => {} };
    Gasto.findById = async () => gasto;
    Propiedad.findById = async () => ({ id_propietario: usuarioId });

    const comprobanteInvalido = mockRes();
    await actualizarGasto({
      params: { id: '111111111111111111111111' },
      body: { comprobantes: 'no-es-un-array' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, comprobanteInvalido);
    assert.equal(comprobanteInvalido.statusCode, 400);

    const actualizar = mockRes();
    await actualizarGasto({
      params: { id: '111111111111111111111111' },
      body: { proveedor: 'Proveedor actualizado', campo_ignorado: 'no persistir' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, actualizar);
    assert.equal(actualizar.statusCode, 200);
    assert.equal(gasto.proveedor, 'Proveedor actualizado');
    assert.equal(gasto.campo_ignorado, undefined);

    const eliminar = mockRes();
    await eliminarGasto({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, eliminar);
    assert.equal(eliminar.statusCode, 200);
  });
});
