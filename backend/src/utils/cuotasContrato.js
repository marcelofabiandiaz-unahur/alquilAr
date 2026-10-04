const crearEstadoCuota = (fechaVencimiento, ahora = new Date()) =>
  fechaVencimiento < ahora ? 'ATRASADO' : 'PENDIENTE';

const construirCuotasContrato = (contrato, ahora = new Date()) => {
  const inicio = new Date(contrato.fecha_inicio);
  const fin = new Date(contrato.fecha_fin);
  fin.setUTCHours(23, 59, 59, 999);
  if (
    Number.isNaN(inicio.getTime())
    || Number.isNaN(fin.getTime())
    || fin < inicio
    || !Number.isFinite(contrato.monto_mensual)
    || !Number.isInteger(contrato.dia_vencimiento)
  ) {
    throw new Error('El contrato necesita fechas, monto mensual y día de vencimiento válidos para generar sus cuotas.');
  }

  const anioInicio = inicio.getUTCFullYear();
  const mesInicio = inicio.getUTCMonth() + 1;
  const cuotas = [{
    id_contrato: contrato._id,
    mes_correspondiente: 'DEPOSITO',
    monto_total: contrato.monto_mensual,
    fecha_vencimiento: inicio,
    estado: crearEstadoCuota(inicio, ahora),
  }];

  let anio = anioInicio;
  let mes = mesInicio;
  while (anio < fin.getUTCFullYear() || (anio === fin.getUTCFullYear() && mes <= fin.getUTCMonth() + 1)) {
    const fechaVencimiento = new Date(Date.UTC(anio, mes - 1, contrato.dia_vencimiento, 12));
    if (fechaVencimiento >= inicio && fechaVencimiento <= fin) {
      cuotas.push({
        id_contrato: contrato._id,
        mes_correspondiente: `${anio}${String(mes).padStart(2, '0')}`,
        monto_total: contrato.monto_mensual,
        fecha_vencimiento: fechaVencimiento,
        estado: crearEstadoCuota(fechaVencimiento, ahora),
      });
    }
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }

  return cuotas;
};

const construirOperacionesCuotas = (contrato, ahora = new Date()) =>
  construirCuotasContrato(contrato, ahora).map((cuota) => ({
    updateOne: {
      filter: {
        id_contrato: cuota.id_contrato,
        mes_correspondiente: {
          $in: cuota.mes_correspondiente === 'DEPOSITO'
            ? ['DEPOSITO']
            : [
              cuota.mes_correspondiente,
              `${cuota.mes_correspondiente.slice(0, 4)}-${cuota.mes_correspondiente.slice(4)}`,
            ],
        },
      },
      update: { $setOnInsert: cuota },
      upsert: true,
    },
  }));

module.exports = { construirCuotasContrato, construirOperacionesCuotas };
