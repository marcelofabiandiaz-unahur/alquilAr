const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Agrupamiento = require('../../src/models/agrupamiento');
const Propiedad = require('../../src/models/propiedad');
const Contrato = require('../../src/models/contrato');
const Reclamo = require('../../src/models/reclamo');
const Pago = require('../../src/models/pago');
const {
  listarPropiedades,
  crearPropiedad,
  actualizarPropiedad,
} = require('../../src/controllers/propiedadController');
const { listarContratos } = require('../../src/controllers/contratoController');
const { listarReclamos } = require('../../src/controllers/reclamoController');
const { obtenerResumen } = require('../../src/controllers/dashboardController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, propiedadId, contratoId } = require('../helpers/fixtures/ids');

const agrupamientoId = '507f1f77bcf86cd799439099';
const otroAgrupamientoId = '507f1f77bcf86cd799439098';

const agrupamientoDoc = () => ({
  _id: agrupamientoId,
  nombre: 'Edificio Palermo',
  estado: 'ACTIVO',
  id_administrador: usuarioId,
  gestores: [],
});

const cuerpoPropiedad = () => ({
  direccion: 'Av. Santa Fe 1234',
  tipo: 'Departamento',
  ambientes: 2,
  descripcion: 'Unidad de prueba',
  valor_base: 1000,
  fotos: [],
  id_agrupamiento: agrupamientoId,
  unidad: { identificador: '4B' },
});

describe('agrupamientos en controladores existentes', () => {
  let originales;

  beforeEach(() => {
    originales = {
      agrupamientoFindById: Agrupamiento.findById,
      propiedadFind: Propiedad.find,
      propiedadFindOne: Propiedad.findOne,
      propiedadFindById: Propiedad.findById,
      propiedadSave: Propiedad.prototype.save,
      contratoFind: Contrato.find,
      reclamoFind: Reclamo.find,
      reclamoCount: Reclamo.countDocuments,
      pagoAggregate: Pago.aggregate,
    };
  });

  afterEach(() => {
    Agrupamiento.findById = originales.agrupamientoFindById;
    Propiedad.find = originales.propiedadFind;
    Propiedad.findOne = originales.propiedadFindOne;
    Propiedad.findById = originales.propiedadFindById;
    Propiedad.prototype.save = originales.propiedadSave;
    Contrato.find = originales.contratoFind;
    Reclamo.find = originales.reclamoFind;
    Reclamo.countDocuments = originales.reclamoCount;
    Pago.aggregate = originales.pagoAggregate;
  });

  it('filtra las propiedades visibles de un agrupamiento sin ampliar el alcance', async () => {
    Agrupamiento.findById = async () => agrupamientoDoc();
    let filtroFinal;
    Propiedad.find = (filtro) => {
      if (filtro.id_agrupamiento) {
        return Promise.resolve([{ _id: propiedadId, estado: 'ALQUILADA' }]);
      }
      filtroFinal = filtro;
      return { sort: async () => [{ _id: propiedadId }] };
    };
    const res = mockRes();

    await listarPropiedades({
      query: { id_agrupamiento: agrupamientoId },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filtroFinal._id.$in, [propiedadId]);
    assert.equal(res.body.length, 1);
  });

  it('asocia una propiedad nueva a un agrupamiento con unidad', async () => {
    Agrupamiento.findById = async () => agrupamientoDoc();
    Propiedad.findOne = async () => null;
    let guardada;
    Propiedad.prototype.save = async function save() {
      guardada = this;
      return this;
    };
    const res = mockRes();

    await crearPropiedad({
      body: cuerpoPropiedad(),
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(guardada.id_agrupamiento.toString(), agrupamientoId);
    assert.equal(guardada.unidad.identificador, '4B');
  });

  it('rechaza reasignar una propiedad que ya pertenece a otro agrupamiento', async () => {
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
      id_agrupamiento: otroAgrupamientoId,
      unidad: { identificador: '1A' },
      fotos: [],
    });
    Agrupamiento.findById = async () => ({ ...agrupamientoDoc(), _id: agrupamientoId });
    const res = mockRes();

    await actualizarPropiedad({
      params: { id: propiedadId },
      body: { id_agrupamiento: agrupamientoId, unidad: { identificador: '2B' } },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('filtra contratos por agrupamiento', async () => {
    Agrupamiento.findById = async () => agrupamientoDoc();
    Propiedad.find = () => Promise.resolve([{ _id: propiedadId }]);
    let filtroContratos;
    Contrato.find = (filtro) => {
      filtroContratos = filtro;
      return {
        populate() { return this; },
        sort: async () => [],
      };
    };
    const res = mockRes();

    await listarContratos({
      query: { id_agrupamiento: agrupamientoId },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filtroContratos, { id_propiedad: { $in: [propiedadId] } });
  });

  it('filtra reclamos por agrupamiento y estado', async () => {
    Agrupamiento.findById = async () => agrupamientoDoc();
    Propiedad.find = () => Promise.resolve([{ _id: propiedadId }]);
    let filtroReclamos;
    Reclamo.find = (filtro) => {
      filtroReclamos = filtro;
      return {
        populate() { return this; },
        sort: async () => [],
      };
    };
    const res = mockRes();

    await listarReclamos({
      query: { id_agrupamiento: agrupamientoId, estado: 'PENDIENTE' },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(filtroReclamos.estado, 'PENDIENTE');
    assert.deepEqual(filtroReclamos.id_propiedad.$in, [propiedadId]);
  });

  it('devuelve el resumen del dashboard acotado al agrupamiento y período', async () => {
    Agrupamiento.findById = async () => agrupamientoDoc();
    Propiedad.find = () => Promise.resolve([
      { _id: propiedadId, estado: 'ALQUILADA' },
    ]);
    Contrato.find = () => Promise.resolve([
      { _id: contratoId, id_propiedad: propiedadId, estado: 'VIGENTE' },
    ]);
    Pago.aggregate = async () => [{
      periodo: [{ totalEstimadoMes: 1000, totalPendienteMes: 500 }],
      cobros: [{ totalCobradoMes: 500 }],
    }];
    Reclamo.countDocuments = async () => 1;
    const res = mockRes();

    await obtenerResumen({
      query: { id_agrupamiento: agrupamientoId, periodo: '2026-10' },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.periodo, '2026-10');
    assert.equal(res.body.data.agrupamiento.nombre, 'Edificio Palermo');
    assert.equal(res.body.data.unidadesTotales, 1);
    assert.equal(res.body.data.unidadesAlquiladas, 1);
    assert.equal(res.body.data.tasaOcupacion, 100);
  });

  it('rechaza un período de dashboard inválido', async () => {
    Agrupamiento.findById = async () => agrupamientoDoc();
    Propiedad.find = () => Promise.resolve([]);
    Contrato.find = () => Promise.resolve([]);
    const res = mockRes();

    await obtenerResumen({
      query: { id_agrupamiento: agrupamientoId, periodo: '2026-13' },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);

    assert.equal(res.statusCode, 400);
  });
});
