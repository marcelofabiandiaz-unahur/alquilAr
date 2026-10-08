const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Pago = require('../../src/models/pago');
const Contrato = require('../../src/models/contrato');
const Propiedad = require('../../src/models/propiedad');
const cloudinaryConfig = require('../../src/config/cloudinary');
const {
  crearPago,
  listarPagos,
  obtenerPago,
  registrarComprobante,
  subirComprobantes,
  eliminarComprobante,
  verComprobante,
  marcarComoPagado,
  actualizarPago,
  eliminarPago,
} = require('../../src/controllers/pagoController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, inquilinoId, propiedadId, contratoId } = require('../helpers/fixtures/ids');

describe('pagoController', () => {
  let original;

  beforeEach(() => {
    original = {
      pagoFind: Pago.find,
      pagoFindById: Pago.findById,
      pagoUpdateMany: Pago.updateMany,
      pagoBulkWrite: Pago.bulkWrite,
      pagoSave: Pago.prototype.save,
      contratoFind: Contrato.find,
      contratoFindById: Contrato.findById,
      propiedadFind: Propiedad.find,
      propiedadFindById: Propiedad.findById,
      getCloudinary: cloudinaryConfig.getCloudinary,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      fetch: global.fetch,
    };
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  });

  afterEach(() => {
    Pago.find = original.pagoFind;
    Pago.findById = original.pagoFindById;
    Pago.updateMany = original.pagoUpdateMany;
    Pago.bulkWrite = original.pagoBulkWrite;
    Pago.prototype.save = original.pagoSave;
    Contrato.find = original.contratoFind;
    Contrato.findById = original.contratoFindById;
    Propiedad.find = original.propiedadFind;
    Propiedad.findById = original.propiedadFindById;
    cloudinaryConfig.getCloudinary = original.getCloudinary;
    global.fetch = original.fetch;
    if (original.cloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = original.cloudName;
  });

  it('crea un pago desde el contrato y deriva importe y vencimiento del DER', async () => {
    Contrato.findById = async () => ({
      _id: contratoId,
      id_propiedad: propiedadId,
      id_inquilino: inquilinoId,
      dia_vencimiento: 10,
      monto_mensual: 250000,
      estado: 'VIGENTE',
    });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: usuarioId });
    Pago.prototype.save = async function save() {};
    const res = mockRes();

    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-11', monto_total: 1 },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.monto_total, 250000);
    assert.equal(res.body.data.mes_correspondiente, '202611');
    assert.equal(res.body.data.fecha_vencimiento.getDate(), 10);
  });

  it('rechaza creación por un inquilino', async () => {
    const res = mockRes();
    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-11' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);
    assert.equal(res.statusCode, 403);
  });

  it('limita la consulta de pagos a contratos del inquilino', async () => {
    Contrato.find = async () => [{ _id: contratoId, id_inquilino: inquilinoId }];
    Pago.updateMany = async () => ({ modifiedCount: 0 });
    Pago.bulkWrite = async () => ({ upsertedCount: 0 });
    let ordenamiento;
    let poblacion;
    Pago.find = () => ({
      populate: (configuracion) => {
        poblacion = configuracion;
        return {
        sort: async (sort) => {
          ordenamiento = sort;
          return [{ _id: 'pago', id_contrato: contratoId }];
        },
        };
      },
    });
    const res = mockRes();

    await listarPagos({ usuario: { id: inquilinoId, roles: ['INQUILINO'] }, query: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 1);
    assert.deepEqual(ordenamiento, { fecha_vencimiento: 1 });
    assert.deepEqual(poblacion.populate.populate, {
      path: 'id_propietario',
      select: 'cbu_alias cuit_cuil',
    });
  });

  it('migra comprobantes ya cargados al estado INGRESADO al listar', async () => {
    Contrato.find = async () => [{ _id: contratoId }];
    Pago.bulkWrite = async () => ({ upsertedCount: 0 });
    const filtrosActualizacion = [];
    Pago.updateMany = async (filtro, actualizacion) => {
      filtrosActualizacion.push({ filtro, actualizacion });
      return { modifiedCount: 0 };
    };
    Pago.find = () => ({
      populate: () => ({
        sort: async () => [],
      }),
    });
    const res = mockRes();

    await listarPagos({ usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] }, query: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filtrosActualizacion[0].filtro.estado, { $in: ['PENDIENTE', 'ATRASADO'] });
    assert.deepEqual(filtrosActualizacion[0].filtro.$or, [
      { comprobante_url: { $exists: true, $ne: '' } },
      { comprobantes: { $exists: true, $ne: [] } },
    ]);
    assert.deepEqual(filtrosActualizacion[0].actualizacion, { $set: { estado: 'INGRESADO' } });
  });

  it('permite que el inquilino del contrato cargue un comprobante', async () => {
    const pago = {
      id_contrato: contratoId,
      estado: 'PENDIENTE',
      save: async () => {},
    };
    Pago.findById = async () => pago;
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    const res = mockRes();

    await registrarComprobante({
      params: { id: '111111111111111111111111' },
      body: { comprobante_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/pagos/recibo.pdf' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(pago.comprobante_url, '');
    assert.deepEqual(pago.comprobantes, ['https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/pagos/recibo.pdf']);
    assert.equal(pago.estado, 'INGRESADO');
  });

  it('permite al inquilino cargar varios comprobantes juntos y deja el pago editable en INGRESADO', async () => {
    const pago = {
      _id: '111111111111111111111111',
      id_contrato: contratoId,
      fecha_vencimiento: new Date(Date.now() + 86400000),
      estado: 'PENDIENTE',
      comprobantes: [],
      comprobante_url: '',
      save: async () => {},
    };
    Pago.findById = async () => pago;
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    let uploaded = 0;
    cloudinaryConfig.getCloudinary = () => ({
      uploader: {
        upload_stream(options, callback) {
          assert.equal(options.folder, 'alquilar/pagos');
          return {
            end(buffer) {
              assert.equal(buffer.toString(), '%PDF-1.7');
              uploaded += 1;
              callback(null, {
                secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/pagos/recibo-${uploaded}.pdf`,
                public_id: `alquilar/pagos/recibo-${uploaded}`,
              });
            },
          };
        },
      },
    });
    const res = mockRes();

    await subirComprobantes({
      params: { id: pago._id },
      files: [
        { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7') },
        { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7') },
      ],
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(pago.estado, 'INGRESADO');
    assert.equal(pago.comprobantes.length, 2);
    assert.equal(pago.comprobante_url, '');
  });

  it('impide subir comprobantes a un pago confirmado', async () => {
    Pago.findById = async () => ({ id_contrato: contratoId, estado: 'PAGADO' });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    cloudinaryConfig.getCloudinary = () => assert.fail('No debe subir un pago confirmado.');
    const res = mockRes();

    await subirComprobantes({
      params: { id: '111111111111111111111111' },
      files: [{ mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7') }],
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('elimina un comprobante propio antes de la confirmación y recalcula el estado', async () => {
    const url = 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/pagos/recibo.jpg';
    const pago = {
      _id: '111111111111111111111111',
      id_contrato: contratoId,
      fecha_vencimiento: new Date(Date.now() + 86400000),
      estado: 'INGRESADO',
      comprobantes: [url],
      comprobante_url: '',
      save: async () => {},
    };
    Pago.findById = async () => pago;
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    let publicIdBorrado = '';
    cloudinaryConfig.getCloudinary = () => ({
      uploader: {
        destroy: async (publicId) => {
          publicIdBorrado = publicId;
          return { result: 'ok' };
        },
      },
    });
    const res = mockRes();

    await eliminarComprobante({
      params: { id: pago._id },
      body: { comprobante_url: url },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(publicIdBorrado, 'alquilar/pagos/recibo');
    assert.deepEqual(pago.comprobantes, []);
    assert.equal(pago.estado, 'PENDIENTE');
  });

  it('sirve el comprobante con descarga privada solo a quien tiene acceso al contrato', async () => {
    const url = 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/pagos/recibo.pdf';
    Pago.findById = async () => ({
      id_contrato: contratoId,
      comprobantes: [url],
      comprobante_url: '',
    });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    let privateDownloadOptions;
    cloudinaryConfig.getCloudinary = () => ({
      utils: {
        private_download_url(publicId, format, options) {
          assert.equal(publicId, 'alquilar/pagos/recibo');
          assert.equal(format, 'pdf');
          privateDownloadOptions = options;
          return 'https://api.cloudinary.com/private-download';
        },
      },
    });
    global.fetch = async () => ({
      ok: true,
      arrayBuffer: async () => Buffer.from('%PDF-1.7'),
    });
    const res = mockRes();
    res.set = function set(headers) {
      this.headers = headers;
      return this;
    };
    res.send = function send(body) {
      this.body = body;
      return this;
    };

    await verComprobante({
      params: { id: '111111111111111111111111', indice: '0' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    assert.equal(res.body.toString(), '%PDF-1.7');
    assert.equal(privateDownloadOptions.attachment, false);
  });

  it('no firma comprobantes almacenados fuera de la carpeta de pagos', async () => {
    Pago.findById = async () => ({
      id_contrato: contratoId,
      comprobantes: ['https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/garantes/privado.pdf'],
      comprobante_url: '',
    });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    cloudinaryConfig.getCloudinary = () => assert.fail('No debe firmar archivos que no sean comprobantes de pago.');
    const res = mockRes();

    await verComprobante({
      params: { id: '111111111111111111111111', indice: '0' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 404);
  });

  it('impide a otro propietario confirmar el pago', async () => {
    Pago.findById = async () => ({ id_contrato: contratoId });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: inquilinoId });
    const res = mockRes();

    await marcarComoPagado({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('rechaza listar pagos para un usuario sin rol operativo', async () => {
    const res = mockRes();
    await listarPagos({ usuario: { id: usuarioId, roles: ['USUARIO'] }, query: {} }, res);
    assert.equal(res.statusCode, 403);
  });

  it('valida id y existencia al consultar el detalle de un pago', async () => {
    const invalido = mockRes();
    await obtenerPago({ params: { id: 'invalido' }, usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] } }, invalido);
    assert.equal(invalido.statusCode, 400);

    Pago.findById = () => ({ populate: () => Promise.resolve(null) });
    const inexistente = mockRes();
    await obtenerPago({ params: { id: '111111111111111111111111' }, usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] } }, inexistente);
    assert.equal(inexistente.statusCode, 404);
  });

  it('no permite consultar un pago ligado a un contrato no gestionable', async () => {
    Pago.findById = () => ({ populate: () => Promise.resolve({ _id: 'pago', id_contrato: contratoId }) });
    Contrato.findById = async () => ({ _id: contratoId, id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: inquilinoId });
    const res = mockRes();

    await obtenerPago({ params: { id: '111111111111111111111111' }, usuario: { id: usuarioId, roles: ['PROPIETARIO'] } }, res);

    assert.equal(res.statusCode, 403);
  });

  it('rechaza período de pago inválido y contratos no vigentes', async () => {
    const periodoInvalido = mockRes();
    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-13' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, periodoInvalido);
    assert.equal(periodoInvalido.statusCode, 400);

    Contrato.findById = async () => ({ _id: contratoId, id_propiedad: propiedadId, id_inquilino: inquilinoId, estado: 'FINALIZADO' });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: usuarioId });
    const cerrado = mockRes();
    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-11' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, cerrado);
    assert.equal(cerrado.statusCode, 409);
  });

  it('responde conflicto si ya existe un pago para el período', async () => {
    Contrato.findById = async () => ({ _id: contratoId, id_propiedad: propiedadId, id_inquilino: inquilinoId, dia_vencimiento: 10, monto_mensual: 100, estado: 'VIGENTE' });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: usuarioId });
    Pago.prototype.save = async () => { throw Object.assign(new Error('duplicado'), { code: 11000 }); };
    const res = mockRes();

    await crearPago({
      body: { id_contrato: contratoId, mes_correspondiente: '2026-11' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('rechaza comprobantes que no sean URLs HTTPS y pagos inexistentes', async () => {
    const invalido = mockRes();
    await registrarComprobante({
      params: { id: '111111111111111111111111' },
      body: { comprobante_url: 'http://example.com/recibo.pdf' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, invalido);
    assert.equal(invalido.statusCode, 400);

    Pago.findById = async () => null;
    const inexistente = mockRes();
    await registrarComprobante({
      params: { id: '111111111111111111111111' },
      body: { comprobante_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/pagos/recibo.pdf' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, inexistente);
    assert.equal(inexistente.statusCode, 404);

    const externo = mockRes();
    await registrarComprobante({
      params: { id: '111111111111111111111111' },
      body: { comprobante_url: 'https://example.com/recibo.pdf' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, externo);
    assert.equal(externo.statusCode, 400);
  });

  it('no permite reemplazar el comprobante de un pago confirmado', async () => {
    Pago.findById = async () => ({ id_contrato: contratoId, estado: 'PAGADO' });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    const res = mockRes();

    await registrarComprobante({
      params: { id: '111111111111111111111111' },
      body: { comprobante_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v123/alquilar/pagos/recibo.pdf' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('actualiza la fecha de vencimiento y deriva el estado del pago', async () => {
    const pago = { id_contrato: contratoId, estado: 'PENDIENTE', save: async () => {} };
    Pago.findById = async () => pago;
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    const res = mockRes();

    await actualizarPago({
      params: { id: '111111111111111111111111' },
      body: { fecha_vencimiento: '2000-01-01' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(pago.estado, 'ATRASADO');
  });

  it('no permite modificar ni eliminar pagos confirmados', async () => {
    Pago.findById = async () => ({ id_contrato: contratoId, estado: 'PAGADO' });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });

    const modificar = mockRes();
    await actualizarPago({
      params: { id: '111111111111111111111111' },
      body: {},
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, modificar);
    assert.equal(modificar.statusCode, 409);

    const eliminar = mockRes();
    await eliminarPago({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, eliminar);
    assert.equal(eliminar.statusCode, 409);
  });

  it('confirma y elimina pagos gestionables', async () => {
    const pago = {
      id_contrato: contratoId,
      estado: 'INGRESADO',
      comprobante_url: 'https://example.com/recibo.pdf',
      save: async () => {},
      deleteOne: async () => {},
    };
    Pago.findById = async () => pago;
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });

    const confirmar = mockRes();
    await marcarComoPagado({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, confirmar);
    assert.equal(confirmar.statusCode, 200);
    assert.equal(pago.estado, 'PAGADO');
    assert.ok(pago.fecha_pago instanceof Date);

    pago.estado = 'INGRESADO';
    const eliminar = mockRes();
    await eliminarPago({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, eliminar);
    assert.equal(eliminar.statusCode, 200);
  });

  it('no confirma un pago sin comprobante ingresado', async () => {
    Pago.findById = async () => ({ id_contrato: contratoId, estado: 'PENDIENTE', save: async () => {} });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    const res = mockRes();

    await marcarComoPagado({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /Solo se pueden confirmar pagos ingresados/);
  });
});
