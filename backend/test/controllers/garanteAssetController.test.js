const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Contrato = require('../../src/models/contrato');
const Propiedad = require('../../src/models/propiedad');
const cloudinaryConfig = require('../../src/config/cloudinary');
const {
  uploadGarante,
  eliminarReciboGarante,
  verReciboGarante,
} = require('../../src/controllers/garanteAssetController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, propiedadId, contratoId } = require('../helpers/fixtures/ids');

describe('garanteAssetController', () => {
  let original;

  beforeEach(() => {
    original = {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
      contratoFind: Contrato.find,
      contratoFindById: Contrato.findById,
      propiedadFindById: Propiedad.findById,
      getCloudinary: cloudinaryConfig.getCloudinary,
      fetch: global.fetch,
    };
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries({
      CLOUDINARY_CLOUD_NAME: original.cloudName,
      CLOUDINARY_API_KEY: original.apiKey,
      CLOUDINARY_API_SECRET: original.apiSecret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    Contrato.find = original.contratoFind;
    Contrato.findById = original.contratoFindById;
    Propiedad.findById = original.propiedadFindById;
    cloudinaryConfig.getCloudinary = original.getCloudinary;
    global.fetch = original.fetch;
  });

  it('sube el recibo firmado como recurso image y lo etiqueta con su propietario', async () => {
    let uploadOptions;
    let uploadedBuffer;
    cloudinaryConfig.getCloudinary = () => ({
      uploader: {
        upload_stream(options, callback) {
          uploadOptions = options;
          return {
            end(buffer) {
              uploadedBuffer = buffer;
              callback(null, {
                secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/recibo.pdf',
                public_id: 'alquilar/garantes/recibo',
              });
            },
          };
        },
      },
    });

    const req = {
      file: { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7') },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    };
    const res = mockRes();

    await uploadGarante(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.url.endsWith('.pdf'), true);
    assert.equal(uploadOptions.resource_type, 'image');
    assert.equal(uploadOptions.folder, 'alquilar/garantes');
    assert.ok(uploadOptions.tags.includes(`uploader_${usuarioId}`));
    assert.equal(uploadedBuffer.toString(), '%PDF-1.7');
  });

  it('rechaza archivos que solo falsifican el MIME type', async () => {
    const res = mockRes();
    await uploadGarante({
      file: { mimetype: 'application/pdf', buffer: Buffer.from('not a pdf') },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);
    assert.equal(res.statusCode, 400);
  });

  it('elimina recurso asociado solo si el usuario es propietario y quita su referencia', async () => {
    const url = 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/recibo.jpg';
    const contrato = {
      _id: contratoId,
      id_propiedad: propiedadId,
      garante: { recibo: url },
      save: async () => {},
    };
    let destruido = false;
    Contrato.find = async (filtro) => {
      assert.deepEqual(filtro, { 'garante.recibo': url });
      return [contrato];
    };
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    cloudinaryConfig.getCloudinary = () => ({
      api: {
        resource: async (publicId, options) => {
          assert.equal(publicId, 'alquilar/garantes/recibo');
          assert.equal(options.resource_type, 'image');
          return { public_id: publicId };
        },
      },
      uploader: {
        destroy: async () => {
          destruido = true;
          return { result: 'ok' };
        },
      },
    });

    const res = mockRes();
    await eliminarReciboGarante({
      body: { url },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(destruido, true);
    assert.equal(contrato.garante.recibo, '');
  });

  it('rechaza el borrado de un recibo de contrato ajeno antes de llamar a Cloudinary', async () => {
    const url = 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/recibo.jpg';
    Contrato.find = async () => [{ id_propiedad: propiedadId, garante: { recibo: url } }];
    Propiedad.findById = async () => ({ id_propietario: 'aaaaaaaaaaaaaaaaaaaaaaaa' });
    cloudinaryConfig.getCloudinary = () => {
      throw new Error('No debe contactar Cloudinary si falla la autorización.');
    };

    const res = mockRes();
    await eliminarReciboGarante({
      body: { url },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('solo permite a quien subió borrar un recurso todavía no asociado', async () => {
    const url = 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/recibo.jpg';
    Contrato.find = async () => [];
    cloudinaryConfig.getCloudinary = () => ({
      api: { resource: async () => ({ public_id: 'alquilar/garantes/recibo', tags: [] }) },
      uploader: { destroy: async () => assert.fail('No se debe eliminar un recurso ajeno.') },
    });

    const res = mockRes();
    await eliminarReciboGarante({
      body: { url },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('sirve el recibo mediante URL privada temporal al propietario autorizado', async () => {
    const contrato = {
      _id: contratoId,
      id_inquilino: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      id_propiedad: { id_propietario: usuarioId },
      garante: {
        recibo: 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/recibo.pdf',
      },
    };
    Contrato.findById = () => ({
      populate: async (campo) => {
        assert.equal(campo, 'id_propiedad');
        return contrato;
      },
    });

    let signedOptions;
    cloudinaryConfig.getCloudinary = () => ({
      utils: {
        private_download_url(publicId, format, options) {
          assert.equal(publicId, 'alquilar/garantes/recibo');
          assert.equal(format, 'pdf');
          signedOptions = options;
          return 'https://api.cloudinary.com/private-download';
        },
      },
    });

    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.cloudinary.com/private-download');
      assert.ok(options.signal);
      return {
        ok: true,
        arrayBuffer: async () => Buffer.from('%PDF-1.7'),
      };
    };

    const res = mockRes();
    res.headers = {};
    res.set = function set(headers) {
      this.headers = headers;
      return this;
    };
    res.send = function send(body) {
      this.body = body;
      return this;
    };

    await verReciboGarante({
      params: { id: contratoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    assert.equal(res.headers['Content-Disposition'], 'inline; filename="recibo-garante.pdf"');
    assert.equal(res.body.toString(), '%PDF-1.7');
    assert.equal(signedOptions.attachment, false);
    assert.ok(signedOptions.expires_at > Math.floor(Date.now() / 1000));
  });

  it('no entrega el recibo si el contrato pertenece a otro propietario', async () => {
    Contrato.findById = () => ({
      populate: async () => ({
        _id: contratoId,
        id_inquilino: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        id_propiedad: { id_propietario: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
        garante: {
          recibo: 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/recibo.pdf',
        },
      }),
    });
    global.fetch = async () => assert.fail('No se debe descargar el recibo de un contrato ajeno.');

    const res = mockRes();
    await verReciboGarante({
      params: { id: contratoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('responde con error explícito cuando Cloudinary no permite descargar el recibo', async () => {
    Contrato.findById = () => ({
      populate: async () => ({
        _id: contratoId,
        id_inquilino: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        id_propiedad: { id_propietario: usuarioId },
        garante: {
          recibo: 'https://res.cloudinary.com/demo-cloud/raw/upload/v123/recibo.pdf',
        },
      }),
    });
    cloudinaryConfig.getCloudinary = () => ({
      utils: { private_download_url: () => 'https://api.cloudinary.com/private-download' },
    });
    global.fetch = async () => ({ ok: false, status: 401 });

    const res = mockRes();
    await verReciboGarante({
      params: { id: contratoId },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 502);
    assert.match(res.body.mensaje, /Cloudinary no permitió leer el recibo/);
  });
});
