const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ejecutarControlador,
  codigoSegunStatus,
} = require('../../../src/utils/controllerInvoker');
const { CODIGOS_IA } = require('../../../src/utils/aiErrors');

const controladorQueResponde = (statusCode, cuerpo) => async (_req, res) => {
  res.status(statusCode).json(cuerpo);
};

test('ejecutarControlador devuelve el cuerpo cuando el controlador responde 200', async () => {
  const respuesta = await ejecutarControlador(
    controladorQueResponde(200, { success: true, data: [{ id: 1 }] }),
    { usuario: { id: 'user-1' } },
  );

  assert.deepEqual(respuesta, { success: true, data: [{ id: 1 }] });
});

test('ejecutarControlador conserva el 403 y lo traduce a SIN_PERMISO', async () => {
  await assert.rejects(
    ejecutarControlador(
      controladorQueResponde(403, { success: false, message: 'No tenés permiso para consultar pagos.' }),
      {},
    ),
    (error) => {
      assert.equal(error.name, 'AiError');
      assert.equal(error.codigo, CODIGOS_IA.SIN_PERMISO);
      assert.equal(error.status, 403);
      assert.match(error.message, /permiso para consultar pagos/i);
      return true;
    },
  );
});

test('ejecutarControlador distingue validación, no encontrado e interno', async () => {
  await assert.rejects(
    ejecutarControlador(controladorQueResponde(400, { mensaje: 'id inválido.' }), {}),
    (error) => error.codigo === CODIGOS_IA.VALIDACION && error.status === 400,
  );

  await assert.rejects(
    ejecutarControlador(controladorQueResponde(404, { mensaje: 'No encontrado.' }), {}),
    (error) => error.codigo === CODIGOS_IA.NO_ENCONTRADO && error.status === 404,
  );

  await assert.rejects(
    ejecutarControlador(controladorQueResponde(500, { error: 'Falla interna.' }), {}),
    (error) => error.codigo === CODIGOS_IA.INTERNO && error.status === 500,
  );
});

test('ejecutarControlador propaga los errores lanzados por el controlador', async () => {
  const falla = new Error('explotó la base');

  await assert.rejects(
    ejecutarControlador(async () => { throw falla; }, {}),
    (error) => error === falla,
  );
});

test('codigoSegunStatus clasifica los códigos HTTP relevantes', () => {
  assert.equal(codigoSegunStatus(401), CODIGOS_IA.SIN_PERMISO);
  assert.equal(codigoSegunStatus(403), CODIGOS_IA.SIN_PERMISO);
  assert.equal(codigoSegunStatus(404), CODIGOS_IA.NO_ENCONTRADO);
  assert.equal(codigoSegunStatus(400), CODIGOS_IA.VALIDACION);
  assert.equal(codigoSegunStatus(409), CODIGOS_IA.VALIDACION);
  assert.equal(codigoSegunStatus(422), CODIGOS_IA.VALIDACION);
  assert.equal(codigoSegunStatus(429), CODIGOS_IA.LIMITE_PROVEEDOR);
  assert.equal(codigoSegunStatus(500), CODIGOS_IA.INTERNO);
});
