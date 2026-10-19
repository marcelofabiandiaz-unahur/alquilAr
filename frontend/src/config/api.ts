export const API_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : (import.meta.env.VITE_API_URL ?? 'https://alquilar-pmdp-bkyh.onrender.com');