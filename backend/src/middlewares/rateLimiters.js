const rateLimit = require('express-rate-limit');

const MENSAJE_LIMITE = 'Demasiados intentos. Esperá unos minutos y volvé a intentar.';

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { mensaje: MENSAJE_LIMITE },
});

const limiteRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { mensaje: MENSAJE_LIMITE },
});

module.exports = { limiteLogin, limiteRegistro };
