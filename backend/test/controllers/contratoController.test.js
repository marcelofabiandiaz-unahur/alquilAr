const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Contrato = require('../../src/models/contrato');
const Pago = require('../../src/models/pago');
const Propiedad = require('../../src/models/propiedad');
const Usuario = require('../../src/models/usuario');
const {
  listarContratos,
  obtenerContrato,
  crearContrato,
  actualizarContrato,
  finalizarContrato,
  cancelarContrato,
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
  let original;

  beforeEach(() => {
    restoreSession = mockMongooseSession(mongoose);
    original = {
      contratoFind: Contrato.find,
      contratoFindById: Contrato.findById,
      contratoFindOne: Contrato.findOne,
      contratoSave: Contrato.prototype.save,
      pagoBulkWrite: Pago.bulkWrite,
      propiedadFind: Propiedad.find,
      propiedadFindById: Propiedad.findById,
      usuarioFindById: Usuario.findById,
      usuarioFindOne: Usuario.findOne,
    };
  });

  afterEach(() => {
    Contrato.find = original.contratoFind;
    Contrato.findById = original.contratoFindById;
    Contrato.findOne = original.contratoFindOne;
    Contrato.prototype.save = original.contratoSave;
    Pago.bulkWrite = original.pagoBulkWrite;
    Propiedad.find = original.propiedadFind;
    Propiedad.findById = original.propiedadFindById;
    Usuario.findById = original.usuarioFindById;
    Usuario.findOne = original.usuarioFindOne;
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

  it('crearContrato rechaza email_inquilino inexistente', async () => {
    Usuario.findOne = async () => null;

    const req = {
      body: {
        id_propiedad: propiedadId,
        email_inquilino: 'noexiste@alquilar.com',
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await crearContrato(req, res);

    assert.equal(res.statusCode, 404);
    assert.match(res.body.mensaje, /No existe un usuario/);
  });

  it('crearContrato fuerza BORRADOR si usuario sin rol INQUILINO', async () => {
    Usuario.findOne = async () => ({
      _id: inquilinoId,
      roles: ['USUARIO'],
    });

    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
    });

    Contrato.prototype.save = async function save() {
      return this;
    };

    Contrato.findById = () => mockFindByIdQuery({
      _id: contratoId,
      estado: 'BORRADOR',
      toObject() {
        return { _id: contratoId, estado: 'BORRADOR' };
      },
    });

    const req = {
      body: {
        id_propiedad: propiedadId,
        email_inquilino: 'usuario1@alquilar.com',
        fecha_inicio: '2026-01-01',
        monto_mensual: 100000,
        dia_vencimiento: 10,
        estado: 'VIGENTE',
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await crearContrato(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.requiere_rol_inquilino, true);
    assert.equal(res.body.estado, 'BORRADOR');
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
      id_inquilino: inquilinoId,
      estado: 'BORRADOR',
      save: async () => contrato,
    };

    Contrato.findById = () => mockFindByIdQuery(contrato);
    Contrato.findOne = async () => null;
    Usuario.findById = async () => ({ _id: inquilinoId, roles: ['INQUILINO'] });
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
      id_inquilino: inquilinoId,
      estado: 'BORRADOR',
      fecha_inicio: new Date('2026-01-15T00:00:00.000Z'),
      fecha_fin: new Date('2026-03-31T00:00:00.000Z'),
      monto_mensual: 100000,
      dia_vencimiento: 10,
      save: async function save() {
        return this;
      },
    };
    let operacionesCuotas = [];
    Pago.bulkWrite = async (ops) => {
      operacionesCuotas = ops;
      return { upsertedCount: ops.length };
    };

    Contrato.findById = () => mockFindByIdQuery(contrato);
    Contrato.findOne = async () => null;
    Usuario.findById = async () => ({ _id: inquilinoId, roles: ['INQUILINO'] });
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
    assert.equal(operacionesCuotas.length, 3);
    assert.deepEqual(
      operacionesCuotas.map((op) => op.updateOne.update.$setOnInsert.mes_correspondiente),
      ['DEPOSITO', '202602', '202603'],
    );
    assert.equal(operacionesCuotas[0].updateOne.update.$setOnInsert.fecha_vencimiento.toISOString(), '2026-01-15T00:00:00.000Z');
  });

  it('actualizarContrato no permite cambiar el monto mensual de un contrato vigente', async () => {
    let guardado = false;
    Contrato.findById = async () => ({
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'VIGENTE',
      monto_mensual: 100000,
      save: async () => { guardado = true; },
    });
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'ALQUILADA',
    });
    const res = mockRes();

    await actualizarContrato({
      params: { id: contratoId },
      body: { monto_mensual: 125000 },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /No se puede modificar el monto mensual/);
    assert.equal(guardado, false);
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

  it('listarContratos rechaza roles sin acceso y permite a administradores', async () => {
    const noAutorizado = mockRes();
    await listarContratos({ usuario: { id: usuarioId, roles: ['USUARIO'] } }, noAutorizado);
    assert.equal(noAutorizado.statusCode, 403);

    Contrato.find = () => ({
      populate() { return this; },
      sort: async () => [{ _id: contratoId }],
    });
    const administrador = mockRes();
    await listarContratos({ usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] } }, administrador);
    assert.equal(administrador.statusCode, 200);
    assert.equal(administrador.body.length, 1);
  });

  it('obtenerContrato devuelve el contrato al inquilino relacionado y oculta relaciones ajenas', async () => {
    const contrato = {
      _id: contratoId,
      id_propiedad: { _id: propiedadId, id_propietario: usuarioId },
      id_inquilino: { _id: inquilinoId },
      estado: 'VIGENTE',
    };
    Contrato.findById = () => mockFindByIdQuery(contrato);
    const permitido = mockRes();
    await obtenerContrato({
      params: { id: contratoId },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, permitido);
    assert.equal(permitido.statusCode, 200);

    const prohibido = mockRes();
    await obtenerContrato({
      params: { id: contratoId },
      usuario: { id: '507f1f77bcf86cd799439099', roles: ['INQUILINO'] },
    }, prohibido);
    assert.equal(prohibido.statusCode, 403);
  });

  it('crearContrato rechaza usuarios sin permiso y propiedades inexistentes', async () => {
    const sinPermiso = mockRes();
    await crearContrato({
      body: { id_propiedad: propiedadId },
      usuario: { id: usuarioId, roles: ['INQUILINO'] },
    }, sinPermiso);
    assert.equal(sinPermiso.statusCode, 403);

    Usuario.findOne = async () => ({ _id: inquilinoId, roles: ['INQUILINO'] });
    Propiedad.findById = async () => null;
    const sinPropiedad = mockRes();
    await crearContrato({
      body: { id_propiedad: propiedadId, email_inquilino: 'inquilino@alquilar.com' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, sinPropiedad);
    assert.equal(sinPropiedad.statusCode, 404);
  });

  it('crearContrato rechaza activar una propiedad que ya tiene contrato vigente', async () => {
    Usuario.findOne = async () => ({ _id: inquilinoId, roles: ['INQUILINO'] });
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
    });
    Contrato.findOne = async () => ({ _id: contratoId });
    const res = mockRes();

    await crearContrato({
      body: {
        id_propiedad: propiedadId,
        email_inquilino: 'inquilino@alquilar.com',
        estado: 'VIGENTE',
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /ya tiene un contrato vigente/);
  });

  it('actualizarContrato rechaza contratos cerrados y activación sin rol de inquilino', async () => {
    Contrato.findById = () => mockFindByIdQuery({
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'FINALIZADO',
    });
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
    });
    const cerrado = mockRes();
    await actualizarContrato({
      params: { id: contratoId },
      body: { estado: 'VIGENTE' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, cerrado);
    assert.equal(cerrado.statusCode, 400);
    assert.match(cerrado.body.mensaje, /contrato cerrado/);

    Contrato.findById = () => mockFindByIdQuery({
      _id: contratoId,
      id_propiedad: propiedadId,
      id_inquilino: inquilinoId,
      estado: 'BORRADOR',
    });
    Usuario.findById = async () => ({ _id: inquilinoId, roles: ['USUARIO'] });
    const sinRol = mockRes();
    await actualizarContrato({
      params: { id: contratoId },
      body: { estado: 'VIGENTE' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, sinRol);
    assert.equal(sinRol.statusCode, 400);
    assert.match(sinRol.body.mensaje, /rol INQUILINO/);
  });

  it('finaliza un contrato vigente y libera su propiedad', async () => {
    const contrato = {
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'VIGENTE',
      save: async () => {},
    };
    const propiedad = {
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'ALQUILADA',
      save: async () => {},
    };
    Contrato.findById = () => mockFindByIdQuery(contrato);
    Propiedad.findById = async () => propiedad;
    const originalFindById = Contrato.findById;
    let lecturas = 0;
    Contrato.findById = (id) => {
      lecturas += 1;
      return lecturas === 1
        ? originalFindById(id)
        : mockFindByIdQuery({ ...contrato, fecha_fin: '2026-10-01' });
    };
    const res = mockRes();

    await finalizarContrato({
      params: { id: contratoId },
      body: { fecha_fin: '2026-10-01' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(contrato.estado, 'FINALIZADO');
    assert.equal(propiedad.estado, 'DISPONIBLE');
    assert.equal(res.body.contrato.fecha_fin, '2026-10-01');
  });

  it('cancela un borrador sin cambiar el estado de la propiedad', async () => {
    const contrato = {
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'BORRADOR',
      save: async () => {},
    };
    Contrato.findById = () => mockFindByIdQuery(contrato);
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
    });
    const res = mockRes();

    await cancelarContrato({
      params: { id: contratoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(contrato.estado, 'CANCELADO');
  });

  it('listarContratos filtra por propietario e inquilino individual', async () => {
    let filtroPropiedades;
    Propiedad.find = (filtro) => {
      filtroPropiedades = filtro;
      return { select: async () => [{ _id: propiedadId }] };
    };
    let filtroPropietario;
    Contrato.find = (filtro) => {
      filtroPropietario = filtro;
      return {
        populate() { return this; },
        sort: async () => [],
      };
    };
    const propietario = mockRes();
    await listarContratos({ usuario: { id: usuarioId, roles: ['PROPIETARIO'] } }, propietario);
    assert.equal(propietario.statusCode, 200);
    assert.deepEqual(filtroPropiedades, { id_propietario: usuarioId });
    assert.deepEqual(filtroPropietario, { id_propiedad: { $in: [propiedadId] } });

    let filtroInquilino;
    Contrato.find = (filtro) => {
      filtroInquilino = filtro;
      return {
        populate() { return this; },
        sort: async () => [],
      };
    };
    const inquilino = mockRes();
    await listarContratos({ usuario: { id: inquilinoId, roles: ['INQUILINO'] } }, inquilino);
    assert.equal(inquilino.statusCode, 200);
    assert.deepEqual(filtroInquilino, { id_inquilino: inquilinoId });
  });

  it('crearContrato acepta el id del inquilino y devuelve el contrato creado', async () => {
    Usuario.findById = async () => ({ _id: inquilinoId, roles: ['INQUILINO'] });
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
    });
    Contrato.prototype.save = async function save() { return this; };
    Contrato.findById = () => mockFindByIdQuery({
      _id: contratoId,
      estado: 'BORRADOR',
      toObject() { return { _id: contratoId, estado: 'BORRADOR' }; },
    });
    const res = mockRes();

    await crearContrato({
      body: {
        id_propiedad: propiedadId,
        id_inquilino: inquilinoId,
        fecha_inicio: '2026-10-01',
        monto_mensual: 100000,
        dia_vencimiento: 10,
      },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body._id, contratoId);
  });

  it('rechaza modificar un contrato inexistente o una propiedad ajena', async () => {
    Contrato.findById = () => mockFindByIdQuery(null);
    const inexistente = mockRes();
    await actualizarContrato({
      params: { id: contratoId },
      body: {},
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, inexistente);
    assert.equal(inexistente.statusCode, 404);

    Contrato.findById = () => mockFindByIdQuery({
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'BORRADOR',
    });
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: inquilinoId,
      estado: 'DISPONIBLE',
    });
    const ajena = mockRes();
    await actualizarContrato({
      params: { id: contratoId },
      body: {},
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, ajena);
    assert.equal(ajena.statusCode, 403);
  });

  it('rechaza cancelar un contrato ya cerrado', async () => {
    Contrato.findById = () => mockFindByIdQuery({
      _id: contratoId,
      id_propiedad: propiedadId,
      estado: 'FINALIZADO',
    });
    Propiedad.findById = async () => ({
      _id: propiedadId,
      id_propietario: usuarioId,
      estado: 'DISPONIBLE',
    });
    const res = mockRes();

    await cancelarContrato({
      params: { id: contratoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /ya está cerrado/);
  });
});
