const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mockRes } = require('../helpers/mockRes');
const { loadControllerWithModel } = require('../helpers/loadControllerWithModel');
const { inquilinoId, contratoId } = require('../helpers/fixtures/ids');

class ReclamoMock {
  constructor(values) {
    Object.assign(this, values);
  }

  async save() {
    return this;
  }

  static find() {}
  static findById() {}
}

const controllerPath = path.resolve(__dirname, '../../src/controllers/reclamoController.js');
const { crearReclamo, obtenerReclamosPorInquilino, actualizarEstadoReclamo } =
  loadControllerWithModel(controllerPath, '../models/reclamo', ReclamoMock);

describe('reclamoController', () => {
  let originalFind;
  let originalFindById;
  let originalSave;

  beforeEach(() => {
    originalFind = ReclamoMock.find;
    originalFindById = ReclamoMock.findById;
    originalSave = ReclamoMock.prototype.save;
  });

  afterEach(() => {
    ReclamoMock.find = originalFind;
    ReclamoMock.findById = originalFindById;
    ReclamoMock.prototype.save = originalSave;
  });

  it('crearReclamo devuelve 400 si faltan campos obligatorios', async () => {
    const res = mockRes();

    await crearReclamo({ body: { contrato: contratoId }, usuario: { _id: inquilinoId } }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Contrato, título y descripción/);
  });

  it('crearReclamo guarda el reclamo asociado al inquilino autenticado', async () => {
    let guardado;
    ReclamoMock.prototype.save = async function save() {
      guardado = this;
      return this;
    };
    const res = mockRes();

    await crearReclamo({
      body: { contrato: contratoId, titulo: 'Filtración', descripcion: 'Pierde agua', prioridad: 'ALTA' },
      usuario: { _id: inquilinoId },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(guardado.inquilino, inquilinoId);
    assert.equal(guardado.contrato, contratoId);
    assert.equal(guardado.prioridad, 'ALTA');
    assert.equal(res.body.data, guardado);
  });

  it('obtenerReclamosPorInquilino filtra por usuario y popula el contrato', async () => {
    const reclamos = [{ titulo: 'Filtración' }];
    let filtro;
    let campoPoblado;
    ReclamoMock.find = (query) => {
      filtro = query;
      return {
        populate(campo) {
          campoPoblado = campo;
          return Promise.resolve(reclamos);
        },
      };
    };
    const res = mockRes();

    await obtenerReclamosPorInquilino({ usuario: { _id: inquilinoId } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filtro, { inquilino: inquilinoId });
    assert.equal(campoPoblado, 'contrato');
    assert.equal(res.body.data, reclamos);
  });

  it('actualizarEstadoReclamo responde 404 cuando no existe el reclamo', async () => {
    ReclamoMock.findById = async () => null;
    const res = mockRes();

    await actualizarEstadoReclamo({ params: { id: 'inexistente' }, body: {} }, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /no encontrado/);
  });

  it('actualizarEstadoReclamo actualiza estado y prioridad', async () => {
    const reclamo = { estado: 'PENDIENTE', prioridad: 'BAJA', save: async () => reclamo };
    ReclamoMock.findById = async () => reclamo;
    const res = mockRes();

    await actualizarEstadoReclamo({ params: { id: 'reclamo-1' }, body: { estado: 'RESUELTO', prioridad: 'ALTA' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(reclamo.estado, 'RESUELTO');
    assert.equal(reclamo.prioridad, 'ALTA');
    assert.equal(res.body.data, reclamo);
  });
});
