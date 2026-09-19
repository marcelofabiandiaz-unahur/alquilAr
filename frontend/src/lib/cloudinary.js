const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const TIPO_PDF = 'application/pdf';
const TAMANO_MAX_BYTES = 5 * 1024 * 1024;
export const FOTOS_MAX = 5;

const ENV_PRESET = {
  propiedades: 'VITE_CLOUDINARY_UPLOAD_PRESET_PROPIEDADES',
  garante: 'VITE_CLOUDINARY_UPLOAD_PRESET_GARANTE',
  gastos: 'VITE_CLOUDINARY_UPLOAD_PRESET_GASTOS',
};

function getPreset(tipo) {
  const envKey = ENV_PRESET[tipo];
  const preset = envKey ? import.meta.env[envKey] : undefined;
  if (preset) return preset;
  if (tipo === 'propiedades') {
    return import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  }
  return undefined;
}

export function estaConfigurado(tipo = 'propiedades') {
  return Boolean(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME && getPreset(tipo));
}

export function validarArchivo(file, { permitirPdf = false } = {}) {
  const tiposPermitidos = permitirPdf ? [...TIPOS_IMAGEN, TIPO_PDF] : TIPOS_IMAGEN;
  if (!tiposPermitidos.includes(file.type)) {
    return permitirPdf
      ? 'Formato no permitido. Usá JPG, PNG, WEBP o PDF.'
      : 'Formato no permitido. Usá JPG, PNG o WEBP.';
  }
  if (file.size > TAMANO_MAX_BYTES) {
    return 'El archivo supera 5 MB.';
  }
  return null;
}

export async function subirArchivo(file, tipo = 'propiedades', { permitirPdf = false } = {}) {
  const errorValidacion = validarArchivo(file, { permitirPdf });
  if (errorValidacion) {
    throw new Error(errorValidacion);
  }

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = getPreset(tipo);

  if (!cloudName || !uploadPreset) {
    throw new Error(
      `Cloudinary no está configurado para "${tipo}". Revisá frontend/.env y reiniciá Vite.`,
    );
  }

  const esPdf = file.type === TIPO_PDF;
  const recurso = esPdf ? 'raw' : 'image';

  const data = new FormData();
  data.append('file', file);
  data.append('upload_preset', uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${recurso}/upload`, {
    method: 'POST',
    body: data,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error?.message || 'No se pudo subir el archivo.');
  }

  if (!json.secure_url) {
    throw new Error('Cloudinary no devolvió una URL válida.');
  }

  return json.secure_url;
}

export async function subirImagen(file, tipo = 'propiedades') {
  return subirArchivo(file, tipo, { permitirPdf: false });
}

export function esUrlPdf(url) {
  if (!url) return false;
  return /\.pdf(\?|$)/i.test(url) || url.includes('/raw/upload/');
}

export function miniatura(url, w = 400, h = 240) {
  if (!url || !url.includes('cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }
  if (esUrlPdf(url)) {
    return url;
  }
  return url.replace('/upload/', `/upload/w_${w},h_${h},c_fill/`);
}
