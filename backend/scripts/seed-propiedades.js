require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Usuario = require('../src/models/usuario');
const Propiedad = require('../src/models/propiedad');
const Contrato = require('../src/models/contrato');

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI no definida en .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');

  const colecciones = await mongoose.connection.db.listCollections().toArray();
  const nombres = colecciones.map((c) => c.name);
  if (nombres.includes('propiedads')) {
    await mongoose.connection.db.dropCollection('propiedads');
    console.log('Colección obsoleta propiedads eliminada');
  }

  const propietario1 = await Usuario.findOne({ email: 'propietario1@alquilar.com' });
  const propietario2 = await Usuario.findOne({ email: 'propietario2@alquilar.com' });
  const inquilino1 = await Usuario.findOne({ email: 'inquilino1@alquilar.com' });
  const inquilino2 = await Usuario.findOne({ email: 'inquilino2@alquilar.com' });

  if (!propietario1 || !propietario2 || !inquilino1 || !inquilino2) {
    console.error('Faltan usuarios seed. Ejecutá primero: npm run seed');
    process.exit(1);
  }

  await Contrato.deleteMany({});
  await Propiedad.deleteMany({});
  console.log('Colecciones propiedades y contratos vaciadas');

  const propiedadesSeed = [
    {
      id_propietario: propietario1._id,
      direccion: 'Av. Rivadavia 1234, CABA',
      tipo: 'Departamento',
      ambientes: 2,
      descripcion: 'Luminoso, cerca del subte',
      estado: 'ALQUILADA',
      valor_base: 350000,
      fotos: [],
    },
    {
      id_propietario: propietario1._id,
      direccion: 'Calle Falsa 742, La Plata',
      tipo: 'Casa',
      ambientes: 3,
      descripcion: 'Con patio y cochera',
      estado: 'DISPONIBLE',
      valor_base: 420000,
      fotos: [],
    },
    {
      id_propietario: propietario2._id,
      direccion: 'San Martín 500, Rosario',
      tipo: 'Monoambiente',
      ambientes: 1,
      descripcion: 'Ideal estudiante',
      estado: 'DISPONIBLE',
      valor_base: 280000,
      fotos: [],
    },
  ];

  const propiedades = [];
  for (const datos of propiedadesSeed) {
    const propiedad = new Propiedad(datos);
    await propiedad.save();
    propiedades.push(propiedad);
    console.log(`  Propiedad: ${propiedad.direccion} → _id: ${propiedad._id}`);
  }

  const contratoVigente = new Contrato({
    id_propiedad: propiedades[0]._id,
    id_inquilino: inquilino1._id,
    fecha_inicio: new Date('2026-01-01'),
    monto_mensual: 350000,
    dia_vencimiento: 10,
    estado: 'VIGENTE',
    garante: {
      nombre: 'Garante Demo',
      telefono: '1122334455',
      recibo: 'https://ejemplo.com/recibo.pdf',
    },
  });
  await contratoVigente.save();
  console.log(`  Contrato vigente → _id: ${contratoVigente._id}`);

  const contratoHistorico = new Contrato({
    id_propiedad: propiedades[0]._id,
    id_inquilino: inquilino2._id,
    fecha_inicio: new Date('2024-06-01'),
    fecha_fin: new Date('2025-12-31'),
    monto_mensual: 300000,
    dia_vencimiento: 5,
    estado: 'FINALIZADO',
    garante: { nombre: 'Garante Anterior' },
  });
  await contratoHistorico.save();
  console.log(`  Contrato histórico → _id: ${contratoHistorico._id}`);

  console.log('\nSeed propiedades/contratos completado');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
