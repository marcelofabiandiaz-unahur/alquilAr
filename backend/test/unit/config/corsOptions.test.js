const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ORIGENES_PRODUCCION,
  crearOpcionesCors,
  esOrigenLocal,
  esProduccion,
  parsearOrigenes,
} = require('../../../src/config/corsOptions');

function evaluarOrigen(origen, env) {
  const { opciones } = crearOpcionesCors(env);
  let permitido;
  const resultado = opciones.origin(origen, (error, valor) => {
    assert.equal(error, null);
    permitido = valor;
  });
  assert.equal(resultado, undefined);
  return permitido;
}

describe('corsOptions', () => {
  it('permite el frontend de producción por defecto', () => {
    assert.deepEqual(ORIGENES_PRODUCCION, ['https://alquilar-app.onrender.com']);
    assert.equal(
      evaluarOrigen('https://alquilar-app.onrender.com', { NODE_ENV: 'production' }),
      true,
    );
  });

  it('rechaza localhost en producción en cualquier puerto', () => {
    const env = { NODE_ENV: 'production' };
    assert.equal(evaluarOrigen('http://localhost:5173', env), false);
    assert.equal(evaluarOrigen('http://localhost:4173', env), false);
    assert.equal(evaluarOrigen('http://127.0.0.1:5173', env), false);
  });

  it('rechaza orígenes desconocidos en producción', () => {
    assert.equal(
      evaluarOrigen('https://sitio-malicioso.example', { NODE_ENV: 'production' }),
      false,
    );
  });

  it('permite puertos variables de localhost solo en desarrollo', () => {
    const env = { NODE_ENV: 'development' };
    ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173', 'http://127.0.0.1:5173', 'http://localhost'].forEach((origen) => {
      assert.equal(evaluarOrigen(origen, env), true, `debería permitir ${origen}`);
    });
  });

  it('no confunde dominios parecidos con localhost en desarrollo', () => {
    const env = { NODE_ENV: 'development' };
    assert.equal(evaluarOrigen('http://localhost.evil.example:5173', env), false);
    assert.equal(evaluarOrigen('https://localhost:5173', env), false);
    assert.equal(evaluarOrigen('http://localhost.example', env), false);
    assert.equal(evaluarOrigen('http://192.168.0.10:5173', env), false);
  });

  it('agrega orígenes explícitos desde CORS_ORIGINS y normaliza espacios y barra final', () => {
    const env = {
      NODE_ENV: 'production',
      CORS_ORIGINS: ' https://app.example.com/,https://admin.example.com ',
    };
    const { origenes } = crearOpcionesCors(env);
    assert.ok(origenes.includes('https://app.example.com'));
    assert.ok(origenes.includes('https://admin.example.com'));
    assert.equal(evaluarOrigen('https://app.example.com', env), true);
    assert.equal(evaluarOrigen('https://admin.example.com', env), true);
    assert.equal(evaluarOrigen('https://otro.example.com', env), false);
  });

  it('ignora entradas vacías de CORS_ORIGINS', () => {
    const env = { CORS_ORIGINS: ' , ,https://app.example.com, ' };
    assert.deepEqual(parsearOrigenes(env.CORS_ORIGINS), ['https://app.example.com']);
  });

  it('permite requests sin header Origin', () => {
    assert.equal(evaluarOrigen(undefined, { NODE_ENV: 'production' }), true);
    assert.equal(evaluarOrigen('', { NODE_ENV: 'production' }), true);
  });

  it('normaliza la barra final del origen entrante', () => {
    assert.equal(
      evaluarOrigen('https://alquilar-app.onrender.com/', { NODE_ENV: 'production' }),
      true,
    );
  });

  it('no habilita credentials porque la autenticación usa Bearer', () => {
    const { opciones } = crearOpcionesCors({});
    assert.equal(opciones.credentials, undefined);
  });

  it('detecta producción por NODE_ENV o por RENDER', () => {
    assert.equal(esProduccion({ NODE_ENV: 'production' }), true);
    assert.equal(esProduccion({ RENDER: 'true' }), true);
    assert.equal(esProduccion({ NODE_ENV: 'development' }), false);
    assert.equal(esProduccion({}), false);
  });

  it('reconoce solo orígenes HTTP locales válidos', () => {
    assert.equal(esOrigenLocal('http://localhost:5173'), true);
    assert.equal(esOrigenLocal('http://127.0.0.1:8080'), true);
    assert.equal(esOrigenLocal('http://localhost'), true);
    assert.equal(esOrigenLocal('https://localhost:5173'), false);
    assert.equal(esOrigenLocal('http://localhost:5173/'), true);
    assert.equal(esOrigenLocal('http://localhost:5173/path'), false);
    assert.equal(esOrigenLocal(null), false);
  });
});
