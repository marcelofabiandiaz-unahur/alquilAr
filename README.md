# AlquilAR

Plataforma web de gestión de alquileres con asistente de IA — Proyecto Integrador, Licenciatura en Programación (UNaHur).

## Integrantes

- Alaniz, Rocío Abril
- Díaz, Marcelo Fabián
- Torales, Santiago

**Tutor:** Prof. Alejandra Pinto

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React, Vite, TailwindCSS |
| Backend | Node.js, Express |
| Base de datos | MongoDB Atlas, Mongoose |
| Auth | Argon2id, JWT |
| Deploy | Render (MVP académico) |

## Estructura del repositorio

```text
backend/
  index.js                    Bootstrap Express + MongoDB
  src/
    controllers/authController.js
    middlewares/authMiddleware.js
    routes/authRoutes.js
    models/usuario.js           Usuario unico con roles[]
  scripts/seed-usuarios.js      Usuarios de prueba (opcional)
frontend/                     SPA React
package.json                  Scripts npm run dev (front + back)
```

### Auth (modulo 1)

- Un solo modelo `Usuario` con `roles: [String]` (perfil mixto) e `_id` ObjectId nativo de MongoDB.
- Rutas montadas en `/api/usuarios`:
  - `POST /` — registro (rol por defecto: `USUARIO`)
  - `POST /login` — login JWT
  - `GET /` — listado (solo `ADMINISTRADOR`, requiere `Authorization: Bearer`)
- Middleware: `verificarToken`, `verificarRol`.

## Desarrollo local

### Requisitos

- Node.js 18+
- Cuenta/cadena MongoDB Atlas (pedir `.env` al equipo)

### Backend

```bash
cd backend
npm install
# Crear backend/.env con MONGODB_URI y JWT_SECRET (sin commitear)
node index.js
# o desde la raíz: npm run backend
```

Variables de entorno necesarias (solo nombres):

- `MONGODB_URI`
- `JWT_SECRET`
- `PORT` (opcional, default 3000)
- `SEED_PASSWORD` (opcional, default `ClaveTest123` para el script seed)

### Seed de usuarios de prueba

Solo si necesitas resetear la coleccion `usuarios` (borra todos los documentos existentes):

```bash
cd backend
npm run seed
```

Tras cambiar el modelo de usuario o re-seed: limpiar `localStorage` en el navegador (`token_arquilar`, `usuario_arquilar`).

### Frontend

```bash
cd frontend
npm install
npm run dev
# o desde la raíz: npm run frontend
```

En desarrollo el front apunta a `http://localhost:3000`.

### Ambos a la vez

```bash
npm install
npm run dev
```

## Ramas y módulos

| Rama | Uso |
|---|---|
| `main` | Demo estable |
| `develop` | Integración del equipo |
| `feature/*` | Trabajo por módulo |

| Módulo | Responsable | Dominio |
|---|---|---|
| 1 | Santiago | Autenticación, JWT, middleware |
| 2 | Marcelo | Propiedades, contratos |
| 3 | Rocío | Pagos, gastos, reclamos, IA |

Flujo: `feature/modulo` → Pull Request a `develop` → (hito) merge a `main`.

## Demo (Render)

- Frontend: https://alquilar-app.onrender.com/
- Backend: https://alquilar-pmdp-bkyh.onrender.com/

Credenciales de prueba: solicitar al equipo (no publicar en el repo).

## Documentación completa

Plan de trabajo, Gantt, DER y entregables de cátedra están en OneDrive:

`Proyecto Integrador/Docs` (no forman parte de este repositorio).

## Copia local de trabajo

Desarrollo local en esta carpeta: `C:\Dev\7x24 Ciudad`.

## Estado del proyecto (referencia)

- Auth modular cableado: `Usuario` con `roles[]`, JWT, middleware
- Login, registro y listado admin en frontend
- Propiedades, contratos, pagos y IA: en desarrollo (semanas 3–6)

Repositorio: https://github.com/marcelofabiandiaz-unahur/alquilAr
