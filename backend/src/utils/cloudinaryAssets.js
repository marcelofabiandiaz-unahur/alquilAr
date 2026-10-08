const GARANTE_FOLDER = 'alquilar/garantes/';
const PROPIEDAD_FOLDER = 'alquilar/propiedades/';
const PAGO_FOLDER = 'alquilar/pagos/';

const parsePropiedadImageUrl = (assetUrl, folder = PROPIEDAD_FOLDER) => {
  if (typeof assetUrl !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(assetUrl);
  } catch {
    return null;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (
    !cloudName
    || parsed.protocol !== 'https:'
    || parsed.hostname !== 'res.cloudinary.com'
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    return null;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (
    segments[0] !== cloudName
    || segments[1] !== 'image'
    || segments[2] !== 'upload'
    || segments.some((segment) => {
      try {
        const decoded = decodeURIComponent(segment);
        return decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\');
      } catch {
        return true;
      }
    })
  ) {
    return null;
  }

  const versionIndex = segments.findIndex((segment, index) =>
    index > 2 && /^v\d+$/.test(segment));
  if (versionIndex < 0 || versionIndex === segments.length - 1) return null;

  let publicId;
  try {
    publicId = segments.slice(versionIndex + 1).map(decodeURIComponent).join('/');
  } catch {
    return null;
  }

  if (
    publicId.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    || publicId.includes('\\')
    || !publicId.startsWith(folder)
  ) {
    return null;
  }

  return { publicId, resourceType: 'image' };
};

const parsePagoAssetUrl = (assetUrl) => {
  const asset = parseGaranteAssetUrl(assetUrl, PAGO_FOLDER);
  if (!asset) return null;
  const pagoAsset = { ...asset };
  delete pagoAsset.garanteFolder;
  return pagoAsset;
};

const parseGaranteAssetUrl = (assetUrl, requiredFolder) => {
  if (typeof assetUrl !== 'string') return null;
  const rawPath = assetUrl.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/([^?#]*)/i)?.[1];
  if (!rawPath) return null;
  try {
    const rawSegments = rawPath.split('/');
    if (rawSegments.some((segment) => {
      const decoded = decodeURIComponent(segment);
      return decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\');
    })) {
      return null;
    }
  } catch {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(assetUrl);
  } catch {
    return null;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (
    !cloudName
    || parsed.protocol !== 'https:'
    || parsed.hostname !== 'res.cloudinary.com'
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    return null;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (
    segments[0] !== cloudName
    || !['image', 'raw'].includes(segments[1])
    || segments[2] !== 'upload'
  ) {
    return null;
  }

  const versionIndex = segments.findIndex((segment, index) =>
    index > 2 && /^v\d+$/.test(segment));
  if (versionIndex < 0 || versionIndex === segments.length - 1) return null;

  let publicId;
  try {
    publicId = segments.slice(versionIndex + 1).map(decodeURIComponent).join('/');
  } catch {
    return null;
  }

  if (
    publicId.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    || publicId.includes('\\')
    || (requiredFolder && !publicId.startsWith(requiredFolder))
  ) {
    return null;
  }

  const resourceType = segments[1];
  const extension = publicId.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (resourceType === 'image') {
    publicId = publicId.replace(/\.(?:jpe?g|png|webp|pdf)$/i, '');
  }

  const format = resourceType === 'image' ? extension : extension || 'pdf';
  if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(format)) return null;

  return { publicId, resourceType, format, garanteFolder: requiredFolder || GARANTE_FOLDER };
};

const esPdf = (file) =>
  file.mimetype === 'application/pdf'
  && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';

const esImagen = (file) => {
  const { mimetype, buffer } = file;
  if (mimetype === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimetype === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
};

const esReciboValido = (file) => Boolean(file && (esPdf(file) || esImagen(file)));

module.exports = {
  parseGaranteAssetUrl,
  parsePropiedadImageUrl,
  parsePagoAssetUrl,
  esReciboValido,
};
