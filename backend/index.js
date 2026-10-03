require('dotenv').config();
const { getJwtSecret } = require('./src/config/jwtSecret');
getJwtSecret();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const propiedadRoutes = require('./src/routes/propiedadRoutes');
const contratoRoutes = require('./src/routes/contratoRoutes');
const pagoRoutes = require('./src/routes/pagoRoutes');
const gastoRoutes = require('./src/routes/gastoRoutes');
const reclamoRoutes = require('./src/routes/reclamoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://alquilar-app.onrender.com',
  ],
  credentials: true,
}));

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectado a MongoDB Atlas'))
  .catch((err) => console.error('Error de conexión:', err));

app.use('/api/usuarios', authRoutes);
app.use('/api/propiedades', propiedadRoutes);
app.use('/api/contratos', contratoRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/gastos', gastoRoutes);
app.use('/api/reclamos', reclamoRoutes);
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));