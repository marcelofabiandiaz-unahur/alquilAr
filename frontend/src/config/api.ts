const API_URL_POR_DEFECTO = 'https://alquilar-pmdp-bkyh.onrender.com';

export const API_URL = import.meta.env.VITE_API_URL?.trim() || API_URL_POR_DEFECTO;
