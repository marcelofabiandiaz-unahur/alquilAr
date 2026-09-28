import mongoose from 'mongoose';

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

    asunto: {
      type: String,
      required: true,
      trim: true,
    },

    descripcion: {
      type: String,
      required: true,
      trim: true,
    },

    prioridad: {
      type: String,
      enum: ['BAJA', 'MEDIA', 'ALTA'],
      default: 'MEDIA',
    },

    categoria: {
      type: String,
      enum: ['PLOMERIA', 'ELECTRICIDAD', 'GAS', 'ESTRUCTURAL', 'OTRO'],
      default: 'OTRO',
    },

    estado: {
      type: String,
      enum: ['PENDIENTE', 'EN_PROCESO', 'RESUELTO', 'CANCELADO'],
      default: 'PENDIENTE',
    },
  },
  {
    timestamps: {
      createdAt: 'fecha_creacion',
      updatedAt: 'fecha_actualizacion',
    },
  }
);

export const Reclamo = mongoose.model('Reclamo', reclamoSchema);