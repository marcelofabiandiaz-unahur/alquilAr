const mongoose = require('mongoose');
const Usuario = require('./usuario.model');

const propietarioSchema = new mongoose.Schema({
  cbu_alias: { type: String, required: true },
  cuit_cuil: { type: String, required: true }
});

module.exports = Usuario.discriminator('PROPIETARIO', propietarioSchema);