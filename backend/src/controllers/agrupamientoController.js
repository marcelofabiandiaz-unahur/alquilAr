const Agrupamiento = require('../models/agrupamiento');
const Propiedad = require('../models/propiedad');
const Usuario = require('../models/usuario');
const {
  obtenerIdentidad,
  resolverId,
  esAdministrador,
  esPropietario,
} = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');
const { responder, escaparRegex } = require('../utils/controllerHelpers');
const cloudinaryConfig = require('../config/cloudinary');
const { parsePropiedadImageUrl } = require('../utils/cloudinaryAssets');
const {
  buscarAgrupamientosVisibles,
  esGestor,
  obtenerAgrupamientoVisible,
} = require('../utils/agrupamientoHelpers');

const TIPOS = ['EDIFICIO', 'COMPLEJO', 'CONSORCIO', 'CONJUNTO', 'BARRIO_CERRADO', 'OTRO'];
const ESTADOS = ['ACTIVO', 'INACTIVO'];
const FOTOS_MAX = 5;

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

const validarDireccion = (direccion, { parcial = false } = {}) => {
  if (direccion === undefined) {
    return parcial ? null : 'La dirección es obligatoria.';
  }
  if (!direccion || typeof direccion !== 'object' || Array.isArray(direccion)) {
    return 'La dirección debe ser un objeto.';
  }
  const obligatorios = ['calle', 'numero', 'ciudad', 'provincia'];
  for (const campo of obligatorios) {
    if (parcial && direccion[campo] === undefined) continue;
    if (!texto(direccion[campo])) return `direccion.${campo} es obligatorio.`;
  }
  return null;
};

const normalizarDireccion = (direccion = {}) => ({
  calle: texto(direccion.calle),
  numero: texto(direccion.numero),
  ciudad: texto(direccion.ciudad),
  provincia: texto(direccion.provincia),
  codigo_postal: texto(direccion.codigo_postal),
});

const normalizarContacto = (contacto = {}) => ({
  nombre: texto(contacto.nombre),
  telefono: texto(contacto.telefono),
  email: texto(contacto.email).toLowerCase(),
});

const normalizarConfiguracion = (configuracion = {}) => {
  return { moneda: texto(configuracion.moneda) || 'ARS' };
};

const validarConfiguracion = (configuracion) => {
  if (configuracion !== undefined && (typeof configuracion !== 'object' || configuracion === null)) {
    return 'La configuración debe ser un objeto.';
  }
  if (!configuracion) return null;
  return null;
};

const validarGestores = async (gestores) => {
  if (gestores === undefined) return null;
  if (!Array.isArray(gestores)) return 'gestores debe ser un array.';
  const invalido = gestores.find((gestor) => !esObjectIdValido(String(gestor)));
  if (invalido !== undefined) return 'gestores contiene un ID inválido.';
  if (gestores.length === 0) return null;
  const idsGestores = gestores.map((gestor) => String(gestor).toLowerCase());
  if (new Set(idsGestores).size !== gestores.length) {
    return 'No se puede asignar el mismo gestor más de una vez.';
  }

  const usuarios = await Usuario.find({ _id: { $in: idsGestores } }).select('_id roles estado');
  if (usuarios.length !== gestores.length) {
    return 'Uno o más gestores no existen.';
  }
  if (usuarios.some((usuario) => (
    !usuario.roles?.includes('PROPIETARIO') || usuario.estado !== 'ACTIVO'
  ))) {
    return 'Los gestores asignados deben ser propietarios activos.';
  }
  return null;
};

const validarFotos = (fotos) => {
  if (fotos === undefined) return null;
  if (!Array.isArray(fotos)) return 'fotos debe ser un array.';
  if (fotos.length > FOTOS_MAX) return `Máximo ${FOTOS_MAX} fotos por agrupamiento.`;
  if (fotos.some((foto) => typeof foto !== 'string' || !foto.trim())) {
    return 'Cada foto debe ser una URL válida.';
  }
  return null;
};

const validarServicios = (servicios) => {
  if (servicios === undefined) return null;
  if (!Array.isArray(servicios) || servicios.some((servicio) => typeof servicio !== 'string')) {
    return 'servicios debe ser un array de textos.';
  }
  return null;
};

