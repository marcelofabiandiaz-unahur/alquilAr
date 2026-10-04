const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-bytes';
const Usuario = require('../../src/models/usuario');
const {
  registrarUsuario,
  agregarRolesUsuario,
  loginUsuario,
  obtenerSolicitudPropietario,
  solicitarRolPropietario,
  aprobarSolicitudPropietario,
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

  it('solicitarRolPropietario valida CUIT/CUIL de 11 dígitos', async () => {
    const res = mockRes();
    await solicitarRolPropietario({
      usuario: { id: usuarioId },
      body: { cbu_alias: 'mi.alias', cuit_cuil: '1234' },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.mensaje, /11 dígitos/);
  });

  it('solicitarRolPropietario guarda la solicitud sin asignar el rol', async () => {
    const usuario = {
      roles: ['USUARIO', 'INQUILINO'],
      save: async () => {},
    };
    Usuario.findById = async () => usuario;
    const res = mockRes();

    await solicitarRolPropietario({
      usuario: { id: usuarioId },
      body: { cbu_alias: 'mi.alias', cuit_cuil: '20-12345678-9' },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(usuario.solicitud_propietario.estado, 'PENDIENTE');
    assert.equal(usuario.solicitud_propietario.cbu_alias, 'mi.alias');
    assert.deepEqual(usuario.roles, ['USUARIO', 'INQUILINO']);
  });

  it('permite que una cuenta con solo rol INQUILINO solicite ser propietaria', async () => {
    const usuario = {
      roles: ['INQUILINO'],
      save: async () => {},
    };
    Usuario.findById = async () => usuario;
    const res = mockRes();

    await solicitarRolPropietario({
      usuario: { id: usuarioId },
      body: { cbu_alias: 'mi.alias', cuit_cuil: '20-12345678-9' },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(usuario.solicitud_propietario.estado, 'PENDIENTE');
  });

  it('no permite que una cuenta administradora solicite el rol propietario', async () => {
    Usuario.findById = async () => ({ roles: ['USUARIO', 'ADMINISTRADOR'] });
    const res = mockRes();

    await solicitarRolPropietario({
      usuario: { id: usuarioId },
      body: { cbu_alias: 'mi.alias', cuit_cuil: '20-12345678-9' },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('no permite generar una segunda solicitud pendiente', async () => {
    Usuario.findById = async () => ({
      roles: ['USUARIO'],
      solicitud_propietario: { estado: 'PENDIENTE' },
    });
    const res = mockRes();

    await solicitarRolPropietario({
      usuario: { id: usuarioId },
      body: { cbu_alias: 'mi.alias', cuit_cuil: '20123456789' },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('aprobarSolicitudPropietario asigna rol y activa los datos bancarios', async () => {
    const usuario = {
      roles: ['USUARIO'],
      solicitud_propietario: {
        cbu_alias: 'mi.alias',
        cuit_cuil: '20123456789',
        estado: 'PENDIENTE',
      },
      cbu_alias: undefined,
      cuit_cuil: undefined,
      save: async () => {},
      toObject() {
        return {
          roles: this.roles,
          cbu_alias: this.cbu_alias,
          cuit_cuil: this.cuit_cuil,
          solicitud_propietario: this.solicitud_propietario,
        };
      },
    };
    Usuario.findById = async () => usuario;
    const res = mockRes();

    await aprobarSolicitudPropietario({ params: { id: usuarioId } }, res);

    assert.equal(res.statusCode, 200);
    assert.ok(usuario.roles.includes('PROPIETARIO'));
    assert.equal(usuario.cbu_alias, 'mi.alias');
    assert.equal(usuario.cuit_cuil, '20123456789');
    assert.equal(usuario.solicitud_propietario.estado, 'APROBADA');
  });

  it('obtenerSolicitudPropietario devuelve únicamente la solicitud de la cuenta autenticada', async () => {
    const solicitud = { estado: 'PENDIENTE' };
    Usuario.findById = () => ({
      select: async (campos) => {
        assert.equal(campos, 'solicitud_propietario');
        return { solicitud_propietario: solicitud };
      },
    });
    const res = mockRes();

    await obtenerSolicitudPropietario({ usuario: { id: usuarioId } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.solicitud, solicitud);
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

  it('loginUsuario rechaza cuando la contraseña no coincide', async () => {
    const argon2 = require('argon2');
    const origVerify = argon2.verify;
    argon2.verify = async () => false;

    Usuario.findOne = async () => ({
      _id: usuarioId,
      email: 'propietario1@alquilar.com',
      password: 'hash',
    });

    const req = { body: { email: 'propietario1@alquilar.com', password: 'ClaveErronea' } };
    const res = mockRes();
    await loginUsuario(req, res);
    argon2.verify = origVerify;
    assert.equal(res.statusCode, 401);
  });

  it('loginUsuario valida la presencia del correo en la petición', async () => {
    let consulto = false;
    Usuario.findOne = async () => {
      consulto = true;
      return null;
    };
    const req = { body: { password: 'ClaveSinEmail' } };
    const res = mockRes();
    await loginUsuario(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(consulto, false);
  });

  it('loginUsuario valida la presencia de la contraseña en la petición', async () => {
    const req = { body: { email: 'propietario1@alquilar.com' } };
    const res = mockRes();
    await loginUsuario(req, res);
    assert.equal(res.statusCode, 400);
  });
});
