const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ROLES, ROLES_VALIDOS, PERMISOS } = require('../../../src/config/permisos');
const Usuario = require('../../../src/models/usuario');

describe('configuración de permisos', () => {
  it('expone roles válidos únicos y alineados con el modelo', () => {
    assert.deepEqual(ROLES_VALIDOS, Object.values(ROLES));
    assert.equal(new Set(ROLES_VALIDOS).size, ROLES_VALIDOS.length);
    assert.deepEqual(Usuario.schema.path('roles').options.enum, ROLES_VALIDOS);
  });

  it('todo permiso tiene roles válidos y no vacíos', () => {
    for (const [nombre, roles] of Object.entries(PERMISOS)) {
      assert.ok(Array.isArray(roles), `${nombre} debe ser un array`);
      assert.ok(roles.length > 0, `${nombre} no puede quedar vacío`);
      for (const rol of roles) {
        assert.ok(ROLES_VALIDOS.includes(rol), `${nombre} contiene un rol inválido: ${rol}`);
      }
    }
  });

  it('mantiene los permisos críticos en los roles esperados', () => {
    assert.deepEqual(PERMISOS.VER_USUARIOS, [ROLES.ADMINISTRADOR]);
    assert.deepEqual(PERMISOS.VER_GESTORES_ASIGNABLES, [ROLES.PROPIETARIO]);
    assert.deepEqual(PERMISOS.GESTIONAR_ROLES, [ROLES.ADMINISTRADOR]);
    assert.deepEqual(PERMISOS.GESTIONAR_PROPIEDADES, [ROLES.PROPIETARIO]);
    assert.deepEqual(PERMISOS.GESTIONAR_PAGOS, [ROLES.PROPIETARIO, ROLES.ADMINISTRADOR]);
    assert.deepEqual(PERMISOS.SUBIR_COMPROBANTE_PAGO, [ROLES.INQUILINO]);
    assert.deepEqual(PERMISOS.CREAR_RECLAMO, [ROLES.INQUILINO]);
    assert.deepEqual(PERMISOS.GESTIONAR_RECLAMOS, [ROLES.PROPIETARIO]);
    assert.deepEqual(PERMISOS.VER_AGRUPAMIENTOS, [ROLES.USUARIO, ROLES.PROPIETARIO, ROLES.INQUILINO]);
    assert.deepEqual(PERMISOS.GESTIONAR_AGRUPAMIENTOS, [ROLES.PROPIETARIO]);
    assert.deepEqual(PERMISOS.ELIMINAR_AGRUPAMIENTO, [ROLES.PROPIETARIO]);
  });
});
