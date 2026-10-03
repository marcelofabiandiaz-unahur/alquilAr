const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-bytes';
const Usuario = require('../../src/models/usuario');
const {
  registrarUsuario,
  agregarRolesUsuario,
  loginUsuario,
} = require('../../src/controllers/authController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, inquilinoId } = require('../helpers/fixtures/ids');

describe('authController', () => {
  let origFindById;
  let origFindOne;
  let origSave;

  beforeEach(() => {
    origFindById = Usuario.findById;
    origFindOne = Usuario.findOne;
    origSave = Usuario.prototype.save;
  });

  afterEach(() => {
    Usuario.findById = origFindById;
    Usuario.findOne = origFindOne;
    Usuario.prototype.save = origSave;
  });

  it('registrarUsuario asigna solo el rol base aunque el cliente solicite privilegios', async () => {
    let usuarioGuardado;
    Usuario.prototype.save = async function save() {
      usuarioGuardado = this;
    };

    const req = {
      body: {
        nombre: 'Admin',
        apellido: 'Inesperado',
        dni: '12345678',
        email: 'admin@alquilar.com',
        password: 'ClaveTest123',
        roles: ['ADMINISTRADOR', 'PROPIETARIO'],
      },
    };
    const res = mockRes();

    await registrarUsuario(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(usuarioGuardado.roles, ['USUARIO']);
    assert.equal(res.body.roles.includes('ADMINISTRADOR'), false);
    assert.equal('password' in res.body, false);
  });

  it('loginUsuario incluye email en la respuesta', async () => {
    const argon2 = require('argon2');
    const origVerify = argon2.verify;
    argon2.verify = async () => true;
    let filtroConsultado;

    Usuario.findOne = async (filtro) => {
      filtroConsultado = filtro;
      return ({
        _id: usuarioId,
        nombre: 'Propietario',
        apellido: 'Uno',
        email: 'propietario1@alquilar.com',
        roles: ['PROPIETARIO'],
        password: 'hash',
      });
    };

    const req = { body: { email: '  Propietario1@Alquilar.com ', password: 'ClaveTest123' } };
    const res = mockRes();

    await loginUsuario(req, res);

    argon2.verify = origVerify;

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filtroConsultado, { email: 'propietario1@alquilar.com' });
    assert.equal(res.body.usuario.email, 'propietario1@alquilar.com');
    assert.equal(res.body.usuario.nombre, 'Propietario');
  });

  it('agregarRolesUsuario rechaza body sin array agregar', async () => {
    const req = { params: { id: usuarioId }, body: {} };
    const res = mockRes();

    await agregarRolesUsuario(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /roles a agregar/);
  });

  it('agregarRolesUsuario responde 404 si usuario no existe', async () => {
    Usuario.findById = async () => null;

    const req = { params: { id: usuarioId }, body: { agregar: ['INQUILINO'] } };
    const res = mockRes();

    await agregarRolesUsuario(req, res);

    assert.equal(res.statusCode, 404);
  });

  it('agregarRolesUsuario rechaza rol invalido', async () => {
    Usuario.findById = async () => ({
      _id: usuarioId,
      roles: ['USUARIO'],
      save: async () => {},
      toObject() {
        return { _id: this._id, roles: this.roles };
      },
    });

    const req = { params: { id: usuarioId }, body: { agregar: ['SUPERADMIN'] } };
    const res = mockRes();

    await agregarRolesUsuario(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /Rol inválido/);
  });

  it('agregarRolesUsuario agrega INQUILINO sin duplicar', async () => {
    const usuario = {
      _id: usuarioId,
      roles: ['USUARIO'],
      save: async () => {},
      toObject() {
        return { _id: this._id, roles: this.roles };
      },
    };
    Usuario.findById = async () => usuario;

    const req = { params: { id: usuarioId }, body: { agregar: ['INQUILINO'] } };
    const res = mockRes();

    await agregarRolesUsuario(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(usuario.roles, ['USUARIO', 'INQUILINO']);
  });

  it('agregarRolesUsuario agrega PROPIETARIO', async () => {
    const usuario = {
      _id: inquilinoId,
      roles: ['USUARIO', 'INQUILINO'],
      save: async () => {},
      toObject() {
        return { _id: this._id, roles: this.roles };
      },
    };
    Usuario.findById = async () => usuario;

    const req = { params: { id: inquilinoId }, body: { agregar: ['PROPIETARIO'] } };
    const res = mockRes();

    await agregarRolesUsuario(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(usuario.roles.includes('PROPIETARIO'));
  });

  it('agregarRolesUsuario no duplica rol existente', async () => {
    const usuario = {
      _id: usuarioId,
      roles: ['USUARIO', 'INQUILINO'],
      save: async () => {},
      toObject() {
        return { _id: this._id, roles: this.roles };
      },
    };
    Usuario.findById = async () => usuario;

    const req = { params: { id: usuarioId }, body: { agregar: ['INQUILINO'] } };
    const res = mockRes();

    await agregarRolesUsuario(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(usuario.roles.filter((r) => r === 'INQUILINO').length, 1);
  });

  it('loginUsuario valida el correo antes de consultar la base de datos', async () => {
    let consulto = false;
    Usuario.findOne = async () => {
      consulto = true;
      return null;
    };
    const res = mockRes();

    await loginUsuario({ body: { password: 'ClaveSinEmail' } }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(consulto, false);
  });
});
