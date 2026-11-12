const Usuario = require('../models/usuario');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');
const { ROLES, ROLES_VALIDOS } = require('../config/permisos');

const CAMPOS_PERFIL_EDITABLES = ['telefono', 'cbu_alias', 'cuit_cuil'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOMBRE_REGEX = /^\p{L}+(?:\s+\p{L}+)*$/u;
const DNI_REGEX = /^\d{1,8}$/;
const TELEFONO_REGEX = /^\d{1,15}$/;
const PASSWORD_MIN = 9;
const PASSWORD_MAX = 128;

const serializarUsuario = (usuario) => {
  const respuesta = usuario.toObject ? usuario.toObject() : { ...usuario };
  delete respuesta.password;
  return respuesta;
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

const registrarUsuario = async (req, res) => {
  try {
    const body = req.body || {};
    const nombre = texto(body.nombre);
    const apellido = texto(body.apellido);
    const dni = texto(body.dni);
    const email = texto(body.email).toLowerCase();
    const telefono = texto(body.telefono);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!nombre || nombre.length > 20 || !NOMBRE_REGEX.test(nombre)) {
      return res.status(400).json({ mensaje: 'Ingresá un nombre válido de hasta 20 letras.' });
    }
    if (!apellido || apellido.length > 20 || !NOMBRE_REGEX.test(apellido)) {
      return res.status(400).json({ mensaje: 'Ingresá un apellido válido de hasta 20 letras.' });
    }
    if (!DNI_REGEX.test(dni)) {
      return res.status(400).json({ mensaje: 'Ingresá un DNI válido de hasta 8 números.' });
    }
    if (email.length > 254 || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ mensaje: 'Ingresá un correo electrónico válido.' });
    }
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return res.status(400).json({
        mensaje: `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`,
      });
    }
    if (telefono && !TELEFONO_REGEX.test(telefono)) {
      return res.status(400).json({ mensaje: 'Ingresá un teléfono de hasta 15 dígitos.' });
    }

    // Solo se aceptan los campos del alta: estado, roles, solicitud y datos
    // bancarios quedan fuera del alcance del cliente.
    const nuevoUsuario = new Usuario({
      nombre,
      apellido,
      dni,
      email,
      password,
      telefono,
      roles: [ROLES.USUARIO],
    });
    await nuevoUsuario.save();

    res.status(201).json(serializarUsuario(nuevoUsuario));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ mensaje: 'El email o DNI ya está registrado.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ mensaje: 'Los datos de registro no son válidos.' });
    }
    console.error('Error al registrar usuario:', error);
    return res.status(500).json({ mensaje: 'No se pudo crear la cuenta.' });
  }
};

const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ mensaje: 'Email y contraseña son obligatorios' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    if (emailNormalizado.length > 254 || password.length > PASSWORD_MAX) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
    }

    const usuario = await Usuario.findOne({ email: emailNormalizado }, '+password');
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
    }

    let passwordValido = false;
    try {
      passwordValido = await argon2.verify(usuario.password, password);
    } catch {
      passwordValido = false;
    }
    if (!passwordValido) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
    }

    // La contraseña se valida antes de revelar el estado de la cuenta.
    if (usuario.estado && usuario.estado !== 'ACTIVO') {
      return res.status(403).json({ mensaje: 'Usuario inactivo. Contactá al administrador.' });
    }

    const token = jwt.sign(
      { id: usuario._id, roles: usuario.roles },
      getJwtSecret(),
      { expiresIn: '24h', algorithm: 'HS256' },
    );

    res.json({
      mensaje: '¡Login exitoso! 🔓',
      token,
      usuario: {
        _id: usuario._id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        roles: usuario.roles,
        email: usuario.email,
      },
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ mensaje: 'No se pudo iniciar sesión.' });
  }
};

