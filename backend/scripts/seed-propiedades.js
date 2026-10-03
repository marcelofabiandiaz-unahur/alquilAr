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

  const propietario1 = await Usuario.findOne({ email: 'propietario1@alquilar.com' });
  const propietario2 = await Usuario.findOne({ email: 'propietario2@alquilar.com' });
  const inquilino1 = await Usuario.findOne({ email: 'inquilino1@alquilar.com' });
  const inquilino2 = await Usuario.findOne({ email: 'inquilino2@alquilar.com' });

  if (!propietario1 || !propietario2 || !inquilino1 || !inquilino2) {
    console.error('Faltan usuarios seed. Ejecutá primero: npm run seed');
    process.exit(1);
  }

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
    let propiedad = await Propiedad.findOne({
      id_propietario: datos.id_propietario,
      direccion: datos.direccion,
    });
    if (propiedad) {
      console.log(`  Propiedad existente: ${propiedad.direccion}`);
    } else {
      propiedad = new Propiedad(datos);
      await propiedad.save();
      console.log(`  Propiedad creada: ${propiedad.direccion} → _id: ${propiedad._id}`);
    }
    propiedades.push(propiedad);
  }

  const contratosSeed = [
    {
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
    },
    {
      id_propiedad: propiedades[0]._id,
      id_inquilino: inquilino2._id,
      fecha_inicio: new Date('2024-06-01'),
      fecha_fin: new Date('2025-12-31'),
      monto_mensual: 300000,
      dia_vencimiento: 5,
      estado: 'FINALIZADO',
      garante: { nombre: 'Garante Anterior' },
    },
  ];

  for (const datos of contratosSeed) {
    const contratoExistente = await Contrato.findOne({
      id_propiedad: datos.id_propiedad,
      id_inquilino: datos.id_inquilino,
      fecha_inicio: datos.fecha_inicio,
    });
    if (contratoExistente) {
      console.log(`  Contrato existente: ${contratoExistente._id}`);
      continue;
    }

    const contrato = new Contrato(datos);
    await contrato.save();
    console.log(`  Contrato creado → _id: ${contrato._id}`);
  }

  console.log('\nSeed propiedades/contratos completado');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
