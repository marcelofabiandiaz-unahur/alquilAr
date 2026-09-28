import mongoose from 'mongoose';

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
      trim: true,
    },

    monto_total: {
      type: Number,
      required: true,
      min: 0,
    },

    fecha_vencimiento: {
      type: Date,
      required: true,
    },

    fecha_pago: {
      type: Date,
      default: null,
    },

    estado: {
      type: String,
      enum: ['PENDIENTE', 'PAGADO', 'ATRASADO'],
      default: 'PENDIENTE',
    },

    comprobante_url: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Pago = mongoose.model('Pago', pagoSchema);