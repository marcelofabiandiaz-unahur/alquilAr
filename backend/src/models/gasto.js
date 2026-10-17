const mongoose = require('mongoose');

const gastoSchema = new mongoose.Schema(
  {
    id_propiedad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Propiedad',
      required: true,
    },
    fecha_emision: { type: Date, required: true },
    monto_total: { type: Number, required: true, min: 0 },
    tipo: { type: String, required: true, trim: true },
    estado_pago: {
      type: String,
      enum: ['PENDIENTE', 'PAGADO', 'ATRASADO'],
      default: 'PENDIENTE',
    },
    proveedor: { type: String, trim: true, default: '' },
    comprobantes: [{ type: String }],
  },
  { timestamps: true, collection: 'gastos' },
);

gastoSchema.index({ id_propiedad: 1, fecha_emision: -1 });

module.exports = mongoose.model('Gasto', gastoSchema);
