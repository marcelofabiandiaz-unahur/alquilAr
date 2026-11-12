const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Agrupamiento = require('../../src/models/agrupamiento');
const Propiedad = require('../../src/models/propiedad');
const Contrato = require('../../src/models/contrato');
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
      usuarioFind: require('../../src/models/usuario').find,
      contratoFind: Contrato.find,
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
    require('../../src/models/usuario').find = originales.usuarioFind;
    Contrato.find = originales.contratoFind;
  });

  it('no permite a un administrador listar agrupamientos', async () => {
    let filtroCapturado;
    Agrupamiento.find = (filtro) => {
      filtroCapturado = filtro;
      return {
        populate() { return this; },
        sort: async () => [{ _id: agrupamientoId }],
      };
    };
    const res = mockRes();

    await listarAgrupamientos({
      query: {},
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR', 'USUARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
    assert.equal(filtroCapturado, undefined);
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

  it('para inquilinos solo considera contratos vigentes', async () => {
    let filtroContrato;
    Contrato.find = (filtro) => {
      filtroContrato = filtro;
      return { select: async () => [{ id_propiedad: propiedadId }] };
    };
    Propiedad.find = () => ({
      select: async () => [{ id_agrupamiento: agrupamientoId }],
    });
    Agrupamiento.find = () => ({
      populate() { return this; },
      sort: async () => [],
    });
    const res = mockRes();

    await listarAgrupamientos({
      query: {},
      usuario: { id: usuarioId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filtroContrato, { id_inquilino: usuarioId, estado: 'VIGENTE' });
  });

  it('valida los filtros de listado', async () => {
    Propiedad.find = () => ({
      select: async () => [],
    });
    const res = mockRes();
    await listarAgrupamientos({
      query: { tipo: 'INVALIDO' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
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

  it('crea un agrupamiento con el propietario autenticado como responsable', async () => {
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
    assert.equal(guardado.codigo, undefined);
    assert.deepEqual(guardado.fotos, []);
    assert.equal(guardado.id_administrador.toString(), usuarioId);
    assert.equal(res.body.data.id_administrador.toString(), usuarioId);
  });

  it('crea agrupamientos sin aceptar código ni día de vencimiento', async () => {
    let guardado;
    Agrupamiento.prototype.save = async function save() {
      guardado = this;
      return this;
    };
    const res = mockRes();
    await crearAgrupamiento({
      body: {
        ...cuerpoValido(),
        codigo: 'dato-ignorado',
        configuracion: { moneda: 'ARS', dia_vencimiento_default: 5 },
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(guardado.codigo, undefined);
    assert.equal(guardado.configuracion.dia_vencimiento_default, undefined);
  });

  it('no permite a un administrador crear agrupamientos aunque conserve rol de usuario', async () => {
    const res = mockRes();
    await crearAgrupamiento({
      body: cuerpoValido(),
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR', 'USUARIO'] },
    }, res);
    assert.equal(res.statusCode, 403);
  });

  it('rechaza asignar como gestor a un usuario que no sea propietario activo', async () => {
    const Usuario = require('../../src/models/usuario');
    Usuario.find = () => ({
      select: async () => [{ _id: otroId, roles: ['INQUILINO'], estado: 'ACTIVO' }],
    });
    const res = mockRes();

    await crearAgrupamiento({
      body: { ...cuerpoValido(), gestores: [otroId] },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /propietarios activos/i);
  });

  it('valida la cantidad máxima de fotos del agrupamiento', async () => {
    const res = mockRes();
    await crearAgrupamiento({
      body: { ...cuerpoValido(), fotos: Array(6).fill('https://example.com/foto.jpg') },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /máximo 5 fotos/i);
  });

  it('solo permite actualizar al responsable o gestor asignado', async () => {
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
      id_administrador: usuarioId,
      estado: 'ACTIVO',
      save: async () => {},
    });
    Propiedad.countDocuments = async () => 2;
    const res = mockRes();

    await eliminarAgrupamiento({
      params: { id: agrupamientoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('da de baja un agrupamiento vacío', async () => {
    const agrupamiento = {
      _id: agrupamientoId,
      id_administrador: usuarioId,
      estado: 'ACTIVO',
      save: async () => {},
    };
    Agrupamiento.findById = async () => agrupamiento;
    Propiedad.countDocuments = async () => 0;
    const res = mockRes();

    await eliminarAgrupamiento({
      params: { id: agrupamientoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(agrupamiento.estado, 'INACTIVO');
    assert.equal(res.body.data.estado, 'INACTIVO');
  });

  it('no permite a un administrador dar de baja un agrupamiento', async () => {
    Agrupamiento.findById = async () => ({
      _id: agrupamientoId,
      id_administrador: usuarioId,
      estado: 'ACTIVO',
      save: async () => {},
    });
    const res = mockRes();
    await eliminarAgrupamiento({
      params: { id: agrupamientoId },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
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