const obtenerMiPerfil = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id).select('-password');
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }
    res.json(usuario);
  } catch (error) {
    console.error('Error al obtener el perfil:', error);
    res.status(500).json({ mensaje: 'No se pudo obtener el perfil.' });
  }
};

const actualizarMiPerfil = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    for (const campo of CAMPOS_PERFIL_EDITABLES) {
      if (req.body?.[campo] !== undefined) {
        usuario[campo] = req.body[campo];
      }
    }

    await usuario.save();
    res.json(serializarUsuario(usuario));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ mensaje: 'Los datos del perfil no son válidos.' });
    }
    console.error('Error al actualizar el perfil:', error);
    res.status(500).json({ mensaje: 'No se pudo actualizar el perfil.' });
  }
};

const listarUsuarios = async (req, res) => {
  try {
    const lista = await Usuario.find().select('-password');
    res.json(lista);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ mensaje: 'No se pudieron listar los usuarios.' });
  }
};

const listarGestoresAsignables = async (req, res) => {
  try {
    const termino = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    if (termino.length < 2 || termino.length > 100) {
      return res.status(400).json({ mensaje: 'Ingresá al menos 2 caracteres del nombre o apellido.' });
    }

    const partes = termino.split(/\s+/).map((parte) => (
      new RegExp(parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    ));
    const filtro = {
      roles: ROLES.PROPIETARIO,
      estado: 'ACTIVO',
      $and: partes.map((parte) => ({
        $or: [{ nombre: parte }, { apellido: parte }],
      })),
    };
    const propietarios = await Usuario.find(filtro)
      .select('_id nombre apellido email')
      .sort({ nombre: 1, apellido: 1 })
      .limit(10);
    return res.json(propietarios);
  } catch (error) {
    console.error('Error al buscar propietarios asignables como gestores:', error);
    return res.status(500).json({ mensaje: 'No se pudieron consultar los propietarios.' });
  }
};

const obtenerSolicitudPropietario = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('solicitud_propietario');
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    return res.json({ solicitud: usuario.solicitud_propietario || null });
  } catch (error) {
    console.error('Error al obtener la solicitud de propietario:', error);
    return res.status(500).json({ mensaje: 'No se pudo consultar la solicitud.' });
  }
};

const solicitarRolPropietario = async (req, res) => {
  try {
    const { cbu_alias, cuit_cuil } = req.body || {};
    if (typeof cbu_alias !== 'string' || !cbu_alias.trim() || cbu_alias.trim().length > 50) {
      return res.status(400).json({ mensaje: 'El alias/CBU es obligatorio y no puede superar 50 caracteres.' });
    }
    if (typeof cuit_cuil !== 'string' || !/^[\d-]+$/.test(cuit_cuil.trim())
      || cuit_cuil.replace(/\D/g, '').length !== 11) {
      return res.status(400).json({ mensaje: 'El CUIT/CUIL debe contener 11 dígitos.' });
    }

    const usuario = await Usuario.findById(req.usuario.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    if (
      usuario.roles.includes(ROLES.ADMINISTRADOR)
      || (!usuario.roles.includes(ROLES.USUARIO) && !usuario.roles.includes(ROLES.INQUILINO))
    ) {
      return res.status(403).json({ mensaje: 'Esta cuenta no puede solicitar el rol Propietario.' });
    }
    if (usuario.roles.includes(ROLES.PROPIETARIO)) {
      return res.status(409).json({ mensaje: 'El usuario ya tiene el rol Propietario.' });
    }
    if (usuario.solicitud_propietario?.estado === 'PENDIENTE') {
      return res.status(409).json({ mensaje: 'Ya existe una solicitud de propietario pendiente.' });
    }

    usuario.solicitud_propietario = {
      cbu_alias: cbu_alias.trim(),
      cuit_cuil: cuit_cuil.trim(),
      estado: 'PENDIENTE',
      solicitada_en: new Date(),
    };
    await usuario.save();
    return res.status(201).json({ solicitud: usuario.solicitud_propietario });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ mensaje: 'Los datos de la solicitud no son válidos.' });
    }
    console.error('Error al crear la solicitud de propietario:', error);
    return res.status(500).json({ mensaje: 'No se pudo crear la solicitud.' });
  }
};

