const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Propiedad = require('../../src/models/propiedad');
const Contrato = require('../../src/models/contrato');
const {
  listarPropiedades,
  obtenerPropiedad,
  crearPropiedad,
  actualizarPropiedad,
  bajaLogicaPropiedad,
} = require('../../src/controllers/propiedadController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, propiedadId, contratoVigenteId } = require('../helpers/fixtures/ids');

describe('propiedadController', () => {
  let origFindById;
  let origFindOne;
  let origFind;
  let origSave;

  beforeEach(() => {
    origFindById = Propiedad.findById;
    origFindOne = Contrato.findOne;
    origFind = Propiedad.find;
    origSave = Propiedad.prototype.save;
  });

  afterEach(() => {
    Propiedad.findById = origFindById;
    Contrato.findOne = origFindOne;
    Propiedad.find = origFind;
    Propiedad.prototype.save = origSave;
  });

  it('obtenerPropiedad responde 400 con id invalido', async () => {
    const req = {
      params: { id: 'no-valido' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await obtenerPropiedad(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.mensaje, 'ID inválido.');
  });

  it('crearPropiedad fuerza estado DISPONIBLE', async () => {
    let instanciaGuardada = null;
    Propiedad.prototype.save = async function save() {
      instanciaGuardada = this;
      return this;
    };

    const req = {
      body: {
        direccion: 'Test 1',
        tipo: 'Depto',
        ambientes: 2,
        valor_base: 100000,
        estado: 'ALQUILADA',
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await crearPropiedad(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(instanciaGuardada.estado, 'DISPONIBLE');
  });

  it('crearPropiedad rechaza usuario sin rol propietario', async () => {
    const req = {
      body: { direccion: 'Test', tipo: 'Depto', ambientes: 1, valor_base: 1 },
      usuario: { id: usuarioId, roles: ['INQUILINO'] },
    };
    const res = mockRes();

    await crearPropiedad(req, res);

    assert.equal(res.statusCode, 403);
  });

  it('actualizarPropiedad rechaza INACTIVA en PUT', async () => {
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
    });

    const req = {
      params: { id: propiedadId },
      body: { estado: 'INACTIVA' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await actualizarPropiedad(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /DELETE/);
  });

  it('actualizarPropiedad rechaza DISPONIBLE con contrato vigente', async () => {
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'EN_MANTENIMIENTO',
    });
    Contrato.findOne = async () => ({ _id: contratoVigenteId, estado: 'VIGENTE' });

    const req = {
      params: { id: propiedadId },
      body: { estado: 'DISPONIBLE' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await actualizarPropiedad(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /contrato vigente/);
  });

  it('listarPropiedades retorna 200 para propietario', async () => {
    Propiedad.find = () => ({
      sort: async () => [{ _id: propiedadId, direccion: 'Test' }],
    });

    const req = { usuario: { id: usuarioId, roles: ['PROPIETARIO'] } };
    const res = mockRes();

    await listarPropiedades(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body), true);
  });

  it('bajaLogicaPropiedad bloquea si hay contrato vigente', async () => {
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'ALQUILADA',
    });
    Contrato.findOne = async () => ({ _id: contratoVigenteId, estado: 'VIGENTE' });

    const req = {
      params: { id: propiedadId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await bajaLogicaPropiedad(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /contrato vigente/);
  });
});
