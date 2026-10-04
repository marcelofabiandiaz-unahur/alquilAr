const Usuario = require('../models/usuario');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

const registrarUsuario = async (req, res) => {
  try {
    const datos = { ...(req.body || {}), roles: ['USUARIO'] };

    const nuevoUsuario = new Usuario(datos);
    await nuevoUsuario.save();

    const usuarioRespuesta = nuevoUsuario.toObject();
    delete usuarioRespuesta.password;

    res.status(201).json(usuarioRespuesta);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al crear usuario', error: error.message });
  }
};

const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ mensaje: 'Email y contraseña son obligatorios' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    const usuario = await Usuario.findOne({ email: emailNormalizado });
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas (Email no encontrado)' });
    }

    const passwordValido = await argon2.verify(usuario.password, password);
    if (!passwordValido) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas (Contraseña incorrecta)' });
    }

    const token = jwt.sign(
      { id: usuario._id, roles: usuario.roles },
      getJwtSecret(),
      { expiresIn: '24h' },
    );

    res.json({
      mensaje: '¡Login exitoso! 🔓',
      token,
      usuario: {
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        roles: usuario.roles,
        email: usuario.email,
      },
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

const listarUsuarios = async (req, res) => {
  try {
    const lista = await Usuario.find().select('-password');
    res.json(lista);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

const obtenerSolicitudPropietario = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('solicitud_propietario');
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    return res.json({ solicitud: usuario.solicitud_propietario || null });
  } catch (error) {
    return res.status(500).json({ mensaje: error.message });
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
      usuario.roles.includes('ADMINISTRADOR')
      || (!usuario.roles.includes('USUARIO') && !usuario.roles.includes('INQUILINO'))
    ) {
      return res.status(403).json({ mensaje: 'Esta cuenta no puede solicitar el rol Propietario.' });
    }
    if (usuario.roles.includes('PROPIETARIO')) {
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
    return res.status(400).json({ mensaje: 'No se pudo crear la solicitud.', error: error.message });
  }
};

const aprobarSolicitudPropietario = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    if (usuario.solicitud_propietario?.estado !== 'PENDIENTE') {
      return res.status(409).json({ mensaje: 'El usuario no tiene una solicitud pendiente.' });
    }

    if (!usuario.roles.includes('PROPIETARIO')) usuario.roles.push('PROPIETARIO');
    usuario.cbu_alias = usuario.solicitud_propietario.cbu_alias;
    usuario.cuit_cuil = usuario.solicitud_propietario.cuit_cuil;
    usuario.solicitud_propietario.estado = 'APROBADA';
    await usuario.save();

    const respuesta = usuario.toObject();
    delete respuesta.password;
    return res.json(respuesta);
  } catch (error) {
    return res.status(400).json({ mensaje: 'No se pudo aprobar la solicitud.', error: error.message });
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

    const rolesValidos = ['USUARIO', 'INQUILINO', 'PROPIETARIO', 'ADMINISTRADOR'];
    for (const rol of agregar) {
      if (!rolesValidos.includes(rol)) {
        return res.status(400).json({ mensaje: `Rol inválido: ${rol}` });
      }
      if (!usuario.roles.includes(rol)) {
        usuario.roles.push(rol);
      }
    }

    await usuario.save();
    const respuesta = usuario.toObject();
    delete respuesta.password;
    res.json(respuesta);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al actualizar roles', error: error.message });
  }
};

module.exports = {
  registrarUsuario,
  loginUsuario,
  listarUsuarios,
  agregarRolesUsuario,
  obtenerSolicitudPropietario,
  solicitarRolPropietario,
  aprobarSolicitudPropietario,
};
