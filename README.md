# PuntoVectra

Sistema de gestión para restaurantes: reservas, plano de mesas, comandas, carta, mozos, días cerrados y horarios configurables. Vista pública para clientes + panel staff.

```
Punto-Vectra/
├── frontend/          # React 19 + Vite + Tailwind CSS (puerto 5173)
├── backend/           # Node.js + TypeScript + Express + Prisma (puerto 3001)
├── scripts/           # Scripts de migración
└── README.md
```

## Credenciales iniciales

Después del seed, entrá con:

- **Email:** `admin@puntovectra.com`
- **Contraseña:** `admin123`

La vista pública (clientes, sin login) es `http://localhost:5173/`.
El panel staff se abre con triple clic en el logo, o logueándote como admin.

## Requisitos

- **Node.js 20+** (probado con Node 22) + npm
- **PostgreSQL 14+** (probado con PostgreSQL 17)
- **Git**

## Puesta en marcha (paso a paso)

### 1. Clonar el repositorio

```bash
git clone https://github.com/VectraWeb/Punto-Vectra.git
cd Punto-Vectra
```

### 2. Base de datos PostgreSQL

Instalá PostgreSQL 17 (en Windows, con el instalador oficial) y asegurate de que el
servicio esté corriendo. En Windows, como administrador:

```powershell
net start postgresql-x64-17
```

Creá la base de datos (usuario `postgres`, adaptá la contraseña a la tuya):

```sql
CREATE DATABASE punto_vectra;
```

> Si tu contraseña de `postgres` no es `postgres`, ajustala en el `DATABASE_URL`
> del `.env` del backend (paso 3).

### 3. Backend

```bash
cd backend
npm install
```

Copiá el archivo de variables de entorno y revisalo:

```bash
# Windows (PowerShell)
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Lo mínimo a verificar en `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/punto_vectra?schema=public"
JWT_SECRET="cambialo-por-algo-largo-y-aleatorio"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

Generá el cliente Prisma, creá las tablas y cargá los datos iniciales
(organización, sucursal, usuario admin, 10 mesas y carta demo):

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

Levantá el backend (se recarga solo con cada cambio):

```bash
npm run dev
```

Verificá: `http://localhost:3001/api/organizations/default` tiene que devolver JSON.

### 4. Frontend

En **otra terminal**:

```bash
cd frontend
npm install
```

```bash
# Windows (PowerShell)
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

El `frontend/.env` ya apunta al backend local:

```env
VITE_API_URL=http://localhost:3001/api
```

Levantá el frontend:

```bash
npm run dev
```

Abrí `http://localhost:5173/` y logueate con el admin del seed.

### 5. Tests (frontend)

```bash
cd frontend
npm test
```

## Cómo se usa

- **Vista cliente** (`/`): el cliente elige Reservar o Pedir. Si el día está
  cerrado, ve el cartel y no puede avanzar. Si elige un día cerrado en el
  calendario, ve el aviso y el botón se deshabilita.
- **Panel staff**: triple clic en el logo "PuntoVectra" → login admin.
  Solapas Mediodía/Cena, plano de mesas, reservas pendientes, mozos, comandas,
  pedidos, carta y configuración (⚙️).
- **Configuración** (⚙️): nombre del negocio, horarios de turnos, días cerrados,
  carta y color del tema.
- **PIN staff** (modo compatibilidad): `1234` (configurable con `STAFF_PIN`).

## Estructura

- `frontend/src/components/` — pantallas y modales (VistaCliente, StaffDashboard,
  SalonFloor, ComandasPanel, CartaManager, ResModal, ResForm, PedidoForm, …)
- `frontend/src/hooks/` — datos vía API REST con polling (`useReservations`,
  `useOrganization`, `useCatalog`, `useMesas`, …)
- `frontend/src/services/api/` — clientes Axios por recurso
- `frontend/src/utils/` — horarios/turnos (`menuParser` para importar la carta)
- `backend/src/routes/` + `backend/src/services/` — API Express
- `backend/prisma/schema.prisma` — modelo de datos
- `backend/prisma/seed.ts` — datos iniciales (idempotente, se puede correr de nuevo)

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión a PostgreSQL | - |
| `JWT_SECRET` | Secreto para firmar tokens (¡cambiar en producción!) | - |
| `JWT_EXPIRES_IN` | Expiración del token | `7d` |
| `PORT` | Puerto del servidor | `3001` |
| `NODE_ENV` | Entorno | `development` |
| `FRONTEND_URL` | URL del frontend (CORS) | `http://localhost:5173` |
| `UPLOAD_DIR` | Carpeta de archivos subidos | `./uploads` |
| `MAX_FILE_SIZE` | Tamaño máximo de archivo (bytes) | `5242880` |
| `STAFF_PIN` | PIN staff (compatibilidad) | `1234` |
| `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET` | Webhook n8n (opcional) | - |

### Frontend (`frontend/.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_API_URL` | URL del backend | `http://localhost:3001/api` |
| `VITE_N8N_WEBHOOK_URL` / `VITE_N8N_WEBHOOK_SECRET` | Webhook n8n (opcional) | - |
| `VITE_STAFF_PIN` | PIN staff | `1234` |

> Los archivos `.env` **no** se suben a Git (están en `.gitignore`). Cada máquina
> crea el suyo desde `.env.example`.

## API (resumen)

- Auth: `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- Organizaciones: `GET /api/organizations/:id` (público), `PUT /:id`, `PATCH /:id`
- Reservas: `GET /api/reservations?date=`, `POST /` (público), `PUT /:id`,
  `DELETE /:id` (borra), `POST /:id/cancel`, `PATCH /:id/status`
- Recursos: `GET|POST /api/resources/:organizationId`, `PUT|DELETE /:id`
- Catálogo: `GET|POST /api/catalog/:organizationId`, `PUT|DELETE /api/catalog/item/:id`
- Staff, pedidos, clientes, sucursales, config, auditoría, uploads: ver `backend/src/routes/`

## Solución de problemas

- **La base no conecta**: verificá que PostgreSQL esté corriendo y que
  `DATABASE_URL` tenga usuario/contraseña/puerto correctos. En Windows el
  servicio se inicia como administrador (`net start postgresql-x64-17`).
- **Cambios de código que "no se ven"**: la PWA cachea agresivo. Recargá con
  **Ctrl+Shift+R** (o limpiá el service worker desde DevTools).
- **Puerto ocupado**: backend `3001` y frontend `5173` tienen que estar libres.
- **Error de CORS**: `FRONTEND_URL` del backend tiene que coincidir con la URL
  del frontend.
- **Prisma desactualizado tras cambiar el schema**: corré `npx prisma generate`
  y `npx prisma db push` de nuevo.
- **`Time slot is not available` al reservar**: la mesa ya tiene una reserva que
  se solapa en ese horario/turno.
- **Login inválido tras seed**: el seed no pisa usuarios existentes. Si cambiaste
  la contraseña y la olvidaste, borrá el usuario en la DB y corré el seed de nuevo.

## Despliegue

```bash
cd backend && npm run build && npm start
cd frontend && npm run build   # estáticos en frontend/dist/
```

Opciones comunes: VPS con Nginx + PM2 + PostgreSQL, Railway o Render.

## Licencia

MIT
