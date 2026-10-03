const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Pago = require('../../src/models/pago');
const Contrato = require('../../src/models/contrato');
const Propiedad = require('../../src/models/propiedad');
const {
  crearPago,
  listarPagos,
  obtenerPago,
  registrarComprobante,
  marcarComoPagado,
  actualizarPago,
  eliminarPago,
} = require('../../src/controllers/pagoController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, inquilinoId, propiedadId, contratoId } = require('../helpers/fixtures/ids');

describe('pagoController', () => {
  let original;

  beforeEach(() => {
    original = {
      pagoFind: Pago.find,
      pagoFindById: Pago.findById,
      pagoUpdateMany: Pago.updateMany,
      pagoSave: Pago.prototype.save,
      contratoFind: Contrato.find,
      contratoFindById: Contrato.findById,
      propiedadFind: Propiedad.find,
      propiedadFindById: Propiedad.findById,
    };
  });

  afterEach(() => {
    Pago.find = original.pagoFind;
    Pago.findById = original.pagoFindById;
    Pago.updateMany = original.pagoUpdateMany;
    Pago.prototype.save = original.pagoSave;
    Contrato.find = original.contratoFind;
    Contrato.findById = original.contratoFindById;
    Propiedad.find = original.propiedadFind;
    Propiedad.findById = original.propiedadFindById;
  });

  it('crea un pago desde el contrato y deriva importe y vencimiento del DER', async () => {
    Contrato.findById = async () => ({
      _id: contratoId,
      id_propiedad: propiedadId,
      id_inquilino: inquilinoId,
      dia_vencimiento: 10,
      monto_mensual: 250000,
      estado: 'VIGENTE',
    });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: usuarioId });
    Pago.prototype.save = async function save() {};
    const res = mockRes();

    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-11', monto_total: 1 },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.monto_total, 250000);
    assert.equal(res.body.data.fecha_vencimiento.getDate(), 10);
  });

  it('rechaza creación por un inquilino', async () => {
    const res = mockRes();
    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-11' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);
    assert.equal(res.statusCode, 403);
  });

  it('limita la consulta de pagos a contratos del inquilino', async () => {
    Contrato.find = async () => [{ _id: contratoId, id_inquilino: inquilinoId }];
    Pago.updateMany = async () => ({ modifiedCount: 0 });
    Pago.find = () => ({
      populate: () => ({
        sort: async () => [{ _id: 'pago', id_contrato: contratoId }],
      }),
    });
    const res = mockRes();

    await listarPagos({ usuario: { id: inquilinoId, roles: ['INQUILINO'] }, query: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 1);
  });

  it('permite que el inquilino del contrato cargue un comprobante', async () => {
    const pago = {
      id_contrato: contratoId,
      estado: 'PENDIENTE',
      save: async () => {},
    };
    Pago.findById = async () => pago;
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    const res = mockRes();

    await registrarComprobante({
      params: { id: '111111111111111111111111' },
      body: { comprobante_url: 'https://res.cloudinary.com/demo/recibo.pdf' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(pago.comprobante_url, 'https://res.cloudinary.com/demo/recibo.pdf');
  });

  it('impide a otro propietario confirmar el pago', async () => {
    Pago.findById = async () => ({ id_contrato: contratoId });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: inquilinoId });
    const res = mockRes();

    await marcarComoPagado({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('rechaza listar pagos para un usuario sin rol operativo', async () => {
    const res = mockRes();
    await listarPagos({ usuario: { id: usuarioId, roles: ['USUARIO'] }, query: {} }, res);
    assert.equal(res.statusCode, 403);
  });

  it('valida id y existencia al consultar el detalle de un pago', async () => {
    const invalido = mockRes();
    await obtenerPago({ params: { id: 'invalido' }, usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] } }, invalido);
    assert.equal(invalido.statusCode, 400);

    Pago.findById = () => ({ populate: () => Promise.resolve(null) });
    const inexistente = mockRes();
    await obtenerPago({ params: { id: '111111111111111111111111' }, usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] } }, inexistente);
    assert.equal(inexistente.statusCode, 404);
  });

  it('no permite consultar un pago ligado a un contrato no gestionable', async () => {
    Pago.findById = () => ({ populate: () => Promise.resolve({ _id: 'pago', id_contrato: contratoId }) });
    Contrato.findById = async () => ({ _id: contratoId, id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: inquilinoId });
    const res = mockRes();

    await obtenerPago({ params: { id: '111111111111111111111111' }, usuario: { id: usuarioId, roles: ['PROPIETARIO'] } }, res);

    assert.equal(res.statusCode, 403);
  });

  it('rechaza período de pago inválido y contratos no vigentes', async () => {
    const periodoInvalido = mockRes();
    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-13' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, periodoInvalido);
    assert.equal(periodoInvalido.statusCode, 400);

    Contrato.findById = async () => ({ _id: contratoId, id_propiedad: propiedadId, id_inquilino: inquilinoId, estado: 'FINALIZADO' });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: usuarioId });
    const cerrado = mockRes();
    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-11' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, cerrado);
    assert.equal(cerrado.statusCode, 409);
  });

  it('responde conflicto si ya existe un pago para el período', async () => {
    Contrato.findById = async () => ({ _id: contratoId, id_propiedad: propiedadId, id_inquilino: inquilinoId, dia_vencimiento: 10, monto_mensual: 100, estado: 'VIGENTE' });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: usuarioId });
    Pago.prototype.save = async () => { throw Object.assign(new Error('duplicado'), { code: 11000 }); };
    const res = mockRes();

    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-11' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('rechaza comprobantes que no sean URLs HTTPS y pagos inexistentes', async () => {
    const invalido = mockRes();
    await registrarComprobante({
      params: { id: '111111111111111111111111' },
      body: { comprobante_url: 'http://example.com/recibo.pdf' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, invalido);
    assert.equal(invalido.statusCode, 400);

    Pago.findById = async () => null;
    const inexistente = mockRes();
    await registrarComprobante({
      params: { id: '111111111111111111111111' },
      body: { comprobante_url: 'https://example.com/recibo.pdf' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, inexistente);
    assert.equal(inexistente.statusCode, 404);
  });

  it('no permite reemplazar el comprobante de un pago confirmado', async () => {
    Pago.findById = async () => ({ id_contrato: contratoId, estado: 'PAGADO' });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    const res = mockRes();

    await registrarComprobante({
      params: { id: '111111111111111111111111' },
      body: { comprobante_url: 'https://example.com/recibo.pdf' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('actualiza la fecha de vencimiento y deriva el estado del pago', async () => {
    const pago = { id_contrato: contratoId, estado: 'PENDIENTE', save: async () => {} };
    Pago.findById = async () => pago;
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    const res = mockRes();

    await actualizarPago({
      params: { id: '111111111111111111111111' },
      body: { fecha_vencimiento: '2000-01-01' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(pago.estado, 'ATRASADO');
  });

  it('no permite modificar ni eliminar pagos confirmados', async () => {
    Pago.findById = async () => ({ id_contrato: contratoId, estado: 'PAGADO' });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });

    const modificar = mockRes();
    await actualizarPago({
      params: { id: '111111111111111111111111' },
      body: {},
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, modificar);
    assert.equal(modificar.statusCode, 409);

    const eliminar = mockRes();
    await eliminarPago({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, eliminar);
    assert.equal(eliminar.statusCode, 409);
  });

  it('confirma y elimina pagos gestionables', async () => {
    const pago = { id_contrato: contratoId, estado: 'PENDIENTE', save: async () => {}, deleteOne: async () => {} };
    Pago.findById = async () => pago;
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });

    const confirmar = mockRes();
    await marcarComoPagado({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, confirmar);
    assert.equal(confirmar.statusCode, 200);
    assert.equal(pago.estado, 'PAGADO');
    assert.ok(pago.fecha_pago instanceof Date);

    pago.estado = 'PENDIENTE';
    const eliminar = mockRes();
    await eliminarPago({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, eliminar);
    assert.equal(eliminar.statusCode, 200);
  });
});
