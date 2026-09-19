const mongoose = require("mongoose");
const argon2 = require("argon2");

const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    roles: {
      type: [String],
      enum: ["USUARIO", "INQUILINO", "PROPIETARIO", "ADMINISTRADOR"],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Debe tener al menos un rol",
      },
    },
    telefono: { type: String },
    cbu_alias: { type: String },
    cuit_cuil: { type: String },
    estado: {
      type: String,
      enum: ["ACTIVO", "INACTIVO", "PENDIENTE"],
      default: "ACTIVO",
    },
  },
  { timestamps: true },
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
