const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../../src/routes/dashboardRoutes');

test('el resumen del dashboard requiere autenticar el token antes de ejecutar el controlador', () => {
  const ruta = router.stack.find((layer) => layer.route?.path === '/resumen');
  assert.ok(ruta);
  assert.equal(ruta.route.methods.get, true);
  assert.equal(ruta.route.stack[0].handle.name, 'verificarToken');
  assert.equal(ruta.route.stack[1].handle.name, 'obtenerResumen');
});
