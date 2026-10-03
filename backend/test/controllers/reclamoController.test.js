const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Reclamo = require('../../src/models/reclamo');
const Contrato = require('../../src/models/contrato');
const Propiedad = require('../../src/models/propiedad');
const {
  crearReclamo,
  listarReclamos,
  obtenerReclamo,
  actualizarReclamo,
  eliminarReclamo,
} = require('../../src/controllers/reclamoController');
const { mockRes } = require('../helpers/mockRes');
const { usuarioId, inquilinoId, otroId, propiedadId, contratoId } = require('../helpers/fixtures/ids');

describe('reclamoController', () => {
  let original;

  beforeEach(() => {
    original = {
      reclamoFind: Reclamo.find,
      reclamoFindById: Reclamo.findById,
      reclamoSave: Reclamo.prototype.save,
      contratoFind: Contrato.find,
      contratoFindById: Contrato.findById,
      propiedadFind: Propiedad.find,
      propiedadFindById: Propiedad.findById,
    };
  });

  afterEach(() => {
    Reclamo.find = original.reclamoFind;
    Reclamo.findById = original.reclamoFindById;
    Reclamo.prototype.save = original.reclamoSave;
    Contrato.find = original.contratoFind;
    Contrato.findById = original.contratoFindById;
    Propiedad.find = original.propiedadFind;
    Propiedad.findById = original.propiedadFindById;
  });

  it('crea el reclamo con propiedad e inquilino derivados del contrato', async () => {
    Contrato.findById = async () => ({
      id_propiedad: propiedadId,
      id_inquilino: inquilinoId,
      estado: 'VIGENTE',
    });
    Propiedad.findById = async () => ({ _id: propiedadId, id_propietario: usuarioId });
    Reclamo.prototype.save = async function save() {};
    const res = mockRes();

    await crearReclamo({
      body: {
        id_contrato: contratoId,
        asunto: 'Pérdida de agua',
        descripcion: 'Hay una pérdida en la cocina.',
        categoria: 'MANTENIMIENTO',
      },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.id_propiedad.toString(), propiedadId);
    assert.equal(res.body.data.id_inquilino.toString(), inquilinoId);
  });

  it('no permite abrir reclamos en contratos de otro inquilino', async () => {
    Contrato.findById = async () => ({
      id_propiedad: propiedadId,
      id_inquilino: usuarioId,
      estado: 'VIGENTE',
    });
    Propiedad.findById = async () => ({ id_propietario: otroId });
    const res = mockRes();

    await crearReclamo({
      body: {
        id_contrato: contratoId,
        asunto: 'Consulta',
        descripcion: 'Detalle',
        categoria: 'OTRO',
      },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 403, JSON.stringify(res.body));
  });

  it('limita la consulta del propietario a sus propiedades', async () => {
    Propiedad.find = () => ({ select: async () => [{ _id: propiedadId }] });
    Reclamo.find = (filter) => {
      assert.equal(filter.id_propiedad.$in[0].toString(), propiedadId);
      return {
        populate: () => ({
          populate: () => ({
            sort: async () => [],
          }),
        }),
      };
    };
    const res = mockRes();

    await listarReclamos({ usuario: { id: usuarioId, roles: ['PROPIETARIO'] } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, []);
  });

  it('solo permite al propietario de la relación actualizar reclamos', async () => {
    Reclamo.findById = async () => ({ id_contrato: contratoId });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: otroId });
    const res = mockRes();

    await actualizarReclamo({
      params: { id: '111111111111111111111111' },
      body: { estado: 'RESUELTO' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });

  it('rechaza consultas de reclamos para usuarios sin rol relacionado', async () => {
    const res = mockRes();
    await listarReclamos({ usuario: { id: usuarioId, roles: ['USUARIO'] } }, res);
    assert.equal(res.statusCode, 403);
  });

  it('permite al administrador listar reclamos sin limitar el filtro', async () => {
    Reclamo.find = (filtro) => {
      assert.deepEqual(filtro, {});
      return {
        populate() { return this; },
        sort: async () => [{ _id: 'reclamo' }],
      };
    };
    const res = mockRes();

    await listarReclamos({ usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 1);
  });

  it('valida el id y autorización al consultar un reclamo', async () => {
    const invalido = mockRes();
    await obtenerReclamo({
      params: { id: 'mal' },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, invalido);
    assert.equal(invalido.statusCode, 400);

    Reclamo.findById = async () => null;
    const inexistente = mockRes();
    await obtenerReclamo({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['ADMINISTRADOR'] },
    }, inexistente);
    assert.equal(inexistente.statusCode, 404);

    Reclamo.findById = async () => ({ id_contrato: contratoId });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: otroId });
    const prohibido = mockRes();
    await obtenerReclamo({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, prohibido);
    assert.equal(prohibido.statusCode, 403);
  });

  it('valida los campos y el rol al crear un reclamo', async () => {
    const incompleto = mockRes();
    await crearReclamo({
      body: { asunto: 'Fuga' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, incompleto);
    assert.equal(incompleto.statusCode, 400);

    const idInvalido = mockRes();
    await crearReclamo({
      body: { id_contrato: 'mal', asunto: 'Fuga', descripcion: 'Detalle', categoria: 'MANTENIMIENTO' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, idInvalido);
    assert.equal(idInvalido.statusCode, 400);

    const sinRol = mockRes();
    await crearReclamo({
      body: { id_contrato: contratoId, asunto: 'Fuga', descripcion: 'Detalle', categoria: 'MANTENIMIENTO' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, sinRol);
    assert.equal(sinRol.statusCode, 403);
  });

  it('rechaza reclamos de contratos que no están vigentes', async () => {
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId, estado: 'FINALIZADO' });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    const res = mockRes();

    await crearReclamo({
      body: { id_contrato: contratoId, asunto: 'Fuga', descripcion: 'Detalle', categoria: 'MANTENIMIENTO' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 409);
  });

  it('responde con error de validación al guardar un reclamo', async () => {
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId, estado: 'VIGENTE' });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });
    Reclamo.prototype.save = async () => { throw Object.assign(new Error('prioridad inválida'), { name: 'ValidationError' }); };
    const res = mockRes();

    await crearReclamo({
      body: { id_contrato: contratoId, asunto: 'Fuga', descripcion: 'Detalle', categoria: 'MANTENIMIENTO' },
      usuario: { id: inquilinoId, roles: ['INQUILINO'] },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /prioridad inválida/);
  });

  it('permite al propietario autorizado actualizar y eliminar un reclamo', async () => {
    const reclamo = {
      id_contrato: contratoId,
      save: async () => {},
      deleteOne: async () => {},
    };
    Reclamo.findById = async () => reclamo;
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: usuarioId });

    const actualizar = mockRes();
    await actualizarReclamo({
      params: { id: '111111111111111111111111' },
      body: { estado: 'RESUELTO', prioridad: 'BAJA' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, actualizar);
    assert.equal(actualizar.statusCode, 200);
    assert.equal(reclamo.estado, 'RESUELTO');
    assert.equal(reclamo.prioridad, 'BAJA');

    const eliminar = mockRes();
    await eliminarReclamo({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, eliminar);
    assert.equal(eliminar.statusCode, 200);
    assert.equal(eliminar.body.message, 'Reclamo eliminado.');
  });

  it('rechaza eliminar un reclamo de una propiedad ajena', async () => {
    Reclamo.findById = async () => ({ id_contrato: contratoId });
    Contrato.findById = async () => ({ id_propiedad: propiedadId, id_inquilino: inquilinoId });
    Propiedad.findById = async () => ({ id_propietario: otroId });
    const res = mockRes();

    await eliminarReclamo({
      params: { id: '111111111111111111111111' },
      usuario: { id: usuarioId, roles: ['PROPIETARIO'] },
    }, res);

    assert.equal(res.statusCode, 403);
  });
});
