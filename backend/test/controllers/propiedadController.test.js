const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Propiedad = require('../../src/models/propiedad');
const Contrato = require('../../src/models/contrato');
const cloudinaryConfig = require('../../src/config/cloudinary');
const {
  listarPropiedades,
  listarPropiedadesDisponibles,
  obtenerPropiedad,
  crearPropiedad,
  actualizarPropiedad,
  bajaLogicaPropiedad,
  listarContratosPorPropiedad,
} = require('../../src/controllers/propiedadController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, propiedadId, contratoVigenteId } = require('../helpers/fixtures/ids');

describe('propiedadController', () => {
  let origFindById;
  let origFindOne;
  let origFind;
  let origPropiedadFindOne;
  let origContratoFind;
  let origSave;
  let origGetCloudinary;
  let origCloudName;

  beforeEach(() => {
    origFindById = Propiedad.findById;
    origFindOne = Contrato.findOne;
    origFind = Propiedad.find;
    origPropiedadFindOne = Propiedad.findOne;
    origContratoFind = Contrato.find;
    origSave = Propiedad.prototype.save;
    origGetCloudinary = cloudinaryConfig.getCloudinary;
    origCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  });

  afterEach(() => {
    Propiedad.findById = origFindById;
    Contrato.findOne = origFindOne;
    Propiedad.find = origFind;
    Propiedad.findOne = origPropiedadFindOne;
    Contrato.find = origContratoFind;
    Propiedad.prototype.save = origSave;
    cloudinaryConfig.getCloudinary = origGetCloudinary;
    if (origCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = origCloudName;
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

  it('listarPropiedades retorna 403 para usuario sin rol propietario', async () => {
    const req = { usuario: { id: usuarioId, roles: ['USUARIO'] } };
    const res = mockRes();

    await listarPropiedades(req, res);

    assert.equal(res.statusCode, 403);
  });

  it('listarPropiedadesDisponibles devuelve solo propiedades disponibles para usuarios autenticados', async () => {
    const disponibles = [{ _id: propiedadId, direccion: 'Calle 123', estado: 'DISPONIBLE' }];
    Propiedad.find = (filtro) => {
      assert.deepEqual(filtro, { estado: 'DISPONIBLE' });
      return {
        select: (campos) => {
          assert.equal(campos, '_id direccion tipo ambientes descripcion valor_base fotos estado');
          return { sort: async () => disponibles };
        },
      };
    };

    const req = { usuario: { id: usuarioId, roles: ['USUARIO'] } };
    const res = mockRes();

    await listarPropiedadesDisponibles(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, disponibles);
  });

  it('crearPropiedad rechaza mas de 5 fotos', async () => {
    const req = {
      body: {
        direccion: 'Test 1',
        tipo: 'Depto',
        ambientes: 2,
        valor_base: 100000,
        fotos: Array.from({ length: 6 }, (_, i) => `https://example.com/${i}.jpg`),
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await crearPropiedad(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /Máximo 5 fotos/);
  });

  it('crearPropiedad persiste array de fotos valido', async () => {
    let instanciaGuardada = null;
    Propiedad.prototype.save = async function save() {
      instanciaGuardada = this;
      return this;
    };

    const fotos = ['https://res.cloudinary.com/demo/a.jpg', 'https://res.cloudinary.com/demo/b.jpg'];
    const req = {
      body: {
        direccion: 'Test 1',
        tipo: 'Depto',
        ambientes: 2,
        valor_base: 100000,
        fotos,
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await crearPropiedad(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(instanciaGuardada.fotos, fotos);
  });

  it('actualizarPropiedad rechaza fotos que no son array', async () => {
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
      save: async () => {},
    });

    const req = {
      params: { id: propiedadId },
      body: { fotos: 'no-es-array' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await actualizarPropiedad(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /debe ser un array/);
  });

  it('actualizarPropiedad rechaza mas de 5 fotos', async () => {
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
      save: async () => {},
    });

    const req = {
      params: { id: propiedadId },
      body: { fotos: Array.from({ length: 6 }, (_, i) => `https://example.com/${i}.jpg`) },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await actualizarPropiedad(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /Máximo 5 fotos/);
  });

  it('actualizarPropiedad borra de Cloudinary las fotos quitadas al guardar', async () => {
    const fotoQuitada = 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/propiedades/antigua.jpg';
    const fotoConservada = 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/propiedades/nueva.jpg';
    let guardado = false;
    let recursoBorrado = '';
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
      fotos: [fotoQuitada, fotoConservada],
      save: async function save() {
        guardado = true;
      },
    });
    Propiedad.findOne = async () => null;
    cloudinaryConfig.getCloudinary = () => ({
      uploader: {
        destroy: async (publicId, options) => {
          assert.equal(guardado, true);
          assert.equal(options.resource_type, 'image');
          recursoBorrado = publicId;
          return { result: 'ok' };
        },
      },
    });

    const res = mockRes();
    await actualizarPropiedad({
      params: { id: propiedadId },
      body: { fotos: [fotoConservada] },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(recursoBorrado, 'alquilar/propiedades/antigua.jpg');
    assert.deepEqual(res.body.fotos, [fotoConservada]);
    assert.equal(res.body.advertencias, undefined);
  });

  it('conserva en Cloudinary una foto que todavía usa otra propiedad', async () => {
    const fotoCompartida = 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/propiedades/compartida.jpg';
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
      fotos: [fotoCompartida],
      save: async () => {},
    });
    Propiedad.findOne = async () => ({ _id: 'otra-propiedad' });
    cloudinaryConfig.getCloudinary = () => ({
      uploader: {
        destroy: async () => assert.fail('No debe borrar un asset aún referenciado.'),
      },
    });

    const res = mockRes();
    await actualizarPropiedad({
      params: { id: propiedadId },
      body: { fotos: [] },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.fotos, []);
  });

  it('avisa si la propiedad se guardó pero Cloudinary no pudo borrar la foto', async () => {
    const foto = 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/propiedades/antigua.jpg';
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
      fotos: [foto],
      save: async () => {},
    });
    Propiedad.findOne = async () => null;
    cloudinaryConfig.getCloudinary = () => ({
      uploader: { destroy: async () => ({ result: 'error' }) },
    });

    const res = mockRes();
    await actualizarPropiedad({
      params: { id: propiedadId },
      body: { fotos: [] },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.fotos, []);
    assert.match(res.body.advertencias[0], /no se pudo borrar/);
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

  it('listarContratosPorPropiedad ordena VIGENTE primero y resto por fecha_inicio desc', async () => {
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'ALQUILADA',
    });

    const contratosMock = [
      {
        _id: 'c1',
        estado: 'FINALIZADO',
        fecha_inicio: new Date('2023-01-01'),
      },
      {
        _id: 'c2',
        estado: 'VIGENTE',
        fecha_inicio: new Date('2024-06-01'),
      },
      {
        _id: 'c3',
        estado: 'FINALIZADO',
        fecha_inicio: new Date('2024-01-01'),
      },
    ];

    Contrato.find = () => ({
      populate: async () => contratosMock,
    });

    const req = {
      params: { id: propiedadId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await listarContratosPorPropiedad(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body[0].estado, 'VIGENTE');
    assert.equal(res.body[1]._id, 'c3');
    assert.equal(res.body[2]._id, 'c1');
  });
});
