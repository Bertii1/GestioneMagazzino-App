# External Integrations

**Analysis Date:** 2026-04-03

## APIs & External Services

**Barcode Product Lookup (client-side, no key required):**
- UPC Item DB — primary lookup for electronics/UPC codes
  - Endpoint: `https://api.upcitemdb.com/prod/trial/lookup?upc={code}`
  - Called from: `mobile/src/screens/product/ProductFormScreen.tsx` (`doLookup` function)
  - Auth: None (trial/free tier, no API key)
  - Fallback: Open EAN / OpenGTIN DB

- Open EAN / OpenGTIN DB — fallback lookup for European EAN barcodes
  - Endpoint: `https://opengtindb.org/?ean={code}&cmd=ean&lang=it&tf=json`
  - Called from: `mobile/src/screens/product/ProductFormScreen.tsx` (fallback branch in `doLookup`)
  - Auth: None

**Speech-to-Text (self-hosted, local):**
- Whisper ASR — open-weight speech recognition for voice field input
  - Service: `onerahmet/openai-whisper-asr-webservice:latest` Docker image
  - Model: `small`, engine `openai_whisper`, language `it` (Italian)
  - Endpoint (server-to-Whisper): `POST {WHISPER_URL}/asr?encode=true&task=transcribe&language=it&output=json`
  - Client calls server: `POST /api/transcribe` with `multipart/form-data` audio file
  - Server proxies to Whisper via `server/src/controllers/transcribeController.ts`
  - Default URL: `http://whisper-asr:9000` (overridden by `WHISPER_URL` env var)
  - Timeout: 60 seconds

## Data Storage

**Databases:**
- MongoDB 7 (mongo:7-jammy Docker image)
  - Container: `magazzino_mongo`
  - Connection env var: `MONGODB_URI` (constructed from `MONGO_USER` + `MONGO_PASSWORD`)
  - Client/ODM: Mongoose 8.5.x (`server/src/config/db.ts`)
  - Database name: `gestione_magazzino`
  - Collections: `users`, `warehouses`, `shelves`, `products` (initialized by `mongo-init.js`)
  - Mongoose models: `server/src/models/User.ts`, `server/src/models/Warehouse.ts`, `server/src/models/Shelf.ts`, `server/src/models/Product.ts`

**File Storage:**
- Memory only — audio files uploaded via `multer` use in-memory storage (`multer.memoryStorage()`) and are immediately forwarded to Whisper ASR without disk persistence (`server/src/controllers/transcribeController.ts`)

**Client-side Persistence:**
- AsyncStorage (`@react-native-async-storage/async-storage`) — stores JWT token (`auth_token` key) and discovered server URL (`server_url` key)
  - Token storage: `mobile/src/services/api.ts` (interceptors)
  - Server URL: `mobile/src/store/serverStore.ts`

**Caching:**
- Whisper model cache: Docker volume `magazzino_whisper_cache` at `/root/.cache/whisper` (model weights persisted across restarts)
- MongoDB data: Docker volume `magazzino_mongo_data` at `/data/db`

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (no third-party auth provider)
  - Implementation: `server/src/middleware/auth.ts`, `server/src/controllers/authController.ts`
  - Password hashing: bcryptjs (salt rounds: 10), `server/src/models/User.ts`
  - Token signing: jsonwebtoken, secret from `JWT_SECRET` env var, expiry from `JWT_EXPIRES_IN` (default `7d`)
  - Roles: `admin` | `operator` (enforced by `requireAdmin` middleware in `server/src/middleware/auth.ts`)
  - QR login: each user has a unique `loginToken` (32 random bytes hex) enabling QR-code based login without password (`mobile/src/screens/auth/MyQRCodeScreen.tsx`)

## Monitoring & Observability

**Error Tracking:**
- None — no external error tracking service (no Sentry, Datadog, etc.)

**Health Check:**
- Built-in HTTP health endpoint: `GET /health` returns `{ status: 'ok', app: 'gestione-magazzino', timestamp }` (`server/src/app.ts`)
- Used by Docker healthchecks and by mobile server discovery (`mobile/src/services/serverDiscovery.ts`)

**Logs:**
- `console.log` / `console.error` only — no structured logging library

## CI/CD & Deployment

**Hosting:**
- Docker Compose on bare metal / VPS — `docker-compose.yml` at project root
- Mobile: no EAS (`eas.json`) or CI pipeline detected; Expo dev server only

**CI Pipeline:**
- None detected (no `.github/workflows/`, `.gitlab-ci.yml`, etc.)

**Release Script:**
- `release.sh` at project root — manual release helper script

## LAN Server Discovery

**Custom Service Discovery:**
- The mobile app auto-discovers the backend server on the local LAN without configuration
  - Implementation: `mobile/src/services/serverDiscovery.ts`
  - Mechanism: scans the device's /24 subnet (254 hosts) in parallel batches of 30, probing `GET http://{host}:3000/health` with 600ms timeout
  - Priority hosts scanned first: `.1`, `.2`, `.254`, `.100`, `.200`, `.240`, `.10`, `.20`, `.50`
  - Uses `expo-network` to get device IP (`Network.getIpAddressAsync()`)
  - Discovered URL persisted in AsyncStorage (`server_url` key) and re-verified on next launch

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Environment Configuration

**Required env vars (from `.env.example`):**
- `MONGO_USER` — MongoDB root username
- `MONGO_PASSWORD` — MongoDB root password
- `JWT_SECRET` — Secret for JWT signing (must be long and random)
- `JWT_EXPIRES_IN` — JWT expiry duration (e.g. `7d`)
- `NODE_ENV` — `production` | `development`
- `HOST_IP` — LAN IP of the Docker host (used for Expo Metro bundler in dev profile)

**Additional env var (not in `.env.example`):**
- `WHISPER_URL` — Override Whisper ASR URL (default: `http://whisper-asr:9000`)
- `PORT` — Server port (default: `3000`)
- `MONGODB_URI` — Full MongoDB connection string (set by docker-compose, overrides `MONGO_USER`/`MONGO_PASSWORD`)

**Secrets location:**
- `.env` file at project root (gitignored per `.gitignore`)

---

*Integration audit: 2026-04-03*
