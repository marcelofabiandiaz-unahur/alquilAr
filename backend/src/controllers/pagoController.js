const Pago = require('../models/pago');
const Contrato = require('../models/contrato');
const {
  obtenerIdentidad,
  resolverId,
  esAdministrador,
  esPropietario,
  esInquilino,
  buscarContratoGestionable,
  obtenerContratosVisibles,
} = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');

const responder = (res, status, data, message) =>
  res.status(status).json({ success: status < 400, data, message });

const listarPagos = async (req, res) => {
  try {
    const contratos = await obtenerContratosVisibles(req.usuario);
    if (!contratos) return responder(res, 403, null, 'No tenés permiso para consultar pagos.');

    const filtro = { id_contrato: { $in: contratos.map((contrato) => contrato._id) } };
    if (req.query.id_contrato) {
      if (!esObjectIdValido(req.query.id_contrato)) {
        return responder(res, 400, null, 'id_contrato inválido.');
      }
      filtro.id_contrato = req.query.id_contrato;
      if (!contratos.some((contrato) => resolverId(contrato._id) === req.query.id_contrato)) {
        return responder(res, 403, null, 'No tenés permiso para consultar este contrato.');
      }
    }

    await Pago.updateMany(
      { ...filtro, estado: 'PENDIENTE', fecha_vencimiento: { $lt: new Date() } },
      { $set: { estado: 'ATRASADO' } },
    );
    const pagos = await Pago.find(filtro)
      .populate({
        path: 'id_contrato',
        populate: { path: 'id_propiedad', select: 'direccion' },
      })
      .sort({ fecha_vencimiento: -1 });
    return responder(res, 200, pagos, 'Pagos consultados.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

const obtenerPago = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const pago = await Pago.findById(req.params.id).populate({
      path: 'id_contrato',
      populate: { path: 'id_propiedad', select: 'direccion' },
    });
    if (!pago) return responder(res, 404, null, 'Pago no encontrado.');
    const { contrato, permitido } = await buscarContratoGestionable(
      resolverId(pago.id_contrato),
      req.usuario,
    );
    if (!contrato || !permitido) return responder(res, 403, null, 'No tenés permiso para ver este pago.');
    return responder(res, 200, pago, 'Pago consultado.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

const crearPago = async (req, res) => {
  try {
    const { id_contrato, mes_correspondiente } = req.body || {};
    if (!id_contrato || !mes_correspondiente) {
      return responder(res, 400, null, 'id_contrato y mes_correspondiente son obligatorios.');
    }
    if (!esObjectIdValido(id_contrato)) return responder(res, 400, null, 'id_contrato inválido.');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes_correspondiente)) {
      return responder(res, 400, null, 'mes_correspondiente debe tener formato YYYY-MM.');
    }

    const roles = obtenerIdentidad(req.usuario).roles;
    if (!esAdministrador(roles) && !esPropietario(roles)) {
      return responder(res, 403, null, 'Solo el propietario del contrato o un administrador puede registrar pagos.');
    }
    const { contrato, permitido } = await buscarContratoGestionable(id_contrato, req.usuario);
    if (!contrato) return responder(res, 404, null, 'Contrato no encontrado.');
    if (!permitido) {
      return responder(res, 403, null, 'Solo el propietario del contrato o un administrador puede registrar pagos.');
    }
    if (contrato.estado !== 'VIGENTE') {
      return responder(res, 409, null, 'Solo se pueden registrar pagos para contratos vigentes.');
    }

    const [anio, mes] = mes_correspondiente.split('-').map(Number);
    const fechaVencimiento = new Date(anio, mes - 1, contrato.dia_vencimiento, 12);
    const pago = new Pago({
      id_contrato,
      mes_correspondiente,
      monto_total: contrato.monto_mensual,
      fecha_vencimiento: fechaVencimiento,
      estado: fechaVencimiento < new Date() ? 'ATRASADO' : 'PENDIENTE',
    });
    await pago.save();
    return responder(res, 201, pago, 'Pago registrado.');
  } catch (error) {
    if (error.code === 11000) return responder(res, 409, null, 'Ya existe un pago para ese contrato y período.');
    if (error.name === 'ValidationError') return responder(res, 400, null, error.message);
    return responder(res, 500, null, error.message);
  }
};

const registrarComprobante = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const { comprobante_url } = req.body || {};
    if (typeof comprobante_url !== 'string' || !/^https:\/\/\S+$/.test(comprobante_url)) {
      return responder(res, 400, null, 'comprobante_url debe ser una URL HTTPS válida.');
    }
    const pago = await Pago.findById(req.params.id);
    if (!pago) return responder(res, 404, null, 'Pago no encontrado.');
    const { contrato } = await buscarContratoGestionable(resolverId(pago.id_contrato), req.usuario);
    const { id, roles } = obtenerIdentidad(req.usuario);
    if (!contrato || !esInquilino(roles) || resolverId(contrato.id_inquilino) !== resolverId(id)) {
      return responder(res, 403, null, 'Solo el inquilino del contrato puede cargar el comprobante.');
    }
    if (pago.estado === 'PAGADO') return responder(res, 409, null, 'No se puede cambiar el comprobante de un pago confirmado.');
    pago.comprobante_url = comprobante_url;
    await pago.save();
    return responder(res, 200, pago, 'Comprobante registrado.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

const marcarComoPagado = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const pago = await Pago.findById(req.params.id);
    if (!pago) return responder(res, 404, null, 'Pago no encontrado.');
    const { contrato, permitido } = await buscarContratoGestionable(resolverId(pago.id_contrato), req.usuario);
    const roles = obtenerIdentidad(req.usuario).roles;
    if (!contrato || !permitido || (!esAdministrador(roles) && !esPropietario(roles))) {
      return responder(res, 403, null, 'Solo el propietario del contrato o un administrador puede confirmar el pago.');
    }
    pago.estado = 'PAGADO';
    pago.fecha_pago = new Date();
    await pago.save();
    return responder(res, 200, pago, 'Pago confirmado.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

const actualizarPago = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const pago = await Pago.findById(req.params.id);
    if (!pago) return responder(res, 404, null, 'Pago no encontrado.');
    const { contrato, permitido } = await buscarContratoGestionable(resolverId(pago.id_contrato), req.usuario);
    const roles = obtenerIdentidad(req.usuario).roles;
    if (!contrato || !permitido || (!esAdministrador(roles) && !esPropietario(roles))) {
      return responder(res, 403, null, 'Solo el propietario del contrato o un administrador puede modificar el pago.');
    }
    if (pago.estado === 'PAGADO') return responder(res, 409, null, 'No se puede modificar un pago confirmado.');
    if (req.body?.fecha_vencimiento !== undefined) {
      const fecha = new Date(req.body.fecha_vencimiento);
      if (Number.isNaN(fecha.getTime())) return responder(res, 400, null, 'fecha_vencimiento inválida.');
      pago.fecha_vencimiento = fecha;
      pago.estado = fecha < new Date() ? 'ATRASADO' : 'PENDIENTE';
    }
    await pago.save();
    return responder(res, 200, pago, 'Pago actualizado.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

const eliminarPago = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const pago = await Pago.findById(req.params.id);
    if (!pago) return responder(res, 404, null, 'Pago no encontrado.');
    const { contrato, permitido } = await buscarContratoGestionable(resolverId(pago.id_contrato), req.usuario);
    const roles = obtenerIdentidad(req.usuario).roles;
    if (!contrato || !permitido || (!esAdministrador(roles) && !esPropietario(roles))) {
      return responder(res, 403, null, 'No tenés permiso para eliminar este pago.');
    }
    if (pago.estado === 'PAGADO') return responder(res, 409, null, 'No se puede eliminar un pago confirmado.');
    await pago.deleteOne();
    return responder(res, 200, null, 'Pago eliminado.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

module.exports = {
  listarPagos,
  obtenerPago,
  crearPago,
  actualizarPago,
  registrarComprobante,
  marcarComoPagado,
  eliminarPago,
};
