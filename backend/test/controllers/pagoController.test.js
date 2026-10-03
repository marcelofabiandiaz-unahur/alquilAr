const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mockRes } = require('../helpers/mockRes');
const { loadControllerWithModel } = require('../helpers/loadControllerWithModel');
const { inquilinoId, contratoId } = require('../helpers/fixtures/ids');

class PagoMock {
  constructor(values) {
    Object.assign(this, values);
  }

  async save() {
    return this;
  }

  static find() {}
  static findById() {}
}

const controllerPath = path.resolve(__dirname, '../../src/controllers/pagoController.js');
const { crearPago, obtenerPagosPorInquilino, registrarComprobante, marcarComoPagado } =
  loadControllerWithModel(controllerPath, '../models/pago', PagoMock);

describe('pagoController', () => {
  let originalFind;
  let originalFindById;
  let originalSave;

  beforeEach(() => {
    originalFind = PagoMock.find;
    originalFindById = PagoMock.findById;
    originalSave = PagoMock.prototype.save;
  });

  afterEach(() => {
    PagoMock.find = originalFind;
    PagoMock.findById = originalFindById;
    PagoMock.prototype.save = originalSave;
  });

  it('crearPago devuelve 400 si falta un campo obligatorio', async () => {
    const res = mockRes();

    await crearPago({ body: { contrato: contratoId, inquilino: inquilinoId, monto: 25000 } }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  });

  it('crearPago persiste los datos y responde 201', async () => {
    let guardado;
    PagoMock.prototype.save = async function save() {
      guardado = this;
      return this;
    };
    const fechaVencimiento = '2026-10-10';
    const res = mockRes();

    await crearPago({
      body: { contrato: contratoId, inquilino: inquilinoId, monto: 25000, fechaVencimiento },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(guardado.contrato, contratoId);
    assert.equal(guardado.inquilino, inquilinoId);
    assert.equal(guardado.monto, 25000);
    assert.equal(guardado.fechaVencimiento, fechaVencimiento);
    assert.equal(res.body.data, guardado);
  });

  it('obtenerPagosPorInquilino filtra por usuario y popula el contrato', async () => {
    const pagos = [{ monto: 25000 }];
    let filtro;
    let campoPoblado;
    PagoMock.find = (query) => {
      filtro = query;
      return {
        populate(campo) {
          campoPoblado = campo;
          return Promise.resolve(pagos);
        },
      };
    };
    const res = mockRes();

    await obtenerPagosPorInquilino({ usuario: { _id: inquilinoId } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filtro, { inquilino: inquilinoId });
    assert.equal(campoPoblado, 'contrato');
    assert.equal(res.body.data, pagos);
  });

  it('registrarComprobante valida la URL requerida', async () => {
    const res = mockRes();

    await registrarComprobante({ params: { id: 'pago-1' }, body: {} }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /URL del comprobante/);
  });

  it('registrarComprobante guarda la URL del comprobante', async () => {
    const pago = { comprobanteUrl: null, save: async () => pago };
    PagoMock.findById = async () => pago;
    const res = mockRes();

    await registrarComprobante({ params: { id: 'pago-1' }, body: { comprobanteUrl: 'https://example.com/recibo' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(pago.comprobanteUrl, 'https://example.com/recibo');
    assert.equal(res.body.data, pago);
  });

  it('marcarComoPagado asigna estado y fecha de pago', async () => {
    const pago = { estado: 'PENDIENTE', fechaPago: null, save: async () => pago };
    PagoMock.findById = async () => pago;
    const res = mockRes();
    const antes = Date.now();

    await marcarComoPagado({ params: { id: 'pago-1' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(pago.estado, 'PAGADO');
    assert.ok(pago.fechaPago instanceof Date);
    assert.ok(pago.fechaPago.getTime() >= antes);
    assert.equal(res.body.data, pago);
  });
});
