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
| Frontend | React, TypeScript, Vite, TailwindCSS |
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
  - `POST /` — registro (siempre asigna `USUARIO`; roles superiores se asignan desde administración)
  - `POST /login` — login JWT
  - `GET /` — listado (solo `ADMINISTRADOR`, requiere `Authorization: Bearer`)
- Middleware: `verificarToken`, `verificarRol`.

### Operación (semana 4)

Los endpoints de pagos, gastos y reclamos requieren `Authorization: Bearer <token>`.
Las respuestas nuevas usan `{ success, data, message }`; la identidad del usuario se obtiene del JWT.

- `GET/POST /api/pagos`, `GET/PUT/DELETE /api/pagos/:id`, `PATCH /api/pagos/:id/comprobante` y `PATCH /api/pagos/:id/confirmar`.
  El pago se relaciona con un contrato y período `YYYY-MM`; el importe y el vencimiento se derivan del contrato vigente.
  El inquilino consulta sus pagos y carga el comprobante; el propietario del contrato o un administrador registra y confirma pagos.
- `GET/POST /api/gastos`, `GET/PUT/DELETE /api/gastos/:id`.
  Permite filtrar por `id_propiedad`, `desde`, `hasta` y `estado_pago`. Propietarios y administradores gestionan gastos;
  el inquilino puede consultar gastos de propiedades con su contrato vigente.
- `GET/POST /api/reclamos`, `GET /api/reclamos/:id`, `PATCH /api/reclamos/:id/estado` y `DELETE /api/reclamos/:id`.
  El inquilino abre reclamos ligados a un contrato vigente; propietario y administrador consultan y gestionan reclamos
  de sus propiedades.

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

`JWT_SECRET` es obligatoria y debe tener al menos 32 bytes; el backend no inicia si falta o es demasiado corta.
Generá un valor aleatorio para `backend/.env` con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### Seeds de usuarios, propiedades y contratos de prueba

Los seeds agregan únicamente los registros de prueba que no existan; no vacían colecciones ni modifican
registros preexistentes. Verificá que `MONGODB_URI` apunte a la base local/de prueba antes de ejecutarlos:

```bash
cd backend
npm run seed
npm run seed:propiedades
```

Tras cambiar el modelo de usuario o re-seed: limpiar `localStorage` en el navegador (`token_arquilar`, `usuario_arquilar`).

### Seed de datos operativos de semana 4

Después de preparar usuarios, propiedades y un contrato vigente, se pueden agregar pagos, gastos y reclamos
de prueba de forma idempotente con `cd backend && npm run seed:operacion`. El script no borra colecciones.
Verificá que `MONGODB_URI` apunte a una base local/de prueba antes de ejecutarlo.

### Frontend

```bash
cd frontend
npm install
npm run dev
# o desde la raíz: npm run frontend
```

En desarrollo el front apunta a `http://localhost:3000`.

#### Variables de entorno (`frontend/.env`)

Crear `frontend/.env` (no commitear). Pedir valores al equipo o configurar presets en [Cloudinary Console](https://cloudinary.com/console) → Settings → Upload → Upload presets (modo **Unsigned**).

| Variable | Uso |
|---|---|
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloud name de la cuenta |
| `VITE_CLOUDINARY_UPLOAD_PRESET_PROPIEDADES` | Fotos de inmuebles → carpeta `alquilar/propiedades` |
| `VITE_CLOUDINARY_UPLOAD_PRESET_GARANTE` | Recibo del garante → carpeta `alquilar/garantes` |
| `VITE_CLOUDINARY_UPLOAD_PRESET_GASTOS` | Comprobantes de gastos → carpeta `alquilar/gastos` |

Compatibilidad: si falta `..._PROPIEDADES`, se usa el preset legacy `VITE_CLOUDINARY_UPLOAD_PRESET`.

Tras editar `.env`, reiniciar Vite. El frontend sube archivos directo a Cloudinary y guarda solo la URL en MongoDB.

### Ambos a la vez

```bash
npm install
npm run dev
```

### CI (GitHub Actions)

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en pushes y PRs hacia `develop` y `main`:

| Job | Qué valida |
|---|---|
| **backend** | `npm test` (auth, propiedades, contratos, pagos, gastos y reclamos) + syntax check de `index.js` |
| **frontend** | `npm run build` |

Tests locales del backend:

```bash
cd backend
npm test
```

`npm test` cubre middlewares y controladores de autenticación, propiedades, contratos, pagos, gastos y reclamos.
CI valida build del frontend; `npm run lint` también está disponible localmente.

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
