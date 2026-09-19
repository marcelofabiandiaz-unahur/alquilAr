require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Usuario = require('../src/models/usuario');

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'ClaveTest123';

const usuariosSeed = [
  { nombre: 'Usuario', apellido: 'Uno', dni: '99000001', email: 'usuario1@alquilar.com', roles: ['USUARIO'] },
  { nombre: 'Usuario', apellido: 'Dos', dni: '99000002', email: 'usuario2@alquilar.com', roles: ['USUARIO'] },
  { nombre: 'Inquilino', apellido: 'Uno', dni: '99000011', email: 'inquilino1@alquilar.com', roles: ['INQUILINO'] },
  { nombre: 'Inquilino', apellido: 'Dos', dni: '99000012', email: 'inquilino2@alquilar.com', roles: ['INQUILINO'] },
  {
    nombre: 'Propietario',
    apellido: 'Uno',
    dni: '99000021',
    email: 'propietario1@alquilar.com',
    roles: ['PROPIETARIO'],
    cbu_alias: 'propietario1.alias',
    cuit_cuil: '20-99000021-0',
  },
  {
    nombre: 'Propietario',
    apellido: 'Dos',
    dni: '99000022',
    email: 'propietario2@alquilar.com',
    roles: ['PROPIETARIO'],
    cbu_alias: 'propietario2.alias',
    cuit_cuil: '20-99000022-0',
  },
  { nombre: 'Mixto', apellido: 'Uno', dni: '99000031', email: 'mixto1@alquilar.com', roles: ['PROPIETARIO', 'INQUILINO'] },
  { nombre: 'Admin', apellido: 'Uno', dni: '99000041', email: 'admin1@alquilar.com', roles: ['ADMINISTRADOR'] },
  { nombre: 'Admin', apellido: 'Dos', dni: '99000042', email: 'admin2@alquilar.com', roles: ['ADMINISTRADOR'] },
];

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI no definida en .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');

  const resultado = await Usuario.deleteMany({});
  console.log(`Colección usuarios vaciada: ${resultado.deletedCount} documentos eliminados`);

  for (const datos of usuariosSeed) {
    const usuario = new Usuario({ ...datos, password: SEED_PASSWORD });
    await usuario.save();
    console.log(`  ${usuario.email} → _id: ${usuario._id}`);
  }

  console.log(`\nSeed completado: ${usuariosSeed.length} usuarios insertados`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
