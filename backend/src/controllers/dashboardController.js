const Pago = require('../models/pago');
const Propiedad = require('../models/propiedad');
const Reclamo = require('../models/reclamo');
const { obtenerContratosVisibles, obtenerIdentidad, esAdministrador } = require('../utils/operacionHelpers');

const responder = (res, status, data, message) =>
  res.status(status).json({ success: status < 400, data, message });

const obtenerResumen = async (req, res) => {
  try {
    const { id, roles } = obtenerIdentidad(req.usuario);
    if (!id || !roles.some((rol) => ['ADMINISTRADOR', 'PROPIETARIO', 'INQUILINO'].includes(rol))) {
      return responder(res, 403, null, 'No tenés permiso para consultar el resumen del dashboard.');
    }

    const contratos = await obtenerContratosVisibles(req.usuario);
    if (!contratos) {
      return responder(res, 403, null, 'No tenés permiso para consultar el resumen del dashboard.');
    }

    const contratosIds = contratos.map((contrato) => contrato._id);
    const ahora = new Date();
    const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
    const inicioMesSiguiente = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));
    const periodo = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, '0')}`;
    const periodoNormalizado = periodo.replace('-', '');

    const agregados = await Pago.aggregate([
      { $match: { id_contrato: { $in: contratosIds } } },
      {
        $facet: {
          periodo: [
            { $match: { mes_correspondiente: { $in: [periodoNormalizado, periodo] } } },
            {
              $group: {
                _id: null,
                totalEstimadoMes: { $sum: '$monto_total' },
                totalPendienteMes: {
                  $sum: { $cond: [{ $eq: ['$estado', 'PAGADO'] }, 0, '$monto_total'] },
                },
              },
            },
          ],
          cobros: [
            {
              $match: {
                estado: 'PAGADO',
                fecha_pago: { $gte: inicioMes, $lt: inicioMesSiguiente },
              },
            },
            { $group: { _id: null, totalCobradoMes: { $sum: '$monto_total' } } },
          ],
        },
      },
    ]);

    const esAdmin = esAdministrador(roles);
    const condicionesReclamos = [];
    if (!esAdmin && roles.includes('INQUILINO')) {
      condicionesReclamos.push({ id_inquilino: id });
    }
    if (!esAdmin && roles.includes('PROPIETARIO')) {
      const propiedades = await Propiedad.find({ id_propietario: id }).select('_id');
      condicionesReclamos.push({ id_propiedad: { $in: propiedades.map((propiedad) => propiedad._id) } });
    }

    const filtroReclamos = {
      estado: { $nin: ['RESUELTO', 'CANCELADO'] },
      ...(esAdmin
        ? {}
        : condicionesReclamos.length === 1
          ? condicionesReclamos[0]
          : { $or: condicionesReclamos }),
    };
    const reclamosAbiertos = await Reclamo.countDocuments(filtroReclamos);
    const datosMes = agregados[0]?.periodo?.[0] || {};
    const datosCobros = agregados[0]?.cobros?.[0] || {};

    return responder(res, 200, {
      periodo,
      totalEstimadoMes: datosMes.totalEstimadoMes || 0,
      totalPendienteMes: datosMes.totalPendienteMes || 0,
      totalCobradoMes: datosCobros.totalCobradoMes || 0,
      reclamosAbiertos,
    }, 'Resumen del dashboard consultado.');
  } catch (error) {
    console.error('Error al consultar el resumen del dashboard:', error);
    return responder(res, 500, null, 'No se pudo consultar el resumen del dashboard.');
  }
};

module.exports = { obtenerResumen };
