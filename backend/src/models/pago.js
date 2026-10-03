const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema(
  {
    id_contrato: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contrato',
      required: true,
    },
    mes_correspondiente: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    monto_total: { type: Number, required: true, min: 0 },
    fecha_vencimiento: { type: Date, required: true },
    fecha_pago: { type: Date, default: null },
    estado: {
      type: String,
      enum: ['PENDIENTE', 'PAGADO', 'ATRASADO'],
      default: 'PENDIENTE',
    },
    comprobante_url: { type: String, default: '' },
  },
  { timestamps: true, collection: 'pagos' },
);

pagoSchema.index({ id_contrato: 1, mes_correspondiente: 1 }, { unique: true });

module.exports = mongoose.model('Pago', pagoSchema);
