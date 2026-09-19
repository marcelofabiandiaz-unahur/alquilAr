const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANO_MAX_BYTES = 5 * 1024 * 1024;
export const FOTOS_MAX = 5;

export function estaConfigurado() {
  return Boolean(
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME &&
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
  );
}

export function validarArchivo(file) {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return 'Formato no permitido. Usá JPG, PNG o WEBP.';
  }
  if (file.size > TAMANO_MAX_BYTES) {
    return 'La imagen supera 5 MB.';
  }
  return null;
}

export async function subirImagen(file) {
  const errorValidacion = validarArchivo(file);
  if (errorValidacion) {
    throw new Error(errorValidacion);
  }

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary no está configurado. Revisá frontend/.env');
  }

  const data = new FormData();
  data.append('file', file);
  data.append('upload_preset', uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: data,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error?.message || 'No se pudo subir la imagen.');
  }

  if (!json.secure_url) {
    throw new Error('Cloudinary no devolvió una URL válida.');
  }

  return json.secure_url;
}

export function miniatura(url, w = 400, h = 240) {
  if (!url || !url.includes('cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }
  return url.replace('/upload/', `/upload/w_${w},h_${h},c_fill/`);
}
