const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../../src/middlewares/errorHandler');

const mockRes = () => ({
  headersSent: false,
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('usa el status del parser de Express para errores de cliente', () => {
  const res = mockRes();
  errorHandler({ status: 400, message: 'JSON inválido' }, {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.mensaje, 'JSON inválido');
});

test('usa statusCode cuando está definido y rechaza códigos fuera de rango', () => {
  const res = mockRes();
  errorHandler({ status: 404, statusCode: 422, message: 'Validación' }, {}, res, () => {});
  assert.equal(res.statusCode, 422);

  const invalido = mockRes();
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    errorHandler({ status: 200, message: 'No es un status de error' }, {}, invalido, () => {});
  } finally {
    console.error = errorOriginal;
  }
  assert.equal(invalido.statusCode, 500);
});

test('delega al siguiente handler cuando la respuesta ya comenzó', () => {
  const res = mockRes();
  res.headersSent = true;
  const error = new Error('Error después del envío');
  let errorDelegado;
  errorHandler(error, {}, res, (recibido) => {
    errorDelegado = recibido;
  });
  assert.equal(errorDelegado, error);
  assert.equal(res.statusCode, null);
});
