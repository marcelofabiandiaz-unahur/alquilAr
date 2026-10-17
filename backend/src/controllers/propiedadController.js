const Propiedad = require('../models/propiedad');
const Contrato = require('../models/contrato');
const cloudinaryConfig = require('../config/cloudinary');
const { parsePropiedadImageUrl } = require('../utils/cloudinaryAssets');
const {
  esAdmin,
  esPropietario,
  perteneceAlPropietario,
  puedeCambiarEstadoPropiedad,
  esErrorCast,
} = require('../utils/recursosHelpers');
const { validarIdParam, responderErrorServidor } = require('../utils/controllerHelpers');

const FOTOS_MAX = 5;

function validarFotos(fotos, res) {
  if (fotos === undefined) return true;
  if (!Array.isArray(fotos)) {
    res.status(400).json({ mensaje: 'El campo fotos debe ser un array.' });
    return false;
  }
  if (fotos.length > FOTOS_MAX) {
    res.status(400).json({ mensaje: `Máximo ${FOTOS_MAX} fotos por propiedad.` });
    return false;
  }
  return true;
}

const listarPropiedades = async (req, res) => {
  try {
    const { roles, id: usuarioId } = req.usuario;
    const filtro = { estado: { $ne: 'INACTIVA' } };

    if (esAdmin(roles)) {
      // Admin ve todas las activas
    } else if (esPropietario(roles)) {
      filtro.id_propietario = usuarioId;
    } else {
      return res.status(403).json({ mensaje: 'No tienes permiso para listar propiedades.' });
    }

    const propiedades = await Propiedad.find(filtro).sort({ createdAt: -1 });
    res.json(propiedades);
  } catch (error) {
    responderErrorServidor(res, error);
  }
};

const listarPropiedadesDisponibles = async (_req, res) => {
  try {
    const propiedades = await Propiedad.find({ estado: 'DISPONIBLE' })
      .select('_id direccion tipo ambientes descripcion valor_base fotos estado')
      .sort({ createdAt: -1 });
    res.json(propiedades);
  } catch (error) {
    responderErrorServidor(res, error);
  }
};

const obtenerPropiedad = async (req, res) => {
  if (!validarIdParam(req, res)) return;

  try {
    const propiedad = await Propiedad.findById(req.params.id);
    if (!propiedad || propiedad.estado === 'INACTIVA') {
      return res.status(404).json({ mensaje: 'Propiedad no encontrada.' });
    }

    const { roles, id: usuarioId } = req.usuario;
    if (!esAdmin(roles) && !perteneceAlPropietario(propiedad, usuarioId)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para ver esta propiedad.' });
    }

    res.json(propiedad);
  } catch (error) {
    responderErrorServidor(res, error);
  }
};

const crearPropiedad = async (req, res) => {
  try {
    const { roles, id: usuarioId } = req.usuario;

    if (!esPropietario(roles) && !esAdmin(roles)) {
      return res.status(403).json({ mensaje: 'Solo propietarios pueden crear propiedades.' });
    }

    const idPropietario = esAdmin(roles) && req.body.id_propietario
      ? req.body.id_propietario
      : usuarioId;

    if (!validarFotos(req.body.fotos, res)) return;

    const propiedad = new Propiedad({
      id_propietario: idPropietario,
      direccion: req.body.direccion,
      tipo: req.body.tipo,
      ambientes: req.body.ambientes,
      descripcion: req.body.descripcion,
      estado: 'DISPONIBLE',
      valor_base: req.body.valor_base,
      fotos: req.body.fotos || [],
    });

    await propiedad.save();
    res.status(201).json(propiedad);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al crear propiedad', error: error.message });
  }
};

