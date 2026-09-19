const mongoose = require('mongoose');

const contratoSchema = new mongoose.Schema(
  {
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
    fecha_inicio: { type: Date, required: true },
    fecha_fin: { type: Date },
    monto_mensual: { type: Number, required: true, min: 0 },
    dia_vencimiento: { type: Number, required: true, min: 1, max: 28 },
    estado: {
      type: String,
      enum: ['BORRADOR', 'VIGENTE', 'FINALIZADO', 'CANCELADO'],
      default: 'BORRADOR',
    },
    garante: {
      nombre: { type: String },
      telefono: { type: String },
      recibo: { type: String },
    },
  },
  { timestamps: true, collection: 'contratos' },
);

contratoSchema.index(
  { id_propiedad: 1, estado: 1 },
  {
    unique: true,
    partialFilterExpression: { estado: 'VIGENTE' },
  },
);

contratoSchema.index({ id_inquilino: 1 });

module.exports = mongoose.model('Contrato', contratoSchema);
