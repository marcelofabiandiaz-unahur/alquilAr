const Pago = require('../models/pago');
const Contrato = require('../models/contrato');
const cloudinaryConfig = require('../config/cloudinary');
const {
  parsePagoAssetUrl,
  esReciboValido,
} = require('../utils/cloudinaryAssets');
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
const { construirOperacionesCuotas } = require('../utils/cuotasContrato');

const responder = (res, status, data, message) =>
  res.status(status).json({ success: status < 400, data, message });

const obtenerComprobantes = (pago) => [
  ...new Set([
    ...(Array.isArray(pago.comprobantes) ? pago.comprobantes : []),
    ...(pago.comprobante_url ? [pago.comprobante_url] : []),
  ]),
];

const actualizarEstadoPorComprobantes = (pago, comprobantes) => {
  pago.comprobantes = comprobantes;
  pago.comprobante_url = '';
  pago.estado = comprobantes.length > 0
    ? 'INGRESADO'
    : pago.fecha_vencimiento < new Date() ? 'ATRASADO' : 'PENDIENTE';
};

const subirComprobanteCloudinary = (cloudinary, file, pagoId, usuarioId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'alquilar/pagos',
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        tags: ['alquilar_pago', `pago_${pagoId}`, `uploader_${usuarioId}`],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result.public_id) {
          return reject(new Error('Cloudinary no devolvió la información esperada del comprobante.'));
        }
        return resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(file.buffer);
  });

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

    const contratosVigentes = contratos.filter((contrato) =>
      contrato.estado === 'VIGENTE'
      && (!req.query.id_contrato || resolverId(contrato._id) === req.query.id_contrato));
    const operacionesCuotas = contratosVigentes.flatMap((contrato) =>
      construirOperacionesCuotas(contrato));
    if (operacionesCuotas.length > 0) {
      await Pago.bulkWrite(operacionesCuotas, { ordered: false });
    }

    await Pago.updateMany(
      {
        ...filtro,
        estado: { $in: ['PENDIENTE', 'ATRASADO'] },
        $or: [
          { comprobante_url: { $exists: true, $ne: '' } },
          { comprobantes: { $exists: true, $ne: [] } },
        ],
      },
      { $set: { estado: 'INGRESADO' } },
    );
    await Pago.updateMany(
      { ...filtro, estado: 'PENDIENTE', fecha_vencimiento: { $lt: new Date() } },
      { $set: { estado: 'ATRASADO' } },
    );
    const incluirDatosBancarios = esInquilino(obtenerIdentidad(req.usuario).roles);
    const pagos = await Pago.find(filtro)
      .populate({
        path: 'id_contrato',
        populate: {
          path: 'id_propiedad',
          select: incluirDatosBancarios ? 'direccion id_propietario' : 'direccion',
          ...(incluirDatosBancarios && {
            populate: { path: 'id_propietario', select: 'cbu_alias cuit_cuil' },
          }),
        },
      })
      .sort({ fecha_vencimiento: 1 });
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
    const periodoNormalizado = String(mes_correspondiente).replace('-', '');
    if (!/^\d{4}(0[1-9]|1[0-2])$/.test(periodoNormalizado)) {
      return responder(res, 400, null, 'mes_correspondiente debe tener formato YYYYMM.');
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

    const anio = Number(periodoNormalizado.slice(0, 4));
    const mes = Number(periodoNormalizado.slice(4, 6));
    const fechaVencimiento = new Date(anio, mes - 1, contrato.dia_vencimiento, 12);
    const pago = new Pago({
      id_contrato,
      mes_correspondiente: periodoNormalizado,
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
    if (!parsePagoAssetUrl(comprobante_url)) {
      return responder(res, 400, null, 'El comprobante debe pertenecer a la carpeta segura de pagos.');
    }
    const pago = await Pago.findById(req.params.id);
    if (!pago) return responder(res, 404, null, 'Pago no encontrado.');
    const { contrato } = await buscarContratoGestionable(resolverId(pago.id_contrato), req.usuario);
    const { id, roles } = obtenerIdentidad(req.usuario);
    if (!contrato || !esInquilino(roles) || resolverId(contrato.id_inquilino) !== resolverId(id)) {
      return responder(res, 403, null, 'Solo el inquilino del contrato puede cargar el comprobante.');
    }
    if (pago.estado === 'PAGADO') return responder(res, 409, null, 'No se puede cambiar el comprobante de un pago confirmado.');
    const comprobantes = obtenerComprobantes(pago);
    actualizarEstadoPorComprobantes(pago, [...new Set([...comprobantes, comprobante_url])]);
    await pago.save();
    return responder(res, 200, pago, 'Comprobante registrado.');
  } catch (error) {
    return responder(res, 500, null, error.message);
  }
};

const subirComprobantes = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    if (!Array.isArray(req.files) || req.files.length === 0) {
      return responder(res, 400, null, 'Seleccioná al menos un comprobante.');
    }
    if (req.files.some((file) => !esReciboValido(file))) {
      return responder(res, 400, null, 'Los archivos deben ser PDF, JPG, PNG o WEBP válidos.');
    }

    const pago = await Pago.findById(req.params.id);
    if (!pago) return responder(res, 404, null, 'Pago no encontrado.');
    const { contrato } = await buscarContratoGestionable(resolverId(pago.id_contrato), req.usuario);
    const { id, roles } = obtenerIdentidad(req.usuario);
    if (!contrato || !esInquilino(roles) || resolverId(contrato.id_inquilino) !== resolverId(id)) {
      return responder(res, 403, null, 'Solo el inquilino del contrato puede cargar comprobantes.');
    }
    if (pago.estado === 'PAGADO') {
      return responder(res, 409, null, 'No se pueden modificar comprobantes de un pago confirmado.');
    }

    const actuales = obtenerComprobantes(pago);
    if (actuales.length + req.files.length > 5) {
      return responder(res, 400, null, 'Se permiten hasta 5 comprobantes por pago.');
    }

    const cloudinary = cloudinaryConfig.getCloudinary();
    const subidos = [];
    try {
      for (const file of req.files) {
        subidos.push(await subirComprobanteCloudinary(cloudinary, file, pago._id, id));
      }
    } catch (error) {
      for (const asset of subidos) {
        try {
          const resultado = await cloudinary.uploader.destroy(asset.publicId, {
            resource_type: 'image',
            type: 'upload',
            invalidate: true,
          });
          if (!['ok', 'not found'].includes(resultado?.result)) {
            console.error(`Cloudinary no limpió el asset ${asset.publicId} tras fallar una carga múltiple.`);
          }
        } catch (cleanupError) {
          console.error('No se pudo limpiar un comprobante tras fallar una carga múltiple:', cleanupError.message);
        }
      }
      throw error;
    }

    const comprobantes = [...new Set([...actuales, ...subidos.map((asset) => asset.url)])];
    actualizarEstadoPorComprobantes(pago, comprobantes);
    try {
      await pago.save();
    } catch (error) {
      for (const asset of subidos) {
        try {
          const resultado = await cloudinary.uploader.destroy(asset.publicId, {
            resource_type: 'image',
            type: 'upload',
            invalidate: true,
          });
          if (!['ok', 'not found'].includes(resultado?.result)) {
            console.error(`Cloudinary no limpió el asset ${asset.publicId} tras fallar el guardado del pago.`);
          }
        } catch (cleanupError) {
          console.error('No se pudo limpiar un comprobante tras fallar el guardado del pago:', cleanupError.message);
        }
      }
      throw error;
    }
    return responder(res, 200, pago, 'Comprobantes cargados.');
  } catch (error) {
    console.error('Error al cargar comprobantes del pago:', error.message);
    return responder(res, 502, null, 'No se pudieron cargar los comprobantes.');
  }
};

