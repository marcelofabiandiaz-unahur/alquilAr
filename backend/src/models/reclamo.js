const mongoose = require('mongoose');

const reclamoSchema = new mongoose.Schema(
  {
    id_contrato: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contrato',
      required: true,
    },
    id_propiedad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Propiedad',
      required: true,
    },
    id_inquilino: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    asunto: { type: String, required: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    prioridad: {
      type: String,
      enum: ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'],
      default: 'MEDIA',
    },
    categoria: { type: String, required: true, trim: true },
    estado: {
      type: String,
      enum: ['PENDIENTE', 'EN_PROCESO', 'RESUELTO'],
      default: 'PENDIENTE',
    },
    fecha_creacion: { type: Date, default: Date.now },
    fecha_actualizacion: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'reclamos' },
);

reclamoSchema.index({ id_inquilino: 1, fecha_creacion: -1 });
reclamoSchema.index({ id_propiedad: 1, estado: 1 });

module.exports = mongoose.model('Reclamo', reclamoSchema);
