const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseGaranteAssetUrl,
  parsePropiedadImageUrl,
  parsePagoAssetUrl,
  esReciboValido,
} = require('../../../src/utils/cloudinaryAssets');

describe('cloudinaryAssets', () => {
  let cloudNameOriginal;

  beforeEach(() => {
    cloudNameOriginal = process.env.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  });

  afterEach(() => {
    if (cloudNameOriginal === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = cloudNameOriginal;
  });

  it('parsea URL de imagen del folder de garantes quitando la extensión', () => {
    assert.deepEqual(
      parseGaranteAssetUrl(
        'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/recibo.jpg',
      ),
      {
        publicId: 'alquilar/garantes/recibo',
        resourceType: 'image',
        format: 'jpg',
        garanteFolder: 'alquilar/garantes/',
      },
    );
  });

  it('mantiene la extensión de un PDF raw legado', () => {
    assert.deepEqual(
      parseGaranteAssetUrl(
        'https://res.cloudinary.com/demo-cloud/raw/upload/v123/recibo.pdf',
      ),
      {
        publicId: 'recibo.pdf',
        resourceType: 'raw',
        format: 'pdf',
        garanteFolder: 'alquilar/garantes/',
      },
    );
  });

  it('solo permite borrar imágenes del folder de propiedades del cloud configurado', () => {
    assert.deepEqual(
      parsePropiedadImageUrl(
        'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/propiedades/frente.jpg',
      ),
      { publicId: 'alquilar/propiedades/frente.jpg', resourceType: 'image' },
    );
    assert.equal(
      parsePropiedadImageUrl('https://res.cloudinary.com/otro/image/upload/v123/alquilar/propiedades/frente.jpg'),
      null,
    );
    assert.equal(
      parsePropiedadImageUrl('https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/gastos/factura.jpg'),
      null,
    );
    assert.equal(
      parsePropiedadImageUrl('https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/propiedades/../otra.jpg'),
      null,
    );
  });

  it('limita los comprobantes de pago a la carpeta propia y normaliza la extensión', () => {
    assert.deepEqual(
      parsePagoAssetUrl(
        'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/pagos/recibo.pdf',
      ),
      { publicId: 'alquilar/pagos/recibo', resourceType: 'image', format: 'pdf' },
    );
    assert.equal(
      parsePagoAssetUrl('https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/recibo.pdf'),
      null,
    );
    assert.equal(
      parsePagoAssetUrl('https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/propiedades/frente.jpg'),
      null,
    );
    assert.deepEqual(
      parsePagoAssetUrl('https://res.cloudinary.com/demo-cloud/raw/upload/v123/alquilar/pagos/recibo.pdf'),
      { publicId: 'alquilar/pagos/recibo.pdf', resourceType: 'raw', format: 'pdf' },
    );
  });

  it('rechaza URL de otro cloud, recursos no permitidos y parámetros externos', () => {
    assert.equal(parseGaranteAssetUrl('https://res.cloudinary.com/otro/image/upload/v123/recibo.jpg'), null);
    assert.equal(parseGaranteAssetUrl('https://evil.example/demo-cloud/image/upload/v123/recibo.jpg'), null);
    assert.equal(parseGaranteAssetUrl('https://res.cloudinary.com/demo-cloud/video/upload/v123/recibo.jpg'), null);
    assert.equal(parseGaranteAssetUrl('https://res.cloudinary.com/demo-cloud/image/upload/v123/recibo.jpg?x=1'), null);
  });

  it('rechaza segmentos de ruta ambiguos o de traversal', () => {
    assert.equal(
      parseGaranteAssetUrl('https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/../otro.jpg'),
      null,
    );
    assert.equal(
      parseGaranteAssetUrl('https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar%2Fgarantes%2Frecibo.jpg'),
      null,
    );
  });

  it('valida la firma de PDF e imágenes en vez de confiar solo en MIME', () => {
    assert.equal(esReciboValido({
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7'),
    }), true);
    assert.equal(esReciboValido({
      mimetype: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    }), true);
    assert.equal(esReciboValido({
      mimetype: 'application/pdf',
      buffer: Buffer.from('no es un pdf'),
    }), false);
    assert.equal(esReciboValido({
      mimetype: 'application/x-msdownload',
      buffer: Buffer.from('MZ'),
    }), false);
  });
});
