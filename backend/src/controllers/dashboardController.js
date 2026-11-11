const Pago = require('../models/pago');
const Propiedad = require('../models/propiedad');
const Reclamo = require('../models/reclamo');
const {
  obtenerContratosVisibles,
  obtenerIdentidad,
  esAdministrador,
  resolverId,
} = require('../utils/operacionHelpers');
const { esObjectIdValido } = require('../utils/recursosHelpers');
const { resolverAlcanceAgrupamiento } = require('../utils/agrupamientoHelpers');
const { responder } = require('../utils/controllerHelpers');

const obtenerResumen = async (req, res) => {
  try {
    const { id, roles } = obtenerIdentidad(req.usuario);
    if (!id || !roles.some((rol) => ['ADMINISTRADOR', 'PROPIETARIO', 'INQUILINO'].includes(rol))) {
      return responder(res, 403, null, 'No tenés permiso para consultar el resumen del dashboard.');
    }

    const contratosVisibles = await obtenerContratosVisibles(req.usuario);
    if (!contratosVisibles) {
      return responder(res, 403, null, 'No tenés permiso para consultar el resumen del dashboard.');
    }
    let contratos = contratosVisibles;
    const query = req.query || {};

    let agrupamiento = null;
    let propiedadesAgrupamiento = null;
    if (query.id_agrupamiento !== undefined) {
      if (!esObjectIdValido(String(query.id_agrupamiento))) {
        return responder(res, 400, null, 'id_agrupamiento inválido.');
      }
      const alcance = await resolverAlcanceAgrupamiento(query.id_agrupamiento, req.usuario);
      if (alcance.error) return responder(res, alcance.error.status, null, alcance.error.mensaje);

      agrupamiento = alcance.agrupamiento;
      propiedadesAgrupamiento = alcance.propiedades;
      const idsPropiedades = new Set(
        propiedadesAgrupamiento.map((propiedad) => resolverId(propiedad._id)),
      );
      contratos = contratos.filter((contrato) =>
        idsPropiedades.has(resolverId(contrato.id_propiedad)));
    }

    const contratosIds = contratos.map((contrato) => contrato._id);
    const ahora = new Date();
    let anioPeriodo = ahora.getUTCFullYear();
    let mesPeriodo = ahora.getUTCMonth();
    if (query.periodo !== undefined) {
      const coincidencia = /^(\d{4})-(\d{2})$/.exec(String(query.periodo).trim());
      const mes = coincidencia ? Number(coincidencia[2]) : 0;
      if (!coincidencia || mes < 1 || mes > 12) {
        return responder(res, 400, null, 'periodo debe tener formato YYYY-MM.');
      }
      anioPeriodo = Number(coincidencia[1]);
      mesPeriodo = mes - 1;
    }
    const inicioMes = new Date(Date.UTC(anioPeriodo, mesPeriodo, 1));
    const inicioMesSiguiente = new Date(Date.UTC(anioPeriodo, mesPeriodo + 1, 1));
    const periodo = `${anioPeriodo}-${String(mesPeriodo + 1).padStart(2, '0')}`;
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
    if (propiedadesAgrupamiento) {
      filtroReclamos.id_propiedad = {
        $in: propiedadesAgrupamiento.map((propiedad) => propiedad._id),
      };
    }
    const reclamosAbiertos = await Reclamo.countDocuments(filtroReclamos);
    const datosMes = agregados[0]?.periodo?.[0] || {};
    const datosCobros = agregados[0]?.cobros?.[0] || {};

    const datos = {
      periodo,
      totalEstimadoMes: datosMes.totalEstimadoMes || 0,
      totalPendienteMes: datosMes.totalPendienteMes || 0,
      totalCobradoMes: datosCobros.totalCobradoMes || 0,
      reclamosAbiertos,
    };

    if (agrupamiento) {
      const total = propiedadesAgrupamiento.length;
      const alquiladas = propiedadesAgrupamiento.filter(
        (propiedad) => propiedad.estado === 'ALQUILADA',
      ).length;
      const disponibles = propiedadesAgrupamiento.filter(
        (propiedad) => propiedad.estado === 'DISPONIBLE',
      ).length;
      datos.agrupamiento = {
        _id: agrupamiento._id,
        nombre: agrupamiento.nombre,
      };
      datos.unidadesTotales = total;
      datos.unidadesAlquiladas = alquiladas;
      datos.unidadesDisponibles = disponibles;
      datos.tasaOcupacion = total > 0
        ? Number(((alquiladas / total) * 100).toFixed(2))
        : 0;
    }

    return responder(res, 200, datos, 'Resumen del dashboard consultado.');
  } catch (error) {
    console.error('Error al consultar el resumen del dashboard:', error);
    return responder(res, 500, null, 'No se pudo consultar el resumen del dashboard.');
  }
};

module.exports = { obtenerResumen };