const construirFiltroListado = async (query, usuario) => {
  const { filtro: filtroVisibilidad, error } = await buscarAgrupamientosVisibles(usuario);
  if (error) return { filtro: null, error };

  const condiciones = [];
  if (filtroVisibilidad) {
    condiciones.push(filtroVisibilidad);
  }

  if (query.tipo !== undefined) {
    const tipo = texto(query.tipo).toUpperCase();
    if (!TIPOS.includes(tipo)) return { filtro: null, error: { status: 400, mensaje: 'tipo inválido.' } };
    condiciones.push({ tipo });
  }
  if (query.estado !== undefined) {
    const estado = texto(query.estado).toUpperCase();
    if (!ESTADOS.includes(estado)) {
      return { filtro: null, error: { status: 400, mensaje: 'estado inválido.' } };
    }
    condiciones.push({ estado });
  }
  if (query.ciudad !== undefined) {
    condiciones.push({
      'direccion.ciudad': new RegExp(escaparRegex(texto(query.ciudad).slice(0, 80)), 'i'),
    });
  }
  if (query.q !== undefined) {
    const patron = new RegExp(escaparRegex(texto(query.q).slice(0, 80)), 'i');
    condiciones.push({
      $or: [
        { nombre: patron },
        { 'direccion.calle': patron },
      ],
    });
  }
  if (query.id_propietario !== undefined) {
    if (!esObjectIdValido(texto(query.id_propietario))) {
      return { filtro: null, error: { status: 400, mensaje: 'id_propietario inválido.' } };
    }
    const propiedades = await Propiedad.find({
      id_propietario: query.id_propietario,
      id_agrupamiento: { $ne: null },
    }).select('id_agrupamiento');
    condiciones.push({
      _id: {
        $in: [...new Set(
          propiedades.map((propiedad) => resolverId(propiedad.id_agrupamiento)).filter(Boolean),
        )],
      },
    });
  }

  return {
    filtro: condiciones.length === 0
      ? {}
      : condiciones.length === 1
        ? condiciones[0]
        : { $and: condiciones },
    error: null,
  };
};

const puedeGestionarComoPropietario = (agrupamiento, usuario) => {
  const { id, roles } = obtenerIdentidad(usuario);
  return Boolean(
    id
    && esPropietario(roles)
    && !esAdministrador(roles)
    && esGestor(agrupamiento, id),
  );
};

const listarAgrupamientos = async (req, res) => {
  try {
    if (esAdministrador(obtenerIdentidad(req.usuario).roles)) {
      return responder(res, 403, null, 'Los administradores no pueden acceder a la pantalla de agrupamientos.');
    }
    const { filtro, error } = await construirFiltroListado(req.query || {}, req.usuario);
    if (error) return responder(res, error.status, null, error.mensaje);

    const agrupamientos = await Agrupamiento.find(filtro)
      .populate('id_administrador', 'nombre apellido email')
      .populate('gestores', 'nombre apellido email')
      .sort({ nombre: 1 });
    return responder(res, 200, agrupamientos, 'Agrupamientos consultados.');
  } catch (error) {
    console.error('Error al listar agrupamientos:', error);
    return responder(res, 500, null, 'No se pudieron consultar los agrupamientos.');
  }
};

const obtenerAgrupamiento = async (req, res) => {
  if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');
  if (esAdministrador(obtenerIdentidad(req.usuario).roles)) {
    return responder(res, 403, null, 'Los administradores no pueden acceder a la pantalla de agrupamientos.');
  }

  try {
    const { agrupamiento, error } = await obtenerAgrupamientoVisible(req.params.id, req.usuario);
    if (error) return responder(res, error.status, null, error.mensaje);

    const agrupamientoPopulado = await Agrupamiento.findById(agrupamiento._id)
      .populate('id_administrador', 'nombre apellido email')
      .populate('gestores', 'nombre apellido email');
    return responder(res, 200, agrupamientoPopulado, 'Agrupamiento consultado.');
  } catch (error) {
    console.error('Error al consultar agrupamiento:', error);
    return responder(res, 500, null, 'No se pudo consultar el agrupamiento.');
  }
};

