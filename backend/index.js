require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const Usuario = require('./src/models/usuario'); // 👈 Importamos el modelo aislado

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('🚀 Conectado a MongoDB Atlas de forma modular'))
  .catch(err => console.error('❌ Error de conexión:', err));

// 🛣️ 1. ENDPOINT: REGISTRO (Ahora encriptará de verdad)
app.post('/api/usuarios', async (req, res) => {
  try {
    const nuevoUsuario = new Usuario(req.body);
    await nuevoUsuario.save();
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al crear usuario', error: error.message });
  }
});

// 🛣️ 2. ENDPOINT: LOGIN (Verifica Argon2id y genera JWT)
app.post('/api/usuarios/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar si el usuario existe en Atlas
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas (Email no encontrado)' });
    }

    // Comparar la contraseña ingresada con el Hash seguro de Argon2id
    const contraseñaValida = await argon2.verify(usuario.password, password);
    if (!contraseñaValida) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas (Contraseña incorrecta)' });
    }

    // Generar el Token de Sesión JWT (Firma válida por 24 horas)
    const token = jwt.sign(
      { id: usuario._id, roles: usuario.roles },
      process.env.JWT_SECRET || 'CLAVE_SECRETA_MOCK_FACULTAD',
      { expiresIn: '24h' }
    );

    res.json({
      mensaje: '¡Login exitoso! 🔓',
      token,
      usuario: { nombre: usuario.nombre, apellido: usuario.apellido, roles: usuario.roles }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET auxiliar para listar
app.get('/api/usuarios', async (req, res) => {
  const lista = await Usuario.find();
  res.json(lista);
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
