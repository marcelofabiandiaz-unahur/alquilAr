const mongoose = require('mongoose');

const propiedadSchema = new mongoose.Schema(
  {
    id_propietario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    direccion: { type: String, required: true },
    tipo: { type: String, required: true },
    ambientes: { type: Number, required: true, min: 1 },
    descripcion: { type: String },
    estado: {
      type: String,
      enum: ['DISPONIBLE', 'ALQUILADA', 'EN_MANTENIMIENTO', 'INACTIVA'],
      default: 'DISPONIBLE',
    },
    valor_base: { type: Number, required: true, min: 0 },
    fotos: [{ type: String }],
  },
  { timestamps: true, collection: 'propiedades' },
);

propiedadSchema.index({ id_propietario: 1 });

module.exports = mongoose.model('Propiedad', propiedadSchema);
