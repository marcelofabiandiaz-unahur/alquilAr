const mongoose = require('mongoose');

const propiedadSchema = new mongoose.Schema(
  {
    id_propietario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    id_agrupamiento: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agrupamiento',
      default: null,
    },
    unidad: {
      identificador: { type: String, trim: true },
    },
    direccion: { type: String, required: true },
    tipo: { type: String, required: true },
    ambientes: { type: Number, required: true, min: 1 },
    descripcion: { type: String, required: true, trim: true },
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
propiedadSchema.index({ id_agrupamiento: 1, estado: 1 });
propiedadSchema.index({ id_agrupamiento: 1, id_propietario: 1 });
propiedadSchema.index(
  { id_agrupamiento: 1, 'unidad.identificador': 1 },
  {
    unique: true,
    partialFilterExpression: {
      id_agrupamiento: { $type: 'objectId' },
      'unidad.identificador': { $type: 'string' },
    },
  },
);

module.exports = mongoose.model('Propiedad', propiedadSchema);
