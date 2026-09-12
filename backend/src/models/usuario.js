const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');

const usuarioSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  dni: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  telefono: { type: String },
  roles: {
    type: [String],
    enum: ['USUARIO', 'INQUILINO', 'PROPIETARIO', 'ADMINISTRADOR'], // 👈 Cambiamos VISITANTE por USUARIO
    default: ['USUARIO'] // 👈 Todos nacen con el rol base de USUARIO de forma automática
  }
}, { timestamps: true });

// 🔐 El Middleware asíncrono limpio y corregido para Mongoose moderno
usuarioSchema.pre('save', async function () {
  // Si la contraseña no se modificó, salimos de la función sin hacer nada
  if (!this.isModified('password')) return;
  
  try {
    // Hashea la contraseña con Argon2id de forma directa
    this.password = await argon2.hash(this.password, { type: argon2.argon2id });
  } catch (error) {
    throw error; // Mongoose captura el throw automáticamente y frena el guardado
  }
});


module.exports = mongoose.model('Usuario', usuarioSchema);