const actualizarPropiedad = async (req, res) => {
  if (!validarIdParam(req, res)) return;

  try {
    const propiedad = await Propiedad.findById(req.params.id);
    if (!propiedad || propiedad.estado === 'INACTIVA') {
      return res.status(404).json({ mensaje: 'Propiedad no encontrada.' });
    }

    const { roles, id: usuarioId } = req.usuario;
    if (!esAdmin(roles) && !perteneceAlPropietario(propiedad, usuarioId)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para modificar esta propiedad.' });
    }

    if (req.body.estado !== undefined && req.body.estado !== propiedad.estado) {
      const validacion = puedeCambiarEstadoPropiedad(propiedad.estado, req.body.estado);
      if (!validacion.ok) {
        return res.status(400).json({ mensaje: validacion.mensaje });
      }

      if (req.body.estado === 'DISPONIBLE') {
        const contratoVigente = await Contrato.findOne({
          id_propiedad: propiedad._id,
          estado: 'VIGENTE',
        });
        if (contratoVigente) {
          return res.status(400).json({
            mensaje: 'No se puede marcar DISPONIBLE mientras exista un contrato vigente.',
          });
        }
      }
    }

    if (!validarFotos(req.body.fotos, res)) return;
    const fotosEliminadas = Array.isArray(req.body.fotos)
      ? (propiedad.fotos || []).filter((url) => !req.body.fotos.includes(url))
      : [];

    const camposPermitidos = ['direccion', 'tipo', 'ambientes', 'descripcion', 'estado', 'valor_base', 'fotos'];
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        propiedad[campo] = req.body[campo];
      }
    }

    await propiedad.save();

    const advertencias = [];
    for (const url of fotosEliminadas) {
      const asset = parsePropiedadImageUrl(url);
      if (!asset) {
        advertencias.push('Una foto quitada de la propiedad no se pudo borrar de Cloudinary porque su URL no es compatible.');
        continue;
      }

      try {
        const usadaEnOtraPropiedad = await Propiedad.findOne({
          _id: { $ne: propiedad._id },
          fotos: url,
        });
        if (usadaEnOtraPropiedad) continue;

        const cloudinary = cloudinaryConfig.getCloudinary();
        const resultado = await cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
          type: 'upload',
          invalidate: true,
        });
        if (!['ok', 'not found'].includes(resultado?.result)) {
          throw new Error(`Cloudinary devolvió ${resultado?.result || 'sin resultado'}.`);
        }
      } catch (error) {
        console.error(`No se pudo borrar de Cloudinary una foto de la propiedad ${propiedad._id}:`, error.message);
        advertencias.push('La propiedad se guardó, pero no se pudo borrar una de las fotos quitadas de Cloudinary.');
      }
    }

    const propiedadActualizada = typeof propiedad.toObject === 'function'
      ? propiedad.toObject()
      : propiedad;
    if (advertencias.length > 0) propiedadActualizada.advertencias = advertencias;
    res.json(propiedadActualizada);
  } catch (error) {
    if (esErrorCast(error)) {
      return res.status(400).json({ mensaje: 'ID inválido.' });
    }
    res.status(400).json({ mensaje: 'Error al actualizar propiedad', error: error.message });
  }
};

const bajaLogicaPropiedad = async (req, res) => {
  if (!validarIdParam(req, res)) return;

  try {
    const propiedad = await Propiedad.findById(req.params.id);
    if (!propiedad || propiedad.estado === 'INACTIVA') {
      return res.status(404).json({ mensaje: 'Propiedad no encontrada.' });
    }

    const { roles, id: usuarioId } = req.usuario;
    if (!esAdmin(roles) && !perteneceAlPropietario(propiedad, usuarioId)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para dar de baja esta propiedad.' });
    }

    const contratoVigente = await Contrato.findOne({
      id_propiedad: propiedad._id,
      estado: 'VIGENTE',
    });

    if (contratoVigente) {
      return res.status(400).json({
        mensaje: 'No se puede dar de baja una propiedad con contrato vigente.',
      });
    }

    propiedad.estado = 'INACTIVA';
    await propiedad.save();
    res.json({ mensaje: 'Propiedad dada de baja correctamente.', propiedad });
  } catch (error) {
    responderErrorServidor(res, error);
  }
};

const listarContratosPorPropiedad = async (req, res) => {
  if (!validarIdParam(req, res)) return;

  try {
    const propiedad = await Propiedad.findById(req.params.id);
    if (!propiedad || propiedad.estado === 'INACTIVA') {
      return res.status(404).json({ mensaje: 'Propiedad no encontrada.' });
    }

    const { roles, id: usuarioId } = req.usuario;
    if (!esAdmin(roles) && !perteneceAlPropietario(propiedad, usuarioId)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para ver los contratos de esta propiedad.' });
    }

    const contratos = await Contrato.find({ id_propiedad: propiedad._id }).populate(
      'id_inquilino',
      'nombre apellido email dni',
    );

    contratos.sort((a, b) => {
      const aVig = a.estado === 'VIGENTE' ? 0 : 1;
      const bVig = b.estado === 'VIGENTE' ? 0 : 1;
      if (aVig !== bVig) return aVig - bVig;
      return new Date(b.fecha_inicio) - new Date(a.fecha_inicio);
    });

    res.json(contratos);
  } catch (error) {
    responderErrorServidor(res, error);
  }
};

module.exports = {
  listarPropiedades,
  listarPropiedadesDisponibles,
  obtenerPropiedad,
  crearPropiedad,
  actualizarPropiedad,
  bajaLogicaPropiedad,
  listarContratosPorPropiedad,
};
