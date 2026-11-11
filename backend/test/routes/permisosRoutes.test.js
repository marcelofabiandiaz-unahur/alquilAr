const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const authRoutes = require('../../src/routes/authRoutes');
const propiedadRoutes = require('../../src/routes/propiedadRoutes');
const contratoRoutes = require('../../src/routes/contratoRoutes');
const pagoRoutes = require('../../src/routes/pagoRoutes');
const gastoRoutes = require('../../src/routes/gastoRoutes');
const reclamoRoutes = require('../../src/routes/reclamoRoutes');
const agrupamientoRoutes = require('../../src/routes/agrupamientoRoutes');

const obtenerRuta = (router, metodo, path) => router.stack.find((layer) =>
  layer.route
  && layer.route.path === path
  && layer.route.methods[metodo]);

const obtenerPermiso = (router, metodo, path) => {
  const ruta = obtenerRuta(router, metodo, path);
  assert.ok(ruta, `No se encontró la ruta ${metodo.toUpperCase()} ${path}`);
  return ruta.route.stack.map((layer) => layer.handle.permiso).find(Boolean);
};

describe('permisos declarados en las rutas', () => {
  it('protege la administración de usuarios', () => {
    assert.equal(obtenerPermiso(authRoutes, 'get', '/'), 'VER_USUARIOS');
    assert.equal(obtenerPermiso(authRoutes, 'patch', '/:id/roles'), 'GESTIONAR_ROLES');
    assert.equal(
      obtenerPermiso(authRoutes, 'patch', '/:id/solicitud-propietario/aprobar'),
      'APROBAR_PROPIETARIO',
    );
  });

  it('protege la gestión de propiedades y expone el catálogo de disponibles', () => {
    assert.equal(obtenerPermiso(propiedadRoutes, 'post', '/'), 'GESTIONAR_PROPIEDADES');
    assert.equal(obtenerPermiso(propiedadRoutes, 'put', '/:id'), 'GESTIONAR_PROPIEDADES');
    assert.equal(obtenerPermiso(propiedadRoutes, 'delete', '/:id'), 'GESTIONAR_PROPIEDADES');
    assert.equal(
      obtenerPermiso(propiedadRoutes, 'get', '/disponibles'),
      'VER_PROPIEDADES_DISPONIBLES',
    );
  });

  it('declara /disponibles antes de /:id y exige token', () => {
    const rutas = propiedadRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);
    assert.ok(rutas.indexOf('/disponibles') >= 0);
    assert.ok(rutas.indexOf('/disponibles') < rutas.indexOf('/:id'));
    assert.ok(
      propiedadRoutes.stack.some((layer) => layer.handle?.name === 'verificarToken'),
      'propiedadRoutes debe aplicar verificarToken',
    );
  });

  it('protege contratos, pagos, gastos y reclamos según el rol', () => {
    assert.equal(obtenerPermiso(contratoRoutes, 'post', '/'), 'GESTIONAR_CONTRATOS');
    assert.equal(obtenerPermiso(contratoRoutes, 'patch', '/:id/finalizar'), 'GESTIONAR_CONTRATOS');

    assert.equal(obtenerPermiso(pagoRoutes, 'post', '/'), 'GESTIONAR_PAGOS');
    assert.equal(
      obtenerPermiso(pagoRoutes, 'post', '/:id/comprobantes'),
      'SUBIR_COMPROBANTE_PAGO',
    );
    assert.equal(
      obtenerPermiso(pagoRoutes, 'patch', '/:id/confirmar'),
      'GESTIONAR_PAGOS',
    );

    assert.equal(obtenerPermiso(gastoRoutes, 'post', '/'), 'GESTIONAR_GASTOS');
    assert.equal(obtenerPermiso(reclamoRoutes, 'post', '/'), 'CREAR_RECLAMO');
    assert.equal(
      obtenerPermiso(reclamoRoutes, 'patch', '/:id/estado'),
      'GESTIONAR_RECLAMOS',
    );
  });

  it('protege la gestión de agrupamientos', () => {
    assert.equal(obtenerPermiso(agrupamientoRoutes, 'post', '/'), 'GESTIONAR_AGRUPAMIENTOS');
    assert.equal(
      obtenerPermiso(agrupamientoRoutes, 'delete', '/:id'),
      'ELIMINAR_AGRUPAMIENTO',
    );
  });

  it('elimina las rutas duplicadas sin uso', () => {
    assert.equal(obtenerRuta(pagoRoutes, 'get', '/inquilino'), undefined);
    assert.equal(obtenerRuta(pagoRoutes, 'patch', '/:id/comprobante'), undefined);
    assert.equal(obtenerRuta(reclamoRoutes, 'get', '/inquilino'), undefined);
  });
});
