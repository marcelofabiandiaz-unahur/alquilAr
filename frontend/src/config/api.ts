const API_URL_DESARROLLO = 'http://localhost:3000';
const API_URL_PRODUCCION = 'https://alquilar-pmdp.onrender.com';

const apiUrlConfigurada = import.meta.env.VITE_API_URL?.trim();

export const API_URL = (
  apiUrlConfigurada
  || (import.meta.env.DEV ? API_URL_DESARROLLO : API_URL_PRODUCCION)
).replace(/\/+$/, '');

if (!apiUrlConfigurada && !import.meta.env.DEV) {
  console.warn(
    `VITE_API_URL no está definida. Se usará el backend por defecto: ${API_URL_PRODUCCION}`,
  );
}
