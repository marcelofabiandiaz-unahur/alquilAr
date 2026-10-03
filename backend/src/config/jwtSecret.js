function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret.trim(), 'utf8') < 32) {
    throw new Error('JWT_SECRET debe estar definida y contener al menos 32 bytes.');
  }
  return secret;
}

module.exports = { getJwtSecret };
