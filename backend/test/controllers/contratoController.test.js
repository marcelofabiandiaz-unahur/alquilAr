const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Contrato = require('../../src/models/contrato');
const Propiedad = require('../../src/models/propiedad');
const {
  listarContratos,
  obtenerContrato,
  crearContrato,
  actualizarContrato,
  finalizarContrato,
} = require('../../src/controllers/contratoController');
const { mockRes, mockMongooseSession } = require('../helpers/mockRes');
const { mockFindByIdQuery } = require('../helpers/mockFindByIdQuery');
const {
  usuarioId,
  inquilinoId,
  propiedadId,
  contratoId,
} = require('../helpers/fixtures/ids');

describe('contratoController', () => {
  let restoreSession;

  beforeEach(() => {
    restoreSession = mockMongooseSession(mongoose);
  });

  afterEach(() => {
    restoreSession();
  });

  it('obtenerContrato responde 400 con id invalido', async () => {
    const req = {
      params: { id: 'id-invalido' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await obtenerContrato(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.mensaje, 'ID inválido.');
  });

  it('crearContrato rechaza id_propiedad invalido', async () => {
    const req = {
      body: { id_propiedad: 'mal', id_inquilino: inquilinoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await crearContrato(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /id_propiedad/);
  });

  it('actualizarContrato rechaza VIGENTE si propiedad ALQUILADA', async () => {
    const contrato = {
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'BORRADOR',
      save: async () => contrato,
    };

    Contrato.findById = () => mockFindByIdQuery(contrato);
    Contrato.findOne = async () => null;
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'ALQUILADA',
      save: async () => {},
    });

    const req = {
      params: { id: contratoId },
      body: { estado: 'VIGENTE' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await actualizarContrato(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /no está disponible/);
  });

  it('actualizarContrato activa VIGENTE con propiedad DISPONIBLE', async () => {
    let propiedadGuardada = null;
    const propiedad = {
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
      save: async function save() {
        propiedadGuardada = this;
        return this;
      },
    };

    const contrato = {
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'BORRADOR',
      save: async function save() {
        return this;
      },
    };

    Contrato.findById = () => mockFindByIdQuery(contrato);
    Contrato.findOne = async () => null;
    Propiedad.findById = async () => propiedad;

    const req = {
      params: { id: contratoId },
      body: { estado: 'VIGENTE' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await actualizarContrato(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(contrato.estado, 'VIGENTE');
    assert.equal(propiedadGuardada.estado, 'ALQUILADA');
  });

  it('actualizarContrato libera propiedad al cancelar contrato vigente', async () => {
    let propiedadGuardada = null;
    const propiedad = {
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'ALQUILADA',
      save: async function save() {
        propiedadGuardada = this;
        return this;
      },
    };

    const contrato = {
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'VIGENTE',
      save: async function save() {
        return this;
      },
    };

    Contrato.findById = () => mockFindByIdQuery(contrato);
    Contrato.findOne = async () => null;
    Propiedad.findById = async () => propiedad;

    const req = {
      params: { id: contratoId },
      body: { estado: 'CANCELADO' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await actualizarContrato(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(contrato.estado, 'CANCELADO');
    assert.equal(propiedadGuardada.estado, 'DISPONIBLE');
  });

  it('listarContratos perfil mixto usa filtro $or', async () => {
    let filtroCapturado = null;

    Propiedad.find = () => ({
      select: () => ({
        then(resolve) {
          resolve([{ _id: propiedadId }]);
        },
      }),
    });

    Contrato.find = (filtro) => {
      filtroCapturado = filtro;
      return {
        populate() { return this; },
        sort: async () => [],
      };
    };

    const req = {
      usuario: { id: usuarioId, roles: ['PROPIETARIO', 'INQUILINO'] },
    };
    const res = mockRes();

    await listarContratos(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(filtroCapturado.$or);
    assert.equal(filtroCapturado.$or.length, 2);
  });

  it('finalizarContrato rechaza contrato no vigente', async () => {
    Contrato.findById = () => mockFindByIdQuery({
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'BORRADOR',
    });
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
    });

    const req = {
      params: { id: contratoId },
      body: {},
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await finalizarContrato(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /vigentes/);
  });
});
