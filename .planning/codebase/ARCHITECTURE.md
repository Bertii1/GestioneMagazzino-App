# Architecture

**Analysis Date:** 2026-04-03

## Pattern Overview

**Overall:** Client-Server, mobile-first warehouse management system

**Key Characteristics:**
- React Native (Expo) mobile client communicates with a REST API over local LAN
- Server follows a layered MVC pattern: Routes → Controllers → Models (MongoDB/Mongoose)
- State management on the mobile side is handled by Zustand stores
- No web frontend: the only consumer of the API is the mobile app
- All infrastructure runs locally via Docker Compose (no cloud dependency)

## Layers

**Routing Layer (Server):**
- Purpose: Map HTTP verbs + paths to controller functions; apply middleware
- Location: `server/src/routes/`
- Contains: Express Router definitions, inline `express-validator` validation rules
- Depends on: Controllers, `protect` and `requireAdmin` middleware
- Used by: `server/src/app.ts`

**Controller Layer (Server):**
- Purpose: Handle request/response lifecycle; delegate to models
- Location: `server/src/controllers/`
- Contains: Async functions (Request, Response, NextFunction) that call Mongoose methods and call `next(err)` on failure
- Depends on: Models, middleware types (`AuthRequest`)
- Used by: Routes

**Model Layer (Server):**
- Purpose: Define MongoDB document schemas, types, and indices
- Location: `server/src/models/`
- Contains: Mongoose Schema + Document interfaces (`IUser`, `IWarehouse`, `IShelf`, `IProduct`)
- Depends on: `mongoose`
- Used by: Controllers

**Middleware (Server):**
- Purpose: Cross-cutting request concerns
- Location: `server/src/middleware/`
- Files:
  - `auth.ts` — JWT verification via `protect`; role guard via `requireAdmin`; attaches `req.user`
  - `errorHandler.ts` — Catches errors passed via `next(err)`; returns `{ message }` JSON

**Service Layer (Mobile):**
- Purpose: Encapsulate all HTTP calls to the backend; return typed domain objects
- Location: `mobile/src/services/`
- Contains: Plain objects with async methods (`authService`, `productService`, `shelfService`, `warehouseService`), plus `api.ts` (shared Axios instance) and `serverDiscovery.ts`
- Depends on: `api.ts` (Axios), `AsyncStorage`
- Used by: Zustand stores and screens directly

**Store Layer (Mobile):**
- Purpose: Global client-side state; bridge between services and UI
- Location: `mobile/src/store/`
- Contains:
  - `authStore.ts` — Auth state (user, token, session restore, QR login)
  - `serverStore.ts` — Server URL discovery and persistence
  - `warehouseStore.ts` — Currently selected warehouse and its shelves
- Depends on: Services, `AsyncStorage`
- Used by: Screens and `AppNavigator`

**Screens (Mobile):**
- Purpose: UI and local interaction logic
- Location: `mobile/src/screens/`
- Contains: React Native components grouped by domain (auth, product, shelf, warehouse)
- Depends on: Stores, services, shared components, navigation types
- Used by: `AppNavigator`

**Navigation (Mobile):**
- Purpose: Define app routing and startup sequencing
- Location: `mobile/src/navigation/AppNavigator.tsx`
- Pattern: Two-phase boot: (1) discover server URL, (2) restore auth session. Then gate routes on `isAuthenticated`. Uses a root `Stack.Navigator` with a nested `Tab.Navigator` for the main tabs (Magazzini, Prodotti).

## Data Flow

**Standard CRUD Request:**

1. Screen calls a service method (e.g., `productService.create(dto)`)
2. Service calls `api.post('/products', dto)` via the shared Axios instance
3. Axios request interceptor attaches JWT from AsyncStorage
4. Express Router matches route → runs `protect` middleware → calls controller
5. Controller validates, calls Mongoose method, returns JSON
6. Axios response returns typed data to service
7. Screen updates local state or triggers navigation

**Authentication Flow:**

1. User submits credentials → `useAuthStore.login()` called
2. `authService.login()` calls `POST /api/auth/login`
3. Server verifies password with bcrypt; returns `{ token, user }`
4. Token stored in `AsyncStorage` under key `auth_token`
5. `useAuthStore` sets `isAuthenticated: true`
6. `AppNavigator` re-renders, revealing authenticated routes

**QR Login Flow:**

