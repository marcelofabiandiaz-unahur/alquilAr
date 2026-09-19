require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const propiedadRoutes = require('./src/routes/propiedadRoutes');
const contratoRoutes = require('./src/routes/contratoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:5173',
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

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