const eliminarComprobante = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
    const { comprobante_url } = req.body || {};
    if (typeof comprobante_url !== 'string' || !comprobante_url) {
      return responder(res, 400, null, 'comprobante_url es obligatorio.');
    }

    const pago = await Pago.findById(req.params.id);
    if (!pago) return responder(res, 404, null, 'Pago no encontrado.');
    const { contrato } = await buscarContratoGestionable(resolverId(pago.id_contrato), req.usuario);
    const { id, roles } = obtenerIdentidad(req.usuario);
    if (!contrato || !esInquilino(roles) || resolverId(contrato.id_inquilino) !== resolverId(id)) {
      return responder(res, 403, null, 'Solo el inquilino del contrato puede quitar comprobantes.');
    }
    if (pago.estado === 'PAGADO') {
      return responder(res, 409, null, 'No se pueden modificar comprobantes de un pago confirmado.');
    }

    const actuales = obtenerComprobantes(pago);
    if (!actuales.includes(comprobante_url)) {
      return responder(res, 404, null, 'El comprobante no está asociado a este pago.');
    }

    const asset = parsePagoAssetUrl(comprobante_url);
    if (asset) {
      const cloudinary = cloudinaryConfig.getCloudinary();
      const resultado = await cloudinary.uploader.destroy(asset.publicId, {
        resource_type: asset.resourceType,
        type: 'upload',
        invalidate: true,
      });
      if (!['ok', 'not found'].includes(resultado?.result)) {
        throw new Error(`Cloudinary no pudo eliminar el comprobante (${resultado?.result || 'sin resultado'}).`);
      }
    }

    const restantes = actuales.filter((url) => url !== comprobante_url);
    actualizarEstadoPorComprobantes(pago, restantes);
    await pago.save();
    const pagoActualizado = typeof pago.toObject === 'function' ? pago.toObject() : pago;
    if (!asset) {
      pagoActualizado.advertencia = 'La referencia se quitó, pero el archivo legado externo no se borró de Cloudinary.';
    }
    return responder(
      res,
      200,
      pagoActualizado,
      asset
        ? 'Comprobante eliminado.'
        : 'Referencia del comprobante anterior quitada; el archivo legado externo no se borró de Cloudinary.',
    );
  } catch (error) {
    console.error('Error al eliminar comprobante de pago:', error.message);
    return responder(res, 502, null, 'No se pudo eliminar el comprobante.');
  }
};