1. User registers → server creates `loginToken` (random 64-char hex) on the `User` document
2. `pendingQrToken` set in `authStore`; `MyQRCodeScreen` shown first
3. Second device scans QR → `POST /api/auth/qr-login` with the `loginToken`
4. Server finds user by `loginToken`, returns a JWT — no password required

**Server Discovery Flow:**

1. App starts → `useServerStore.discover()` called
2. Check `AsyncStorage` for previously saved URL; verify with `GET /health`
3. If not found: subnet scan (batches of 30, 600 ms timeout per host) looking for `/health` returning `{ app: 'gestione-magazzino' }`
4. Found URL saved to `AsyncStorage`; `api.defaults.baseURL` updated via `setServerUrl()`
5. If no server found: `ServerSetupScreen` shown for manual IP entry

**Voice Transcription Flow (Whisper):**

1. Mobile records audio and calls `POST /api/transcribe` (multipart)
2. Server receives file via `multer` (in-memory buffer)
3. Server proxies the audio to the local `whisper-asr` container at `WHISPER_URL/asr`
4. Whisper returns `{ text }` which the server forwards to the mobile client

**State Management:**

- Zustand stores are the single source of truth for auth state, server URL, and selected warehouse
- Screens fetch resource data locally (no shared product/shelf cache store)
- `AsyncStorage` is used for persistence of JWT and server URL across app restarts

## Key Abstractions

**`api` (Axios instance):**
- Purpose: Single HTTP client with dynamic `baseURL`, JWT injection, and 401 handling
- Location: `mobile/src/services/api.ts`
- Pattern: Configured singleton; `setServerUrl()` sets `baseURL` at runtime after discovery

**`protect` middleware:**
- Purpose: JWT guard applied to all authenticated routes
- Location: `server/src/middleware/auth.ts`
- Pattern: Reads `Authorization: Bearer <token>`, verifies with `JWT_SECRET`, attaches full `User` document to `req.user`

**`IUser.loginToken`:**
- Purpose: Persistent random token enabling QR-code based login without password
- Location: `server/src/models/User.ts`
- Pattern: Auto-generated on user creation via `crypto.randomBytes(32)`; can be regenerated on demand

**Domain Models (Warehouse → Shelf → Product hierarchy):**
- `Warehouse` has a `gridWidth × gridHeight` grid
- `Shelf` occupies one grid cell `(x, y)` within a warehouse, has `levels` (shelving levels)
- `Product` references both `warehouseId` and `shelfId`, plus `level` and optional `slot` for fine-grained location

**`WarehouseMap` component:**
- Purpose: SVG-based interactive 2D grid view of a warehouse floor
- Location: `mobile/src/components/WarehouseMap.tsx`
- Pattern: Renders via `react-native-svg`; O(1) shelf lookup via a `Map<"x,y", Shelf>` built on render

## Entry Points

**Server:**
- Location: `server/src/app.ts`
- Triggers: `node dist/app.js` (or `ts-node` in dev); Docker entrypoint
- Responsibilities: Create Express app, register global middleware, mount route modules, connect to MongoDB, start HTTP listener

**Mobile:**
- Location: `mobile/App.tsx` (Expo entry)
- Triggers: Expo Metro Bundler
- Responsibilities: Wrap app in `<AppNavigator>`; handle font/asset loading

## Error Handling

**Strategy:** Errors propagate via `next(err)` to the global `errorHandler` middleware on the server. On the mobile, API errors are caught per-screen and surfaced via `Alert` using `handleApiError()`.

**Patterns:**
- Server controllers wrap all logic in `try/catch`; call `next(err)` unconditionally on failure
- `errorHandler` maps any `AppError.statusCode` (or defaults to 500) and returns `{ message }`
- Mobile `api.ts` response interceptor auto-clears `auth_token` from AsyncStorage on 401
- `handleApiError` utility (`mobile/src/hooks/useApiError.ts`) extracts `response.data.message` or falls back to `error.message`

## Cross-Cutting Concerns

**Logging:** `console.error` in the server error handler (dev only); no structured logging library
**Validation:** `express-validator` on routes for required fields and type constraints; no Zod usage on server
**Authentication:** JWT (`jsonwebtoken`) with `Bearer` header scheme; `bcryptjs` for password hashing; `loginToken` field for QR-based login
**Admin Authorization:** `requireAdmin` middleware guards warehouse create/update/delete routes; all other routes require only `protect`
**CORS:** Enabled globally on all routes via `cors()` with no origin restrictions

---

*Architecture analysis: 2026-04-03*
