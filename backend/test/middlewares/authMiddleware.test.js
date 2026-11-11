const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'test-only-jwt-secret-at-least-32-bytes';
process.env.JWT_SECRET = JWT_SECRET;
const { getJwtSecret } = require('../../src/config/jwtSecret');
const { verificarToken, verificarRol, verificarPermiso } = require('../../src/middlewares/authMiddleware');
const Usuario = require('../../src/models/usuario');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId } = require('../helpers/fixtures/ids');

const usuarioActivo = (roles = ['ADMINISTRADOR']) => ({
  _id: usuarioId,
  roles,
  estado: 'ACTIVO',
});

describe('getJwtSecret', () => {
  it('rechaza una clave ausente o demasiado corta', () => {
    const secretOriginal = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      assert.throws(() => getJwtSecret(), /JWT_SECRET debe estar definida/);
      process.env.JWT_SECRET = 'short';
      assert.throws(() => getJwtSecret(), /al menos 32 bytes/);
    } finally {
      process.env.JWT_SECRET = secretOriginal;
    }
  });

  it('devuelve una clave configurada de al menos 32 bytes', () => {
    assert.equal(getJwtSecret(), JWT_SECRET);
  });
});

describe('verificarToken', () => {
  let originalFindById;

  beforeEach(() => {
    originalFindById = Usuario.findById;
  });

  afterEach(() => {
    Usuario.findById = originalFindById;
  });

  it('rechaza request sin Authorization con 401', async () => {
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;

    await verificarToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.mensaje, 'No autenticado. Token no provisto.');
  });

  it('rechaza token invalido con 401', async () => {
    const req = { headers: { authorization: 'Bearer token-invalido' } };
    const res = mockRes();
    let nextCalled = false;

    await verificarToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.mensaje, 'Token inválido o expirado.');
  });

  it('acepta token valido y resuelve los roles actuales de la base', async () => {
    Usuario.findById = async () => usuarioActivo(['ADMINISTRADOR']);
    const token = jwt.sign(
      { id: usuarioId, roles: ['INQUILINO'] },
      JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;

    await verificarToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.usuario.roles, ['ADMINISTRADOR']);
    assert.equal(req.usuario.id, usuarioId);
    assert.equal(String(req.usuario._id), usuarioId);
  });

  it('rechaza un token de un usuario que ya no existe', async () => {
    Usuario.findById = async () => null;
    const token = jwt.sign({ id: usuarioId, roles: ['ADMINISTRADOR'] }, JWT_SECRET);
    const res = mockRes();

    await verificarToken({ headers: { authorization: `Bearer ${token}` } }, res, () => {});

    assert.equal(res.statusCode, 401);
  });

  it('rechaza un usuario inactivo aunque el token siga vigente', async () => {
    Usuario.findById = async () => ({ ...usuarioActivo(), estado: 'INACTIVO' });
    const token = jwt.sign({ id: usuarioId, roles: ['ADMINISTRADOR'] }, JWT_SECRET);
    const res = mockRes();

    await verificarToken({ headers: { authorization: `Bearer ${token}` } }, res, () => {});

    assert.equal(res.statusCode, 401);
  });

  it('responde 503 si falla la consulta a la base', async () => {
    Usuario.findById = async () => {
      throw new Error('Mongo no disponible');
    };
    const token = jwt.sign({ id: usuarioId, roles: ['ADMINISTRADOR'] }, JWT_SECRET);
    const res = mockRes();
    const errorOriginal = console.error;
    console.error = () => {};
    try {
      await verificarToken({ headers: { authorization: `Bearer ${token}` } }, res, () => {});
    } finally {
      console.error = errorOriginal;
    }

    assert.equal(res.statusCode, 503);
  });
});

describe('verificarRol', () => {
  it('rechaza si no hay roles en el payload', () => {
    const middleware = verificarRol(['ADMINISTRADOR']);
    const req = { usuario: { id: usuarioId } };
    const res = mockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.mensaje, 'No se encontraron roles del usuario.');
  });

  it('rechaza INQUILINO en ruta de administrador', () => {
    const middleware = verificarRol(['ADMINISTRADOR']);
    const req = { usuario: { id: usuarioId, roles: ['INQUILINO'] } };
    const res = mockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.mensaje, 'No tienes los permisos necesarios para esta acción.');
  });

  it('permite ADMINISTRADOR en ruta de administrador', () => {
    const middleware = verificarRol(['ADMINISTRADOR']);
    const req = { usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] } };
    const res = mockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });
});

describe('verificarPermiso', () => {
  it('lanza si el permiso no existe en la configuración', () => {
    assert.throws(() => verificarPermiso('PERMISO_INEXISTENTE'), /Permiso desconocido/);
  });

  it('permite un rol configurado para el permiso', () => {
    const middleware = verificarPermiso('GESTIONAR_PAGOS');
    const req = { usuario: { id: usuarioId, roles: ['PROPIETARIO'] } };
    const res = mockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(middleware.permiso, 'GESTIONAR_PAGOS');
    assert.equal(nextCalled, true);
  });

  it('rechaza un rol no configurado para el permiso', () => {
    const middleware = verificarPermiso('CREAR_RECLAMO');
    const req = { usuario: { id: usuarioId, roles: ['PROPIETARIO'] } };
    const res = mockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });
});
