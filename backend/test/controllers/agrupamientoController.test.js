const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Agrupamiento = require('../../src/models/agrupamiento');
const Propiedad = require('../../src/models/propiedad');
const {
  listarAgrupamientos,
  obtenerAgrupamiento,
  crearAgrupamiento,
  actualizarAgrupamiento,
  eliminarAgrupamiento,
} = require('../../src/controllers/agrupamientoController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, otroId, propiedadId } = require('../helpers/fixtures/ids');

const agrupamientoId = '507f1f77bcf86cd799439099';

const cuerpoValido = () => ({
  codigo: 'EDF-PALERMO-01',
  nombre: 'Edificio Palermo',
  tipo: 'EDIFICIO',
  direccion: {
    calle: 'Av. Santa Fe',
    numero: '1234',
    ciudad: 'CABA',
    provincia: 'Buenos Aires',
    codigo_postal: 'C1175',
  },
});

describe('agrupamientoController', () => {
  let originales;

  beforeEach(() => {
    originales = {
      agrupamientoFind: Agrupamiento.find,
      agrupamientoFindById: Agrupamiento.findById,
      agrupamientoSave: Agrupamiento.prototype.save,
      propiedadFind: Propiedad.find,
      propiedadExists: Propiedad.exists,
      propiedadCount: Propiedad.countDocuments,
    };
    Agrupamiento.find = () => ({
      populate() { return this; },
      sort: async () => [],
    });
    Agrupamiento.prototype.save = async function save() { return this; };
  });

  afterEach(() => {
    Agrupamiento.find = originales.agrupamientoFind;
    Agrupamiento.findById = originales.agrupamientoFindById;
    Agrupamiento.prototype.save = originales.agrupamientoSave;
    Propiedad.find = originales.propiedadFind;
    Propiedad.exists = originales.propiedadExists;
    Propiedad.countDocuments = originales.propiedadCount;
  });

  it('lista todos los agrupamientos para un administrador', async () => {
    let filtroCapturado;
    Agrupamiento.find = (filtro) => {
      filtroCapturado = filtro;
      return {
        populate() { return this; },
        sort: async () => [{ _id: agrupamientoId }],
      };
    };
    const res = mockRes();

    await listarAgrupamientos({ query: {}, usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filtroCapturado, {});
    assert.equal(res.body.data.length, 1);
  });

  it('limita los agrupamientos del propietario a los que administra o tienen sus unidades', async () => {
    let filtroCapturado;
    Propiedad.find = () => ({
      select: async () => [{ id_agrupamiento: agrupamientoId }],
    });
    Agrupamiento.find = (filtro) => {
      filtroCapturado = filtro;
      return {
        populate() { return this; },
        sort: async () => [],
      };
    };
    const res = mockRes();

    await listarAgrupamientos({ query: {}, usuario: { id: usuarioId, roles: ['PROPIETARIO'] } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filtroCapturado, {
      $or: [
        { id_administrador: usuarioId },
        { gestores: usuarioId },
        { _id: { $in: [agrupamientoId] } },
      ],
    });
  });

  it('valida los filtros de listado', async () => {
    const res = mockRes();
    await listarAgrupamientos({
      query: { tipo: 'INVALIDO' },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);
    assert.equal(res.statusCode, 400);
  });

  it('oculta un agrupamiento a un propietario sin relación', async () => {
    Agrupamiento.findById = async () => ({
      _id: agrupamientoId,
      id_administrador: otroId,
      gestores: [],
    });
    Propiedad.exists = async () => null;
    const res = mockRes();

    await obtenerAgrupamiento({
      params: { id: agrupamientoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('crea un agrupamiento con el propietario autenticado como administrador', async () => {
    let guardado;
    Agrupamiento.prototype.save = async function save() {
      guardado = this;
      return this;
    };
    const res = mockRes();

    await crearAgrupamiento({
      body: cuerpoValido(),
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(guardado.codigo, 'EDF-PALERMO-01');
    assert.equal(guardado.id_administrador.toString(), usuarioId);
    assert.equal(res.body.data.id_administrador.toString(), usuarioId);
  });

  it('rechaza códigos inválidos al crear', async () => {
    const res = mockRes();
    await crearAgrupamiento({
      body: { ...cuerpoValido(), codigo: 'ab' },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);
    assert.equal(res.statusCode, 400);
  });

  it('solo permite actualizar al administrador o gestor', async () => {
    Agrupamiento.findById = async () => ({
      _id: agrupamientoId,
      id_administrador: otroId,
      gestores: [],
      save: async () => {},
    });
    const res = mockRes();

    await actualizarAgrupamiento({
      params: { id: agrupamientoId },
      body: { nombre: 'Nuevo nombre' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('permite al gestor actualizar un agrupamiento', async () => {
    let guardado = false;
    Agrupamiento.findById = async () => ({
      _id: agrupamientoId,
      id_administrador: otroId,
      gestores: [usuarioId],
      nombre: 'Anterior',
      save: async () => { guardado = true; },
    });
    const res = mockRes();

    await actualizarAgrupamiento({
      params: { id: agrupamientoId },
      body: { nombre: 'Nuevo nombre' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(guardado, true);
  });

  it('bloquea la baja si el agrupamiento tiene propiedades activas', async () => {
    Agrupamiento.findById = async () => ({
      _id: agrupamientoId,
      estado: 'ACTIVO',
      save: async () => {},
    });
    Propiedad.countDocuments = async () => 2;
    const res = mockRes();

    await eliminarAgrupamiento({
      params: { id: agrupamientoId },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('da de baja un agrupamiento vacío', async () => {
    const agrupamiento = {
      _id: agrupamientoId,
      estado: 'ACTIVO',
      save: async () => {},
    };
    Agrupamiento.findById = async () => agrupamiento;
    Propiedad.countDocuments = async () => 0;
    const res = mockRes();

    await eliminarAgrupamiento({
      params: { id: agrupamientoId },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(agrupamiento.estado, 'INACTIVO');
    assert.equal(res.body.data.estado, 'INACTIVO');
  });

  it('solo un administrador puede dar de baja un agrupamiento', async () => {
    const res = mockRes();
    await eliminarAgrupamiento({
      params: { id: agrupamientoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);
    assert.equal(res.statusCode, 403);
  });

  it('valida el id al consultar y actualizar', async () => {
    const consulta = mockRes();
    await obtenerAgrupamiento({
      params: { id: 'invalido' },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, consulta);
    assert.equal(consulta.statusCode, 400);

    const actualizacion = mockRes();
    await actualizarAgrupamiento({
      params: { id: 'invalido' },
      body: {},
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, actualizacion);
    assert.equal(actualizacion.statusCode, 400);
  });

  it('rechaza crear agrupamientos sin rol habilitado', async () => {
    const res = mockRes();
    await crearAgrupamiento({
      body: cuerpoValido(),
      usuario: { id: usuarioId, roles: ['INQUILINO'] },
    }, res);
    assert.equal(res.statusCode, 403);
  });

  it('usa una propiedad para resolver el agrupamiento visible del propietario', async () => {
    const doc = {
      _id: agrupamientoId,
      id_administrador: otroId,
      gestores: [],
    };
    const consulta = {
      populate() { return consulta; },
      then(resolve) { resolve(doc); },
    };
    Agrupamiento.findById = () => consulta;
    Propiedad.exists = async () => ({ _id: propiedadId });
    const res = mockRes();

    await obtenerAgrupamiento({
      params: { id: agrupamientoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
  });
});