const crearAgrupamiento = async (req, res) => {
  try {
    const { id: usuarioId, roles } = obtenerIdentidad(req.usuario);
    if (!esPropietario(roles) || esAdministrador(roles)) {
      return responder(res, 403, null, 'Solo un propietario puede crear agrupamientos.');
    }

    const body = req.body || {};
    const nombre = texto(body.nombre);
    if (!nombre) return responder(res, 400, null, 'nombre es obligatorio.');
    const tipo = texto(body.tipo).toUpperCase();
    if (!TIPOS.includes(tipo)) return responder(res, 400, null, 'tipo inválido.');
    const estado = body.estado === undefined ? 'ACTIVO' : texto(body.estado).toUpperCase();
    if (!ESTADOS.includes(estado)) return responder(res, 400, null, 'estado inválido.');

    const errorDireccion = validarDireccion(body.direccion);
    if (errorDireccion) return responder(res, 400, null, errorDireccion);
    const errorConfiguracion = validarConfiguracion(body.configuracion);
    if (errorConfiguracion) return responder(res, 400, null, errorConfiguracion);
    const errorGestores = await validarGestores(body.gestores);
    if (errorGestores) return responder(res, 400, null, errorGestores);
    const errorFotos = validarFotos(body.fotos);
    if (errorFotos) return responder(res, 400, null, errorFotos);
    const errorServicios = validarServicios(body.servicios);
    if (errorServicios) return responder(res, 400, null, errorServicios);

    const agrupamiento = new Agrupamiento({
      nombre,
      tipo,
      estado,
      direccion: normalizarDireccion(body.direccion),
      descripcion: texto(body.descripcion),
      fotos: body.fotos || [],
      id_administrador: usuarioId,
      gestores: Array.isArray(body.gestores) ? body.gestores : [],
      contacto: normalizarContacto(body.contacto),
      servicios: Array.isArray(body.servicios) ? body.servicios : [],
      configuracion: normalizarConfiguracion(body.configuracion),
    });

    await agrupamiento.save();
    return responder(res, 201, agrupamiento, 'Agrupamiento creado.');
  } catch (error) {
    if (error.name === 'ValidationError') return responder(res, 400, null, error.message);
    console.error('Error al crear agrupamiento:', error);
    return responder(res, 500, null, 'No se pudo crear el agrupamiento.');
  }
};

