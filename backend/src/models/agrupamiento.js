const mongoose = require('mongoose');

const agrupamientoSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9-]{3,20}$/,
    },
    nombre: { type: String, required: true, trim: true, maxlength: 120 },
    tipo: {
      type: String,
      enum: ['EDIFICIO', 'COMPLEJO', 'CONSORCIO', 'CONJUNTO', 'BARRIO_CERRADO', 'OTRO'],
      required: true,
    },
    estado: {
      type: String,
      enum: ['ACTIVO', 'INACTIVO'],
      default: 'ACTIVO',
    },
    direccion: {
      calle: { type: String, required: true, trim: true },
      numero: { type: String, required: true, trim: true },
      ciudad: { type: String, required: true, trim: true },
      provincia: { type: String, required: true, trim: true },
      codigo_postal: { type: String, trim: true },
    },
    descripcion: { type: String, trim: true, maxlength: 1000 },
    id_administrador: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    gestores: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
      },
    ],
    contacto: {
      nombre: { type: String, trim: true },
      telefono: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    servicios: [{ type: String, trim: true }],
    configuracion: {
      moneda: { type: String, default: 'ARS', trim: true },
      dia_vencimiento_default: { type: Number, min: 1, max: 28, default: 10 },
    },
  },
  { timestamps: true, collection: 'agrupamientos' },
);

agrupamientoSchema.index({ codigo: 1 }, { unique: true });
agrupamientoSchema.index({ estado: 1, tipo: 1 });
agrupamientoSchema.index({ id_administrador: 1 });
agrupamientoSchema.index({ gestores: 1 });
agrupamientoSchema.index({ 'direccion.ciudad': 1 });

module.exports = mongoose.model('Agrupamiento', agrupamientoSchema);