const verComprobante = async (req, res) => {
  try {
    if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID de pago inválido.');
    const indice = Number(req.params.indice);
    if (!Number.isInteger(indice) || indice < 0 || indice > 4) {
      return responder(res, 400, null, 'Índice de comprobante inválido.');
    }

    const pago = await Pago.findById(req.params.id);
    if (!pago) return responder(res, 404, null, 'Pago no encontrado.');
    const { contrato, permitido } = await buscarContratoGestionable(resolverId(pago.id_contrato), req.usuario);
    if (!contrato || !permitido) return responder(res, 403, null, 'No tenés permiso para ver este comprobante.');

    const url = obtenerComprobantes(pago)[indice];
    if (!url) return responder(res, 404, null, 'Comprobante no encontrado.');
    const asset = parsePagoAssetUrl(url);
    if (!asset) return responder(res, 404, null, 'Este comprobante anterior no se puede consultar desde el visor privado.');

    const contentTypes = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const contentType = contentTypes[asset.format];
    if (!contentType) return responder(res, 415, null, 'Formato de comprobante no compatible.');

    const cloudinary = cloudinaryConfig.getCloudinary();
    const signedUrl = cloudinary.utils.private_download_url(asset.publicId, asset.format, {
      resource_type: asset.resourceType,
      type: 'upload',
      expires_at: Math.floor(Date.now() / 1000) + 300,
      attachment: false,
    });
    const upstream = await fetch(signedUrl, { signal: AbortSignal.timeout(15000) });
    if (!upstream.ok) {
      console.error(`Cloudinary devolvió ${upstream.status} al servir el pago ${pago._id}.`);
      return responder(res, 502, null, 'Cloudinary no permitió leer el comprobante.');
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024) {
      return responder(res, 502, null, 'El comprobante supera el máximo permitido de 5 MB.');
    }
    res.set({
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'Content-Disposition': `inline; filename="comprobante-pago-${indice + 1}.${asset.format}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error al consultar comprobante del pago:', error.message);
    return responder(res, 502, null, 'No se pudo consultar el comprobante.');
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
    if (pago.estado !== 'INGRESADO' || obtenerComprobantes(pago).length === 0) {
      return responder(res, 409, null, 'Solo se pueden confirmar pagos ingresados con comprobante.');
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
      pago.estado = obtenerComprobantes(pago).length > 0
        ? 'INGRESADO'
        : fecha < new Date() ? 'ATRASADO' : 'PENDIENTE';
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
  subirComprobantes,
  eliminarComprobante,
  verComprobante,
  marcarComoPagado,
  eliminarPago,
};