const actualizarAgrupamiento = async (req, res) => {
  if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');

  try {
    const agrupamiento = await Agrupamiento.findById(req.params.id);
    if (!agrupamiento) return responder(res, 404, null, 'Agrupamiento no encontrado.');
    if (!puedeGestionarComoPropietario(agrupamiento, req.usuario)) {
      return responder(res, 403, null, 'No tenés permiso para modificar este agrupamiento.');
    }

    const body = req.body || {};
    if (body.nombre !== undefined) {
      const nombre = texto(body.nombre);
      if (!nombre) return responder(res, 400, null, 'nombre no puede estar vacío.');
      agrupamiento.nombre = nombre;
    }
    if (body.tipo !== undefined) {
      const tipo = texto(body.tipo).toUpperCase();
      if (!TIPOS.includes(tipo)) return responder(res, 400, null, 'tipo inválido.');
      agrupamiento.tipo = tipo;
    }
    if (body.estado !== undefined) {
      const estado = texto(body.estado).toUpperCase();
      if (!ESTADOS.includes(estado)) return responder(res, 400, null, 'estado inválido.');
      agrupamiento.estado = estado;
    }
    if (body.direccion !== undefined) {
      const errorDireccion = validarDireccion(body.direccion, { parcial: true });
      if (errorDireccion) return responder(res, 400, null, errorDireccion);
      agrupamiento.direccion = {
        ...normalizarDireccion(agrupamiento.direccion),
        ...normalizarDireccion({ ...agrupamiento.direccion, ...body.direccion }),
      };
    }
    if (body.descripcion !== undefined) agrupamiento.descripcion = texto(body.descripcion);
    if (body.contacto !== undefined) {
      if (typeof body.contacto !== 'object' || body.contacto === null) {
        return responder(res, 400, null, 'contacto debe ser un objeto.');
      }
      const contactoActual = normalizarContacto(agrupamiento.contacto);
      const contactoNuevo = { ...contactoActual };
      for (const campo of ['nombre', 'telefono', 'email']) {
        if (body.contacto[campo] !== undefined) {
          contactoNuevo[campo] = texto(body.contacto[campo]);
          if (campo === 'email') contactoNuevo[campo] = contactoNuevo[campo].toLowerCase();
        }
      }
      agrupamiento.contacto = contactoNuevo;
    }
    if (body.servicios !== undefined) {
      const errorServicios = validarServicios(body.servicios);
      if (errorServicios) return responder(res, 400, null, errorServicios);
      agrupamiento.servicios = body.servicios;
    }
    if (body.gestores !== undefined) {
      const errorGestores = await validarGestores(body.gestores);
      if (errorGestores) return responder(res, 400, null, errorGestores);
      agrupamiento.gestores = body.gestores;
    }
    let fotosEliminadas = [];
    if (body.fotos !== undefined) {
      const errorFotos = validarFotos(body.fotos);
      if (errorFotos) return responder(res, 400, null, errorFotos);
      fotosEliminadas = (agrupamiento.fotos || []).filter((url) => !body.fotos.includes(url));
      agrupamiento.fotos = body.fotos;
    }
    if (body.configuracion !== undefined) {
      const errorConfiguracion = validarConfiguracion(body.configuracion);
      if (errorConfiguracion) return responder(res, 400, null, errorConfiguracion);
      const configuracionActual = normalizarConfiguracion(agrupamiento.configuracion);
      const configuracionNueva = { ...configuracionActual };
      if (body.configuracion.moneda !== undefined) {
        configuracionNueva.moneda = texto(body.configuracion.moneda) || 'ARS';
      }
      agrupamiento.configuracion = configuracionNueva;
    }
    await agrupamiento.save();
    const advertencias = [];
    for (const url of fotosEliminadas) {
      const asset = parsePropiedadImageUrl(url);
      if (!asset) {
        advertencias.push('Una foto quitada no se pudo borrar de Cloudinary porque su URL no es compatible.');
        continue;
      }

      try {
        const [usadaEnPropiedad, usadaEnOtroAgrupamiento] = await Promise.all([
          Propiedad.findOne({ fotos: url }),
          Agrupamiento.findOne({ _id: { $ne: agrupamiento._id }, fotos: url }),
        ]);
        if (usadaEnPropiedad || usadaEnOtroAgrupamiento) continue;

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
        console.error(`No se pudo borrar de Cloudinary una foto del agrupamiento ${agrupamiento._id}:`, error.message);
        advertencias.push('El agrupamiento se guardó, pero no se pudo borrar una de las fotos quitadas de Cloudinary.');
      }
    }

    const agrupamientoActualizado = typeof agrupamiento.toObject === 'function'
      ? agrupamiento.toObject()
      : agrupamiento;
    if (advertencias.length > 0) agrupamientoActualizado.advertencias = advertencias;
    return responder(res, 200, agrupamientoActualizado, 'Agrupamiento actualizado.');
  } catch (error) {
    if (error.name === 'ValidationError') return responder(res, 400, null, error.message);
    console.error('Error al actualizar agrupamiento:', error);
    return responder(res, 500, null, 'No se pudo actualizar el agrupamiento.');
  }
};

const eliminarAgrupamiento = async (req, res) => {
  if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');

  try {
    const agrupamiento = await Agrupamiento.findById(req.params.id);
    if (!agrupamiento) return responder(res, 404, null, 'Agrupamiento no encontrado.');
    if (!puedeGestionarComoPropietario(agrupamiento, req.usuario)) {
      return responder(res, 403, null, 'No tenés permiso para dar de baja este agrupamiento.');
    }

    const propiedadesActivas = await Propiedad.countDocuments({
      id_agrupamiento: agrupamiento._id,
      estado: { $ne: 'INACTIVA' },
    });
    if (propiedadesActivas > 0) {
      return responder(
        res,
        409,
        null,
        'No se puede dar de baja un agrupamiento con propiedades activas.',
      );
    }

    agrupamiento.estado = 'INACTIVO';
    await agrupamiento.save();
    return responder(res, 200, agrupamiento, 'Agrupamiento dado de baja.');
  } catch (error) {
    console.error('Error al dar de baja agrupamiento:', error);
    return responder(res, 500, null, 'No se pudo dar de baja el agrupamiento.');
  }
};

module.exports = {
  TIPOS,
  ESTADOS,
  listarAgrupamientos,
  obtenerAgrupamiento,
  crearAgrupamiento,
  actualizarAgrupamiento,
  eliminarAgrupamiento,
};
