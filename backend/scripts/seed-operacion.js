require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Contrato = require('../src/models/contrato');
const Pago = require('../src/models/pago');
const Gasto = require('../src/models/gasto');
const Reclamo = require('../src/models/reclamo');

const crearDatosOperacion = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no definida en backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const contrato = await Contrato.findOne({ estado: 'VIGENTE' }).sort({ createdAt: -1 });
  if (!contrato) {
    throw new Error('No hay contratos vigentes. Ejecutá los seeds de usuarios, propiedades y contratos antes.');
  }

  const mes = new Date().toISOString().slice(0, 7);
  let pago = await Pago.findOne({
    id_contrato: contrato._id,
    mes_correspondiente: mes,
  });
  if (!pago) {
    const [anio, numeroMes] = mes.split('-').map(Number);
    pago = new Pago({
      id_contrato: contrato._id,
      mes_correspondiente: mes,
      monto_total: contrato.monto_mensual,
      fecha_vencimiento: new Date(anio, numeroMes - 1, contrato.dia_vencimiento, 12),
    });
    await pago.save();
  }

  const gasto = await Gasto.findOne({
    id_propiedad: contrato.id_propiedad,
    tipo: 'MANTENIMIENTO',
    proveedor: 'AlquilAR - dato de prueba',
  });
  if (!gasto) {
    await new Gasto({
      id_propiedad: contrato.id_propiedad,
      fecha_emision: new Date(),
      monto_total: 15000,
      tipo: 'MANTENIMIENTO',
      estado_pago: 'PENDIENTE',
      proveedor: 'AlquilAR - dato de prueba',
      comprobantes: [],
    }).save();
  }

  const reclamo = await Reclamo.findOne({
    id_contrato: contrato._id,
    asunto: 'Consulta de mantenimiento de prueba',
  });
  if (!reclamo) {
    await new Reclamo({
      id_contrato: contrato._id,
      id_propiedad: contrato.id_propiedad,
      id_inquilino: contrato.id_inquilino,
      asunto: 'Consulta de mantenimiento de prueba',
      descripcion: 'Registro de prueba creado para validar el flujo operativo de semana 4.',
      prioridad: 'BAJA',
      categoria: 'MANTENIMIENTO',
      estado: 'PENDIENTE',
    }).save();
  }

  console.log('Datos de operación de prueba creados o ya existentes.');
};

crearDatosOperacion()
  .catch((error) => {
    console.error('Error al preparar los datos de operación:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
