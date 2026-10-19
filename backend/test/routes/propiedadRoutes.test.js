const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../../src/routes/propiedadRoutes');

test('la ruta pública de propiedades disponibles precede al middleware de autenticación', () => {
  const indiceCatalogo = router.stack.findIndex((layer) => layer.route?.path === '/disponibles');
  const indiceAutenticacion = router.stack.findIndex((layer) => layer.name === 'verificarToken');

  assert.notEqual(indiceCatalogo, -1);
  assert.notEqual(indiceAutenticacion, -1);
  assert.ok(indiceCatalogo < indiceAutenticacion);
  assert.equal(router.stack[indiceCatalogo].route.methods.get, true);
});
