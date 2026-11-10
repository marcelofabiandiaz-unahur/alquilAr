const ORIGENES_PRODUCCION = ['https://alquilar-app.onrender.com'];

const PATRON_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function normalizarOrigen(origen) {
  return String(origen).trim().replace(/\/+$/, '');
}

function esOrigenLocal(origen) {
  if (typeof origen !== 'string') return false;
  return PATRON_LOCAL.test(normalizarOrigen(origen));
}

function parsearOrigenes(valor) {
  if (typeof valor !== 'string') return [];
  return valor
    .split(',')
    .map((origen) => normalizarOrigen(origen))
    .filter(Boolean);
}

function esProduccion(env = process.env) {
  return env.NODE_ENV === 'production' || env.RENDER === 'true';
}

function crearOpcionesCors(env = process.env) {
  const produccion = esProduccion(env);
  const origenes = new Set([
    ...ORIGENES_PRODUCCION,
    ...parsearOrigenes(env.CORS_ORIGINS),
  ]);

  const opciones = {
    origin(origen, callback) {
      // Sin header Origin (curl, health checks, mismo origen) no hay nada que validar.
      if (!origen) return callback(null, true);

      const normalizado = normalizarOrigen(origen);
      if (origenes.has(normalizado)) return callback(null, true);
      if (!produccion && esOrigenLocal(normalizado)) return callback(null, true);

      return callback(null, false);
    },
  };

  return { opciones, origenes: [...origenes], produccion };
}

module.exports = {
  ORIGENES_PRODUCCION,
  crearOpcionesCors,
  esOrigenLocal,
  esProduccion,
  parsearOrigenes,
};
