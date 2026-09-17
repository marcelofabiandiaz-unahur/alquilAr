const mongoose = require('mongoose');
const Usuario = require('./usuario.model');

const inquilinoSchema = new mongoose.Schema({
  recibo_sueldo: { type: String }
});

module.exports = Usuario.discriminator('INQUILINO', inquilinoSchema);