# Gestione Magazzino HCS

## Project Overview

Warehouse management system for HCS. Mobile-first app (no web frontend).

**Stack:**
- Server: Express 4.19 + TypeScript, Mongoose 8.5, MongoDB 7
- Mobile: React Native 0.81 + Expo 55, React 19, Zustand 4.5
- Infra: Docker Compose (Caddy reverse proxy, MongoDB, Whisper ASR)
- Logging: Pino

## Quick Start

```bash
# Production
docker compose up

# Dev server only
cd server && npm run dev

# Mobile
cd mobile && npx expo start

# Whisper ASR (optional)
docker compose --profile whisper up
```

## Architecture

### Server (`server/src/`)

MVC: Routes -> Controllers -> Models

- Entry: `server/src/app.ts`
- Config: `config/env.ts` (centralized env validation), `config/db.ts`, `config/logger.ts`
- Models: `models/` — User, Warehouse, Shelf, Product, ProductCatalog
- Controllers: `controllers/` — auth, warehouse, shelf, product, transcribe, vision
- Routes: `routes/` — auth, warehouses, shelves, products, transcribe, vision, users, backup
- Middleware: `middleware/auth.ts` (JWT protect + requireAdmin), `middleware/errorHandler.ts`
- Static files: `/uploads` served for product photos

### Mobile (`mobile/src/`)

Screens -> Stores (Zustand) -> Services -> api.ts (Axios)

- Entry: `mobile/App.tsx` -> `navigation/AppNavigator.tsx`
- Screens: `screens/auth/`, `screens/warehouse/`, `screens/shelf/`, `screens/product/`
- Stores: `store/` — authStore, serverStore, warehouseStore
- Services: `services/` — api.ts, serverDiscovery.ts, auth/warehouse/shelf/product services
- Types: `types/index.ts` — all shared types/interfaces

### API Routes

All prefixed `/api/`:
- `/api/auth` — login, register, QR login (rate-limited)
- `/api/warehouses` — CRUD warehouses (grid-based)
- `/api/shelves` — CRUD shelves (position in warehouse grid)
- `/api/products` — CRUD products (barcode, photos, brand, condition)
- `/api/transcribe` — Whisper ASR voice transcription
- `/api/vision` — Gemini AI product recognition
- `/api/users` — user management (admin)
- `/api/backup` — database backup (bearer auth)
- `/health` — health check

## Environment Variables

Required: `MONGODB_URI`, `JWT_SECRET`

Optional w/ defaults:
- `PORT` (3000), `NODE_ENV` (development)
- `JWT_EXPIRES_IN` (7d), `WHISPER_URL` (http://whisper-asr:9000)
- `CORS_ORIGIN` (*), `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `GEMINI_API_KEY`, `BACKUP_API_KEY`

## Domain Model

- **Warehouse**: grid (gridWidth x gridHeight), contains shelves
- **Shelf**: position (x, y) in warehouse grid, has levels
- **Product**: barcode, warehouse+shelf+level+slot ref, photos, brand, condition
- **ProductCatalog**: internal catalog w/ categories

## Adding New Features

Server: Model -> Controller -> Route -> register in `app.ts`
Mobile: types -> service -> screen -> register in `AppNavigator.tsx`

## Conventions

- Server models: PascalCase. Controllers/routes/middleware: camelCase
- Mobile screens: PascalCase + `Screen` suffix. Services: camelCase + `Service` suffix. Stores: camelCase + `Store` suffix
- All responses in Italian (error messages, UI text)
- Auth: JWT w/ bcrypt, QR code login via loginToken
- Server discovery: auto LAN subnet scan from mobile

## Docker Services

| Service | Container | Port | Notes |
|---------|-----------|------|-------|
| caddy | magazzino_caddy | 80, 443 | Reverse proxy, auto HTTPS |
| mongo | magazzino_mongo | (internal) | MongoDB 7, volume `mongo_data` |
| server | magazzino_server | (internal) | Behind Caddy |
| whisper-asr | magazzino_whisper | (internal) | Profile `whisper` |
| mobile | magazzino_mobile | 8081 | Profile `dev` |

## Deployment

**Production:** EC2 `YOUR_EC2_INSTANCE_ID` (eu-south-1), access via SSM only (no SSH).

**Auto-deploy:** GitHub Actions (`.github/workflows/deploy.yml`)
- Triggers on push to `main` when `server/**`, `docker-compose.yml`, or `Caddyfile` change
- Manual trigger: `gh workflow run deploy.yml`
- Auth: OIDC federation → IAM role `GitHubActions-Deploy-Magazzino` (no static keys)
- Flow: SSM send-command → git pull → docker compose build → health check
- Setup script: `deploy/setup-github-oidc.sh` (one-time IAM/OIDC setup)

**Manual deploy:** `aws ssm start-session --target YOUR_EC2_INSTANCE_ID --region eu-south-1`

**Mobile build:** GitHub Actions (`.github/workflows/build-mobile.yml`)
- Triggers on push to `main` when `mobile/**` changes (builds Android APK)
- Manual trigger: choose platform (android/ios/all) + optional version bump
- Auth: `EXPO_TOKEN` secret → EAS Build (Expo cloud)
- Local build: `./release.sh --android|--ios|--all [--bump-patch]`

See `deploy/SERVER.md` for full server docs.

## Testing

No test framework yet. Use `npm run lint` for ESLint checks.
