const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const argon2 = require("argon2");

const baseOptions = {
  discriminatorKey: "rol",
  timestamps: true,
};

const usuarioSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    telefono: { type: String },
    estado: {
      type: String,
      enum: ["ACTIVO", "INACTIVO", "PENDIENTE"],
      default: "ACTIVO",
    },
  },
  baseOptions,
);

usuarioSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  try {
    this.password = await argon2.hash(this.password, { type: argon2.argon2id });
  } catch (error) {
    throw error;
  }
});

module.exports = mongoose.model("Usuario", usuarioSchema);
