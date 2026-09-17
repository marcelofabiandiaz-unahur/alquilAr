const mongoose = require('mongoose');
const Usuario = require('./usuario.model');

// El administrador no tiene atributos extra, pero necesita el discriminador
const administradorSchema = new mongoose.Schema({});

module.exports = Usuario.discriminator('ADMINISTRADOR', administradorSchema);