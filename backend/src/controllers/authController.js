const Usuario = require('../models/usuario');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

const registrarUsuario = async (req, res) => {
  try {
    const datos = { ...req.body };

    if (!datos.roles || !Array.isArray(datos.roles) || datos.roles.length === 0) {
      datos.roles = ['USUARIO'];
    }

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
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas (Email no encontrado)' });
    }

    const passwordValido = await argon2.verify(usuario.password, password);
    if (!passwordValido) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas (Contraseña incorrecta)' });
    }

    const token = jwt.sign(
      { id: usuario._id, roles: usuario.roles },
      process.env.JWT_SECRET || 'CLAVE_SECRETA_MOCK_FACULTAD',
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

module.exports = { registrarUsuario, loginUsuario, listarUsuarios, agregarRolesUsuario };
