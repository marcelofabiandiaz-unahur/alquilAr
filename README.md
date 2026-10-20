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
<<<<<<< HEAD
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
=======
.
├── backend/
│   ├── index.js                 # Express, GET /health, montaje de rutas API
│   ├── src/
│   │   ├── controllers/         # auth, propiedad, contrato, pago, gasto, reclamo, ai, …
│   │   ├── models/              # usuario, propiedad, contrato, pago, gasto, reclamo
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── services/            # aiService, aiToolsRegistry
│   │   └── utils/
│   ├── scripts/                 # seed-usuarios, seed-propiedades, …
│   └── test/
├── frontend/
│   ├── index.html
│   ├── public/                  # logo (favicon), assets estáticos
│   └── src/
│       ├── App.tsx              # rutas: /, /registro, /dashboard
│       ├── AuthProvider.tsx     # sesión; validación con GET /api/usuarios/me
│       ├── Dashboard.tsx
│       ├── config/api.ts
│       └── components/          # asistente, pagos, propiedades, contratos, …
└── package.json                 # npm run dev (frontend + backend)
>>>>>>> 8284b23b38864f8821ddb08932ca7993b9abcfe7
```

### Auth (modulo 1)

- Un solo modelo `Usuario` con `roles: [String]` (perfil mixto) e `_id` ObjectId nativo de MongoDB.
- Rutas montadas en `/api/usuarios`:
  - `POST /` — registro (siempre asigna `USUARIO`; roles superiores se asignan desde administración)
  - `POST /login` — login JWT
  - `GET /me` y `PATCH /me` — consulta y actualización del perfil autenticado (solo teléfono, alias/CBU y CUIT/CUIL)
  - `GET /` — listado (solo `ADMINISTRADOR`, requiere `Authorization: Bearer`)
  - `GET /solicitud-propietario` y `POST /solicitud-propietario` — consulta y envío autenticado de solicitud, con alias/CBU y CUIT/CUIL
  - `PATCH /:id/solicitud-propietario/aprobar` — aprobación administrativa; al aprobar asigna `PROPIETARIO` y activa los datos bancarios enviados
- Middleware: `verificarToken`, `verificarRol`.

<<<<<<< HEAD
### Operación (semana 4)

Los endpoints de pagos, gastos y reclamos requieren `Authorization: Bearer <token>`.
Las respuestas nuevas usan `{ success, data, message }`; la identidad del usuario se obtiene del JWT.
=======
### Propiedades y contratos

- CRUD de propiedades y contratos con permisos por rol; cuotas de pago al activar contratos; historial y garantes.
- `GET /api/propiedades` — listado con JWT: **propietario** ve sus inmuebles; **administrador** ve todos. Usuarios e inquilinos sin rol de gestión reciben 403.
- No hay catálogo público ni ingreso anónimo: login o registro obligatorio para usar la app.
>>>>>>> 8284b23b38864f8821ddb08932ca7993b9abcfe7

- `GET/POST /api/pagos`, `GET/PUT/DELETE /api/pagos/:id`, `PATCH /api/pagos/:id/comprobante` y `PATCH /api/pagos/:id/confirmar`.
  El pago se relaciona con un contrato y período `YYYY-MM`; el importe y el vencimiento se derivan del contrato vigente.
  El inquilino consulta sus pagos y carga el comprobante; el propietario del contrato o un administrador registra y confirma pagos.
  El inquilino puede cargar hasta 5 comprobantes PDF/JPG/PNG/WEBP (5 MB cada uno) con `POST /api/pagos/:id/comprobantes`, consultarlos autenticadamente con `GET /api/pagos/:id/comprobantes/:indice` y quitarlos con `DELETE /api/pagos/:id/comprobantes` antes de la confirmación.
  Al activar un contrato se generan automáticamente la cuota de depósito (un mes de alquiler, `mes_correspondiente: DEPOSITO`) y las cuotas mensuales con `mes_correspondiente` en formato `YYYYMM`; el importe y los vencimientos se derivan del contrato vigente. Los upserts evitan duplicar cuotas y reconocen períodos mensuales legados en formato `YYYY-MM`.
  El inquilino consulta sus pagos y carga el comprobante, que pasa a estado `INGRESADO`; el propietario del contrato o un administrador lo confirma desde Cobros y pasa a `PAGADO`. Los pagos aún no informados permanecen `PENDIENTE` o `ATRASADO` según su vencimiento.
- `GET/POST /api/gastos`, `GET/PUT/DELETE /api/gastos/:id`.
  Permite filtrar por `id_propiedad`, `desde`, `hasta` y `estado_pago`. Propietarios y administradores gestionan gastos;
  el inquilino puede consultar gastos de propiedades con su contrato vigente.
- `GET/POST /api/reclamos`, `GET /api/reclamos/:id`, `PATCH /api/reclamos/:id/estado` y `DELETE /api/reclamos/:id`.
  El inquilino abre reclamos ligados a un contrato vigente; propietario y administrador consultan y gestionan reclamos
  de sus propiedades. Asunto y descripción se limitan a 120 y 4000 caracteres; las categorías permitidas incluyen
  PLOMERIA, ELECTRICIDAD, GAS, ESTRUCTURAL, MANTENIMIENTO, SERVICIOS, SEGURIDAD y OTRO.

<<<<<<< HEAD
### Catálogo y dashboard
=======
Los endpoints requieren `Authorization: Bearer <token>`. La identidad se obtiene del JWT.
>>>>>>> 8284b23b38864f8821ddb08932ca7993b9abcfe7

- `GET /api/propiedades/disponibles` es público y devuelve solo los campos de catálogo de propiedades disponibles.
  Las demás rutas de `/api/propiedades` siguen requiriendo JWT y autorización.
- `GET /api/dashboard/resumen` requiere JWT de administrador, propietario o inquilino. Los importes quedan limitados
  a contratos visibles para la cuenta. Devuelve `periodo`, `totalEstimadoMes`, `totalPendienteMes`,
  `totalCobradoMes` y `reclamosAbiertos`. El estimado mensual usa las cuotas del período calendario en `YYYYMM`
  o el formato legado `YYYY-MM`; los cobros efectivos se calculan por `fecha_pago` del mes calendario.

### Asistente IA

- `POST /api/ai/chat` requiere `Authorization: Bearer` y recibe `mensajes` con roles `user` y `assistant`.
- El backend usa Gemini (`gemini-3.8-flash`) con `GEMINI_API_KEY`, configurada solo en `backend/.env`.
- El modelo dispone de exactamente dos herramientas controladas por el servidor: `consultarMisDatos` (contratos o reclamos dentro del alcance de la cuenta) y `clasificarYCrearReclamo` (categoría/prioridad propuestas por el modelo y validación/creación mediante las reglas del módulo de reclamos). Los datos de identidad y los permisos siempre provienen del JWT; la IA no puede indicar una cuenta alternativa.
- Para el chat, Gemini recibe un historial de hasta 20 mensajes con un máximo de 4000 caracteres por mensaje. `GEMINI_API_KEY` es necesaria para ejecutar consultas al modelo.
- La pantalla Asistente IA está disponible para inquilinos, propietarios y administradores. Los mensajes no se guardan en la base de datos.

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
- `GEMINI_API_KEY` (para el asistente IA; secreto, solo backend)
- `PORT` (opcional, default 3000)
- `SEED_PASSWORD` (opcional, default `ClaveTest123` para el script seed)
- `CLOUDINARY_CLOUD_NAME` (para subir, consultar y eliminar recibos de garante y limpiar fotos quitadas de propiedades; debe coincidir con `VITE_CLOUDINARY_CLOUD_NAME`)
- `CLOUDINARY_API_KEY` (secreto; solo backend)
- `CLOUDINARY_API_SECRET` (secreto; solo backend)

`JWT_SECRET` es obligatoria y debe tener al menos 32 bytes; el backend no inicia si falta o es demasiado corta.
Generá un valor aleatorio para `backend/.env` con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Obtené las credenciales de Cloudinary desde su consola y configurá las tres variables en `backend/.env` y en el entorno del servicio backend. No copies `API_SECRET` al frontend ni uses variables `VITE_` para credenciales privadas. El backend sube y elimina recibos de garantes con autorización, y elimina fotos quitadas de propiedades al guardar la edición; otros comprobantes pueden seguir usando la carga unsigned desde el frontend.

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
| `VITE_CLOUDINARY_UPLOAD_PRESET_GARANTE` | Legacy; los recibos de garantes ahora se cargan autenticados desde el backend |
| `VITE_CLOUDINARY_UPLOAD_PRESET_GASTOS` | Comprobantes de gastos → carpeta `alquilar/gastos` |

Compatibilidad: si falta `..._PROPIEDADES`, se usa el preset legacy `VITE_CLOUDINARY_UPLOAD_PRESET`.

Tras editar `.env`, reiniciar Vite. Las fotos de propiedades y comprobantes de gastos se suben directo a Cloudinary; los recibos de garantes se cargan desde el backend con autenticación y credenciales privadas.
Los recibos PDF del garante se suben con `resource_type: image` (endpoint `image/upload`), sin convertir ni perder páginas; los PDF de otros comprobantes conservan el tipo de recurso `raw`. La consulta del recibo se autoriza por contrato y se sirve desde el backend mediante una descarga privada temporal; no requiere habilitar entrega pública de PDF en Cloudinary.

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

`npm test` cubre middlewares, rutas y controladores de autenticación, dashboard, propiedades, contratos, pagos,
gastos, reclamos, carga de archivos y herramientas del asistente.
CI valida build del frontend; `npm run lint` también está disponible localmente.

## Ramas y módulos

| Rama | Uso |
|---|---|
| `main` | Demo estable |
| `develop` | Integración del equipo |
| `feature/*` | Trabajo por módulo |


Flujo: `feature/modulo` → Pull Request a `develop` → (hito) merge a `main`.

## Demo (Render)

- Frontend: https://alquilar-app.onrender.com/
- Backend: https://alquilar-pmdp.onrender.com/

Credenciales de prueba: solicitar al equipo (no publicar en el repo).

## Documentación completa

Plan de trabajo, Gantt, DER y entregables de cátedra están en OneDrive:


Repositorio: https://github.com/marcelofabiandiaz-unahur/alquilAr
