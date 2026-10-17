const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  esObjectIdValido,
  resolverIdReferencia,
  esAdmin,
  esPropietario,
  esInquilino,
  perteneceAlPropietario,
  puedeVerContrato,
  puedeCambiarEstadoPropiedad,
  debeLiberarPropiedad,
  construirFiltroContratosMixto,
  propiedadPermiteContratoVigente,
} = require('../../../src/utils/recursosHelpers');
const { usuarioId, otroId, propiedadId } = require('../../helpers/fixtures/ids');

describe('esObjectIdValido', () => {
  it('rechaza strings invalidos', () => {
    assert.equal(esObjectIdValido('abc'), false);
    assert.equal(esObjectIdValido(''), false);
    assert.equal(esObjectIdValido(null), false);
  });

  it('acepta ObjectId valido de 24 hex', () => {
    assert.equal(esObjectIdValido(usuarioId), true);
  });
});

describe('resolverIdReferencia', () => {
  it('resuelve ObjectId directo', () => {
    const id = new mongoose.Types.ObjectId(usuarioId);
    assert.equal(resolverIdReferencia(id), usuarioId);
  });

  it('resuelve documento populado', () => {
    assert.equal(resolverIdReferencia({ _id: usuarioId }), usuarioId);
  });
});

describe('roles', () => {
  it('detecta roles del usuario', () => {
    assert.equal(esAdmin(['ADMINISTRADOR']), true);
    assert.equal(esPropietario(['PROPIETARIO']), true);
    assert.equal(esInquilino(['INQUILINO']), true);
    assert.equal(esPropietario(['USUARIO']), false);
  });
});

describe('perteneceAlPropietario', () => {
  it('compara id_propietario con usuario', () => {
    const propiedad = { id_propietario: usuarioId };
    assert.equal(perteneceAlPropietario(propiedad, usuarioId), true);
    assert.equal(perteneceAlPropietario(propiedad, otroId), false);
  });
});

describe('puedeVerContrato', () => {
  const propiedad = { id_propietario: otroId };

  it('permite admin', () => {
    const contrato = { id_inquilino: usuarioId };
    assert.equal(puedeVerContrato(contrato, propiedad, usuarioId, ['ADMINISTRADOR']), true);
  });

  it('permite inquilino con referencia populada', () => {
    const contrato = { id_inquilino: { _id: usuarioId, nombre: 'Test' } };
    assert.equal(puedeVerContrato(contrato, propiedad, usuarioId, ['INQUILINO']), true);
  });

  it('niega usuario sin relacion', () => {
    const contrato = { id_inquilino: otroId };
    assert.equal(puedeVerContrato(contrato, propiedad, usuarioId, ['INQUILINO']), false);
  });
});

describe('puedeCambiarEstadoPropiedad', () => {
  it('rechaza INACTIVA y ALQUILADA via PUT', () => {
    assert.equal(puedeCambiarEstadoPropiedad('DISPONIBLE', 'INACTIVA').ok, false);
    assert.equal(puedeCambiarEstadoPropiedad('DISPONIBLE', 'ALQUILADA').ok, false);
  });

  it('permite EN_MANTENIMIENTO y DISPONIBLE', () => {
    assert.equal(puedeCambiarEstadoPropiedad('DISPONIBLE', 'EN_MANTENIMIENTO').ok, true);
    assert.equal(puedeCambiarEstadoPropiedad('EN_MANTENIMIENTO', 'DISPONIBLE').ok, true);
  });

  it('permite mismo estado sin cambio', () => {
    assert.equal(puedeCambiarEstadoPropiedad('DISPONIBLE', 'DISPONIBLE').ok, true);
  });

  it('rechaza estado invalido', () => {
    const result = puedeCambiarEstadoPropiedad('DISPONIBLE', 'FOO');
    assert.equal(result.ok, false);
    assert.match(result.mensaje, /Estado no v/);
  });
});

describe('propiedadPermiteContratoVigente', () => {
  it('permite DISPONIBLE y EN_MANTENIMIENTO', () => {
    assert.equal(propiedadPermiteContratoVigente('DISPONIBLE'), true);
    assert.equal(propiedadPermiteContratoVigente('EN_MANTENIMIENTO'), true);
  });

  it('rechaza ALQUILADA e INACTIVA', () => {
    assert.equal(propiedadPermiteContratoVigente('ALQUILADA'), false);
    assert.equal(propiedadPermiteContratoVigente('INACTIVA'), false);
  });
});

describe('debeLiberarPropiedad', () => {
  it('libera al salir de VIGENTE a estados cerrados o borrador', () => {
    assert.equal(debeLiberarPropiedad('VIGENTE', 'FINALIZADO'), true);
    assert.equal(debeLiberarPropiedad('VIGENTE', 'CANCELADO'), true);
    assert.equal(debeLiberarPropiedad('VIGENTE', 'BORRADOR'), true);
  });

  it('no libera si no era VIGENTE', () => {
    assert.equal(debeLiberarPropiedad('BORRADOR', 'CANCELADO'), false);
  });
});

describe('construirFiltroContratosMixto', () => {
  it('arma filtro $or para perfil mixto', () => {
    const ids = [propiedadId];
    const filtro = construirFiltroContratosMixto(usuarioId, ids);
    assert.deepEqual(filtro, {
      $or: [
        { id_propiedad: { $in: ids } },
        { id_inquilino: usuarioId },
      ],
    });
  });
});
