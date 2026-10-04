const Contrato = require('../models/contrato');
const Propiedad = require('../models/propiedad');
const cloudinaryConfig = require('../config/cloudinary');
const { esAdmin, perteneceAlPropietario, puedeVerContrato, esObjectIdValido } = require('../utils/recursosHelpers');
const { parseGaranteAssetUrl, esReciboValido } = require('../utils/cloudinaryAssets');

const responder = (res, status, mensaje, data = null) =>
  res.status(status).json({ success: status < 400, mensaje, data });

const uploadGarante = async (req, res) => {
  if (!req.file || !esReciboValido(req.file)) {
    return responder(res, 400, 'El archivo debe ser un PDF, JPG, PNG o WEBP válido.');
  }

  try {
    const cloudinary = cloudinaryConfig.getCloudinary();
    const uploaderTag = `uploader_${String(req.usuario.id)}`;
    const resultado = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'alquilar/garantes',
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false,
          tags: ['alquilar_garante', uploaderTag],
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      );
      stream.end(req.file.buffer);
    });

    if (!resultado?.secure_url || !resultado.public_id) {
      throw new Error('Cloudinary no devolvió la información esperada del recibo.');
    }

    return responder(res, 201, 'Recibo del garante cargado.', { url: resultado.secure_url });
  } catch (error) {
    console.error('Error al cargar recibo de garante en Cloudinary:', error.message);
    return responder(res, 502, 'No se pudo cargar el recibo del garante.');
  }
};

const eliminarReciboGarante = async (req, res) => {
  const { url } = req.body || {};
  const asset = parseGaranteAssetUrl(url);
  if (!asset) {
    return responder(res, 400, 'La URL no corresponde a un recibo permitido de este Cloudinary.');
  }

  try {
    const contratos = await Contrato.find({ 'garante.recibo': url });
    for (const contrato of contratos) {
      const propiedad = await Propiedad.findById(contrato.id_propiedad);
      if (
        !propiedad
        || (!esAdmin(req.usuario.roles) && !perteneceAlPropietario(propiedad, req.usuario.id))
      ) {
        return responder(res, 403, 'No tenés permiso para quitar este recibo.');
      }
    }

    const cloudinary = cloudinaryConfig.getCloudinary();
    let recurso;
    try {
      recurso = await cloudinary.api.resource(asset.publicId, {
        resource_type: asset.resourceType,
        type: 'upload',
      });
    } catch (error) {
      if (error.http_code === 404 && contratos.length > 0) {
        recurso = null;
      } else if (error.http_code === 404 && contratos.length === 0) {
        return responder(res, 404, 'El recibo no existe o ya fue eliminado.');
      } else if (error.http_code === 404) {
        recurso = null;
      } else {
        throw error;
      }
    }

    if (recurso && recurso.public_id !== asset.publicId) {
      return responder(res, 400, 'La URL no identifica el recurso esperado.');
    }

    if (contratos.length === 0 && recurso) {
      const uploaderTag = `uploader_${String(req.usuario.id)}`;
      if (
        !asset.publicId.startsWith(asset.garanteFolder)
        || !Array.isArray(recurso.tags)
        || !recurso.tags.includes(uploaderTag)
      ) {
        return responder(res, 403, 'Solo quien cargó este recibo puede eliminarlo si no está asociado a un contrato.');
      }
    }

    if (recurso) {
      let resultado;
      try {
        resultado = await cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
          type: 'upload',
          invalidate: true,
        });
      } catch (error) {
        if (error.http_code !== 404) throw error;
        resultado = { result: 'not found' };
      }

      if (!['ok', 'not found'].includes(resultado?.result)) {
        throw new Error(`Cloudinary no pudo eliminar el recibo (${resultado?.result || 'sin resultado'}).`);
      }
    }

    for (const contrato of contratos) {
      if (contrato.garante?.recibo === url) {
        contrato.garante.recibo = '';
        await contrato.save();
      }
    }

    return responder(res, 200, 'Recibo eliminado.');
  } catch (error) {
    console.error('Error al eliminar recibo de garante de Cloudinary:', error.message);
    return responder(res, 502, 'No se pudo eliminar el recibo. No se quitó la referencia del contrato.');
  }
};

const verReciboGarante = async (req, res) => {
  if (!esObjectIdValido(req.params.id)) return responder(res, 400, 'ID de contrato inválido.');

  try {
    const contrato = await Contrato.findById(req.params.id).populate('id_propiedad');
    if (!contrato) return responder(res, 404, 'Contrato no encontrado.');

    if (!puedeVerContrato(contrato, contrato.id_propiedad, req.usuario.id, req.usuario.roles)) {
      return responder(res, 403, 'No tenés permiso para ver este recibo.');
    }

    const asset = parseGaranteAssetUrl(contrato.garante?.recibo);
    if (!asset) return responder(res, 404, 'El contrato no tiene un recibo de garante válido.');

    const cloudinary = cloudinaryConfig.getCloudinary();
    const signedUrl = cloudinary.utils.private_download_url(
      asset.publicId,
      asset.format,
      {
        resource_type: asset.resourceType,
        type: 'upload',
        expires_at: Math.floor(Date.now() / 1000) + 300,
        attachment: false,
      },
    );
    const upstream = await fetch(signedUrl, { signal: AbortSignal.timeout(15000) });
    if (!upstream.ok) {
      console.error(`Cloudinary devolvió ${upstream.status} al servir el recibo del contrato ${contrato._id}.`);
      return responder(res, 502, 'Cloudinary no permitió leer el recibo. Revisá la política de entrega del recurso.');
    }

    const contentType = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    }[asset.format];
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024) {
      return responder(res, 502, 'El recibo supera el tamaño máximo permitido de 5 MB.');
    }

    res.set({
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'Content-Disposition': `inline; filename="recibo-garante.${asset.format}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error al consultar recibo de garante:', error.message);
    return responder(res, 502, 'No se pudo consultar el recibo del garante.');
  }
};

module.exports = { uploadGarante, eliminarReciboGarante, verReciboGarante };
