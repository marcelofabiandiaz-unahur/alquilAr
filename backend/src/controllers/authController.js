const Usuario = require('../models/usuario.model');
const Inquilino = require('../models/inquilino.model');
const Propietario = require('../models/propietario.model');
const Administrador = require('../models/administrador.model');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

const registrarUsuario = async (req, res) => {
  try {
    const { rol } = req.body;
    let nuevoUsuario;

    if (rol === 'INQUILINO') nuevoUsuario = new Inquilino(req.body);
    else if (rol === 'PROPIETARIO') nuevoUsuario = new Propietario(req.body);
    else if (rol === 'ADMINISTRADOR') nuevoUsuario = new Administrador(req.body);
    else {
      return res.status(400).json({ success: false, data: null, message: 'Rol inválido o faltante' });
    }

    await nuevoUsuario.save();
    nuevoUsuario.password = undefined; 

    res.status(201).json({
      success: true,
      data: nuevoUsuario,
      message: 'Usuario registrado con éxito'
    });
  } catch (error) {
    res.status(400).json({ success: false, data: null, message: error.message });
  }
};

const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ success: false, data: null, message: 'Credenciales inválidas' });
    }

    const passwordValido = await argon2.verify(usuario.password, password);
    if (!passwordValido) {
      return res.status(401).json({ success: false, data: null, message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        usuario: { id: usuario._id, nombre: usuario.nombre, rol: usuario.rol }
      },
      message: 'Login exitoso'
    });

  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Error en el servidor' });
  }
};

module.exports = { registrarUsuario, loginUsuario };