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
const {
  buscarAgrupamientosVisibles,
  puedeGestionarAgrupamiento,
  obtenerAgrupamientoVisible,
} = require('../utils/agrupamientoHelpers');

const TIPOS = ['EDIFICIO', 'COMPLEJO', 'CONSORCIO', 'CONJUNTO', 'BARRIO_CERRADO', 'OTRO'];
const ESTADOS = ['ACTIVO', 'INACTIVO'];
const CODIGO_REGEX = /^[A-Z0-9-]{3,20}$/;

const responder = (res, status, data, message) =>
  res.status(status).json({ success: status < 400, data, message });

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

const normalizarCodigo = (valor) => texto(valor).toUpperCase();

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
  const dia = configuracion.dia_vencimiento_default;
  return {
    moneda: texto(configuracion.moneda) || 'ARS',
    dia_vencimiento_default: dia === undefined || dia === null || dia === ''
      ? 10
      : Number(dia),
  };
};

const validarConfiguracion = (configuracion) => {
  if (configuracion !== undefined && (typeof configuracion !== 'object' || configuracion === null)) {
    return 'La configuración debe ser un objeto.';
  }
  if (!configuracion) return null;
  if (configuracion.dia_vencimiento_default !== undefined) {
    const dia = Number(configuracion.dia_vencimiento_default);
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
      return 'configuracion.dia_vencimiento_default debe ser un entero entre 1 y 28.';
    }
  }
  return null;
};

const validarGestores = (gestores) => {
  if (gestores === undefined) return null;
  if (!Array.isArray(gestores)) return 'gestores debe ser un array.';
  const invalido = gestores.find((gestor) => !esObjectIdValido(String(gestor)));
  if (invalido !== undefined) return 'gestores contiene un ID inválido.';
  return null;
};

const validarServicios = (servicios) => {
  if (servicios === undefined) return null;
  if (!Array.isArray(servicios) || servicios.some((servicio) => typeof servicio !== 'string')) {
    return 'servicios debe ser un array de textos.';
  }
  return null;
};

const validarAdministrador = async (idAdministrador, res) => {
  if (!esObjectIdValido(String(idAdministrador))) {
    responder(res, 400, null, 'id_administrador inválido.');
    return null;
  }
  const usuario = await Usuario.findById(idAdministrador);
  if (!usuario) {
    responder(res, 404, null, 'Administrador no encontrado.');
    return null;
  }
  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];
  if (!roles.includes('ADMINISTRADOR') && !roles.includes('PROPIETARIO')) {
    responder(res, 400, null, 'id_administrador debe tener rol ADMINISTRADOR o PROPIETARIO.');
    return null;
  }
  return usuario;
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
    condiciones.push({ 'direccion.ciudad': new RegExp(texto(query.ciudad), 'i') });
  }
  if (query.q !== undefined) {
    const patron = new RegExp(texto(query.q), 'i');
    condiciones.push({
      $or: [
        { nombre: patron },
        { codigo: patron },
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

const listarAgrupamientos = async (req, res) => {
  try {
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
    if (!esAdministrador(roles) && !esPropietario(roles)) {
      return responder(res, 403, null, 'Solo un administrador o propietario puede crear agrupamientos.');
    }

    const body = req.body || {};
    const codigo = normalizarCodigo(body.codigo);
    if (!CODIGO_REGEX.test(codigo)) {
      return responder(res, 400, null, 'codigo debe tener entre 3 y 20 caracteres A-Z, 0-9 o guiones.');
    }
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
    const errorGestores = validarGestores(body.gestores);
    if (errorGestores) return responder(res, 400, null, errorGestores);
    const errorServicios = validarServicios(body.servicios);
    if (errorServicios) return responder(res, 400, null, errorServicios);

    let idAdministrador = usuarioId;
    if (esAdministrador(roles) && body.id_administrador) {
      const administrador = await validarAdministrador(body.id_administrador, res);
      if (!administrador) return undefined;
      idAdministrador = administrador._id;
    }

    const agrupamiento = new Agrupamiento({
      codigo,
      nombre,
      tipo,
      estado,
      direccion: normalizarDireccion(body.direccion),
      descripcion: texto(body.descripcion),
      id_administrador: idAdministrador,
      gestores: Array.isArray(body.gestores) ? body.gestores : [],
      contacto: normalizarContacto(body.contacto),
      servicios: Array.isArray(body.servicios) ? body.servicios : [],
      configuracion: normalizarConfiguracion(body.configuracion),
    });

    await agrupamiento.save();
    return responder(res, 201, agrupamiento, 'Agrupamiento creado.');
  } catch (error) {
    if (error.code === 11000) {
      return responder(res, 409, null, 'Ya existe un agrupamiento con ese código.');
    }
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
    if (!puedeGestionarAgrupamiento(agrupamiento, req.usuario)) {
      return responder(res, 403, null, 'No tenés permiso para modificar este agrupamiento.');
    }

    const body = req.body || {};
    const { roles } = obtenerIdentidad(req.usuario);

    if (body.codigo !== undefined) {
      const codigo = normalizarCodigo(body.codigo);
      if (!CODIGO_REGEX.test(codigo)) {
        return responder(res, 400, null, 'codigo debe tener entre 3 y 20 caracteres A-Z, 0-9 o guiones.');
      }
      agrupamiento.codigo = codigo;
    }
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
      const errorGestores = validarGestores(body.gestores);
      if (errorGestores) return responder(res, 400, null, errorGestores);
      agrupamiento.gestores = body.gestores;
    }
    if (body.configuracion !== undefined) {
      const errorConfiguracion = validarConfiguracion(body.configuracion);
      if (errorConfiguracion) return responder(res, 400, null, errorConfiguracion);
      const configuracionActual = normalizarConfiguracion(agrupamiento.configuracion);
      const configuracionNueva = { ...configuracionActual };
      if (body.configuracion.moneda !== undefined) {
        configuracionNueva.moneda = texto(body.configuracion.moneda) || 'ARS';
      }
      if (body.configuracion.dia_vencimiento_default !== undefined) {
        configuracionNueva.dia_vencimiento_default = Number(body.configuracion.dia_vencimiento_default);
      }
      agrupamiento.configuracion = configuracionNueva;
    }
    if (body.id_administrador !== undefined) {
      if (!esAdministrador(roles)) {
        return responder(res, 403, null, 'Solo un administrador puede cambiar el administrador del agrupamiento.');
      }
      const administrador = await validarAdministrador(body.id_administrador, res);
      if (!administrador) return undefined;
      agrupamiento.id_administrador = administrador._id;
    }

    await agrupamiento.save();
    return responder(res, 200, agrupamiento, 'Agrupamiento actualizado.');
  } catch (error) {
    if (error.code === 11000) {
      return responder(res, 409, null, 'Ya existe un agrupamiento con ese código.');
    }
    if (error.name === 'ValidationError') return responder(res, 400, null, error.message);
    console.error('Error al actualizar agrupamiento:', error);
    return responder(res, 500, null, 'No se pudo actualizar el agrupamiento.');
  }
};

const eliminarAgrupamiento = async (req, res) => {
  if (!esObjectIdValido(req.params.id)) return responder(res, 400, null, 'ID inválido.');

  try {
    const { roles } = obtenerIdentidad(req.usuario);
    if (!esAdministrador(roles)) {
      return responder(res, 403, null, 'Solo un administrador puede dar de baja agrupamientos.');
    }

    const agrupamiento = await Agrupamiento.findById(req.params.id);
    if (!agrupamiento) return responder(res, 404, null, 'Agrupamiento no encontrado.');

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
