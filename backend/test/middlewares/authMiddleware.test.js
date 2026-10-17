const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'test-only-jwt-secret-at-least-32-bytes';
process.env.JWT_SECRET = JWT_SECRET;
const { getJwtSecret } = require('../../src/config/jwtSecret');
const { verificarToken, verificarRol } = require('../../src/middlewares/authMiddleware');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId } = require('../helpers/fixtures/ids');

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
  it('rechaza request sin Authorization con 403', () => {
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;

    verificarToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.mensaje, 'Acceso denegado. No hay token provisto.');
  });

  it('rechaza token invalido con 401', () => {
    const req = { headers: { authorization: 'Bearer token-invalido' } };
    const res = mockRes();
    let nextCalled = false;

    verificarToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.mensaje, 'Token inválido o expirado.');
  });

  it('acepta token valido y llama next', () => {
    const token = jwt.sign({ id: usuarioId, roles: ['ADMINISTRADOR'] }, JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;

    verificarToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.usuario.roles, ['ADMINISTRADOR']);
    assert.equal(req.usuario._id, usuarioId);
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