const aprobarSolicitudPropietario = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    if (usuario.solicitud_propietario?.estado !== 'PENDIENTE') {
      return res.status(409).json({ mensaje: 'El usuario no tiene una solicitud pendiente.' });
    }

    if (!usuario.roles.includes(ROLES.PROPIETARIO)) usuario.roles.push(ROLES.PROPIETARIO);
    usuario.roles = usuario.roles.filter((rol) => rol !== ROLES.USUARIO);
    usuario.cbu_alias = usuario.solicitud_propietario.cbu_alias;
    usuario.cuit_cuil = usuario.solicitud_propietario.cuit_cuil;
    usuario.solicitud_propietario.estado = 'APROBADA';
    await usuario.save();

    return res.json(serializarUsuario(usuario));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ mensaje: 'Los datos de la solicitud no son válidos.' });
    }
    console.error('Error al aprobar la solicitud de propietario:', error);
    return res.status(500).json({ mensaje: 'No se pudo aprobar la solicitud.' });
  }
};

const agregarRolesUsuario = async (req, res) => {
  try {
    const { agregar } = req.body;
    if (!agregar || !Array.isArray(agregar) || agregar.length === 0) {
      return res.status(400).json({ mensaje: 'Debe indicar roles a agregar.' });
    }

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    for (const rol of agregar) {
      if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ mensaje: `Rol inválido: ${rol}` });
      }
      if (!usuario.roles.includes(rol)) {
        usuario.roles.push(rol);
      }
    }

    if (agregar.some((rol) => [ROLES.PROPIETARIO, ROLES.INQUILINO].includes(rol))) {
      usuario.roles = usuario.roles.filter((rol) => rol !== ROLES.USUARIO);
    }

    await usuario.save();
    res.json(serializarUsuario(usuario));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ mensaje: 'Los roles indicados no son válidos.' });
    }
    console.error('Error al actualizar roles:', error);
    res.status(500).json({ mensaje: 'No se pudieron actualizar los roles.' });
  }
};

const actualizarEstadoUsuario = async (req, res) => {
  try {
    const { estado } = req.body || {};
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({ mensaje: 'El estado debe ser ACTIVO o INACTIVO.' });
    }

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }
    if (estado === 'INACTIVO' && String(usuario._id) === String(req.usuario.id)) {
      return res.status(400).json({ mensaje: 'No podés desactivar tu propia cuenta.' });
    }
    if (
      estado === 'INACTIVO'
      && usuario.roles.includes(ROLES.ADMINISTRADOR)
      && usuario.estado !== 'INACTIVO'
    ) {
      const administradoresActivos = await Usuario.countDocuments({
        roles: ROLES.ADMINISTRADOR,
        $or: [{ estado: 'ACTIVO' }, { estado: { $exists: false } }],
      });
      if (administradoresActivos <= 1) {
        return res.status(400).json({ mensaje: 'No se puede desactivar al último administrador activo.' });
      }
    }

    usuario.estado = estado;
    await usuario.save();
    return res.json(serializarUsuario(usuario));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ mensaje: 'El estado indicado no es válido.' });
    }
    console.error('Error al actualizar el estado del usuario:', error);
    return res.status(500).json({ mensaje: 'No se pudo actualizar el estado del usuario.' });
  }
};

module.exports = {
  registrarUsuario,
  loginUsuario,
  obtenerMiPerfil,
  actualizarMiPerfil,
  listarUsuarios,
  listarGestoresAsignables,
  agregarRolesUsuario,
  obtenerSolicitudPropietario,
  solicitarRolPropietario,
  aprobarSolicitudPropietario,
  actualizarEstadoUsuario,
};
