# Codebase Structure

**Analysis Date:** 2026-04-03

## Directory Layout

```
gestione_magazzino/
├── docker-compose.yml       # Full stack orchestration (mongo, server, whisper-asr, mobile-dev)
├── .env                     # Runtime secrets (not committed)
├── .env.example             # Template for required env vars
├── mongo-init.js            # MongoDB initialization script (run once on first container start)
├── start.sh                 # Convenience script to launch the stack
├── release.sh               # Build/release script
│
├── server/                  # Express REST API (Node.js + TypeScript)
│   └── src/
│       ├── app.ts           # Express entry point: middleware, routes, DB connect, listen
│       ├── config/
│       │   └── db.ts        # Mongoose connection factory
│       ├── middleware/
│       │   ├── auth.ts      # JWT protect guard + requireAdmin role guard
│       │   └── errorHandler.ts  # Global Express error handler
│       ├── models/
│       │   ├── User.ts      # User schema (bcrypt, loginToken, roles)
│       │   ├── Warehouse.ts # Warehouse schema (grid dimensions)
│       │   ├── Shelf.ts     # Shelf schema (grid position x/y, levels)
│       │   └── Product.ts   # Product schema (barcode, location refs, quantity)
│       ├── routes/
│       │   ├── auth.ts      # POST /register, /login, /qr-login; GET /me, /qr-token
│       │   ├── warehouses.ts # CRUD /warehouses + nested /shelves sub-routes
│       │   ├── shelves.ts   # CRUD /shelves (standalone access)
│       │   ├── products.ts  # CRUD /products + GET /barcode/:barcode
│       │   └── transcribe.ts # POST /transcribe (multipart audio → Whisper)
│       ├── controllers/
│       │   ├── authController.ts       # register, login, getMe, qrLogin, getQrToken, regenerateQrToken
│       │   ├── warehouseController.ts  # getWarehouses, getWarehouse, createWarehouse, updateWarehouse, deleteWarehouse
│       │   ├── shelfController.ts      # getShelvesByWarehouse, getShelf, createShelf, updateShelf, deleteShelf
│       │   ├── productController.ts    # getProducts, getProduct, getProductByBarcode, createProduct, updateProduct, deleteProduct
│       │   └── transcribeController.ts # upload (multer), transcribeAudio (Whisper proxy)
│       └── utils/           # (empty — reserved for helpers)
│
└── mobile/                  # React Native app (Expo + TypeScript)
    ├── App.tsx              # Expo entry point — renders <AppNavigator>
    ├── app.json             # Expo config (app name, slug, icons)
    └── src/
        ├── navigation/
        │   └── AppNavigator.tsx  # Root navigator: server discovery → auth gate → stack/tabs
        ├── screens/
        │   ├── auth/
        │   │   ├── LoginScreen.tsx       # Email/password login form
        │   │   ├── RegisterScreen.tsx    # Registration form
        │   │   └── MyQRCodeScreen.tsx    # Display user's QR login code
        │   ├── warehouse/
        │   │   ├── WarehouseListScreen.tsx  # List all warehouses (main tab)
        │   │   └── WarehouseMapScreen.tsx   # Interactive 2D grid map of a warehouse
        │   ├── shelf/
        │   │   ├── ShelfDetailScreen.tsx    # Shelf view: levels, products per level
        │   │   ├── ShelfQRScreen.tsx        # QR code for a specific shelf+level
        │   │   └── BatchQRPrintScreen.tsx   # Print all QR codes for a warehouse's shelves
        │   └── product/
        │       ├── ProductListScreen.tsx    # List/search products (main tab)
        │       ├── ProductDetailScreen.tsx  # Product details view
        │       ├── ProductFormScreen.tsx    # Create/edit product form (voice input supported)
        │       └── ScanBarcodeScreen.tsx    # Camera barcode scanner
        ├── store/
        │   ├── authStore.ts       # Zustand: user, token, isAuthenticated, pendingQrToken
        │   ├── serverStore.ts     # Zustand: serverUrl, isDiscovering, progress
        │   └── warehouseStore.ts  # Zustand: selectedWarehouse, shelves
        ├── services/
        │   ├── api.ts             # Shared Axios instance; setServerUrl(); JWT interceptor
        │   ├── serverDiscovery.ts # LAN subnet scanner + URL verifier
        │   ├── authService.ts     # login, register, getMe, logout, qrLogin, getQrToken
        │   ├── warehouseService.ts # CRUD for warehouses
        │   ├── shelfService.ts    # CRUD for shelves
        │   └── productService.ts  # CRUD for products + getByBarcode
        ├── components/
        │   ├── WarehouseMap.tsx       # SVG grid component (react-native-svg)
        │   └── FloatingActionButton.tsx # Reusable FAB button
        ├── hooks/
        │   └── useApiError.ts     # handleApiError() utility: extracts API error message for Alert
        ├── types/
        │   └── index.ts           # All shared TypeScript interfaces and DTOs
        └── theme/                 # (empty — reserved for design tokens)
```

## Directory Purposes

**`server/src/routes/`:**
- Purpose: HTTP routing and request validation only; no business logic
- Contains: Express `Router` instances; inline `express-validator` chains
- Key files: `warehouses.ts` (also mounts nested shelf sub-routes), `products.ts` (barcode lookup route)

**`server/src/controllers/`:**
- Purpose: Request handlers — validate, call model, respond
- Contains: Async functions following `(req, res, next)` signature
- Key files: `authController.ts` (JWT issuance, QR token management), `transcribeController.ts` (Whisper proxy)

**`server/src/models/`:**
- Purpose: Mongoose document schemas + TypeScript interfaces
- Contains: Schemas, indices, pre-save hooks, instance methods
- Key files: `User.ts` (bcrypt pre-save hook, `comparePassword` method, `loginToken` field), `Product.ts` (text search index)

**`server/src/middleware/`:**
- Purpose: Request pipeline cross-cutting concerns
- Contains: `protect` (JWT), `requireAdmin` (RBAC), `errorHandler` (catch-all)

**`mobile/src/store/`:**
- Purpose: Global reactive state shared across screens
- Contains: Zustand stores; each store owns async actions that call services
- Key files: `serverStore.ts` (LAN discovery flow), `authStore.ts` (session lifecycle)

**`mobile/src/services/`:**
- Purpose: Typed wrappers over HTTP calls; no UI logic
- Contains: Plain objects with async methods returning domain types
- Key files: `api.ts` (single Axios instance for entire app), `serverDiscovery.ts` (subnet scan)

**`mobile/src/screens/`:**
- Purpose: UI screens organized by feature domain
- Contains: React Native components; local state via `useState`; data fetching via services or stores
- Key files: `ProductFormScreen.tsx` (voice/barcode input), `WarehouseMapScreen.tsx` (interactive map), `ScanBarcodeScreen.tsx` (camera integration)

**`mobile/src/components/`:**
- Purpose: Shared presentational components reused across screens
- Key files: `WarehouseMap.tsx` (SVG warehouse grid), `FloatingActionButton.tsx` (reusable FAB)

**`mobile/src/types/`:**
- Purpose: Single source of truth for all TypeScript types
- Key file: `index.ts` — all domain interfaces (`User`, `Warehouse`, `Shelf`, `Product`), DTOs (`CreateProductDto`, `UpdateProductDto`), `ApiResponse<T>`, `RootStackParamList`

## Key File Locations

**Entry Points:**
- `server/src/app.ts`: Server entry — Express app, route registration, DB connect, HTTP listen
- `mobile/App.tsx`: Expo entry — wraps `<AppNavigator>`
- `mobile/src/navigation/AppNavigator.tsx`: Full navigation tree + startup logic

**Configuration:**
- `docker-compose.yml`: Infrastructure definition for all services
- `.env.example`: Documents all required environment variables
- `server/src/config/db.ts`: MongoDB connection using `MONGODB_URI`

**Core Logic:**
- `mobile/src/services/api.ts`: Axios instance — every server call flows through this
- `mobile/src/services/serverDiscovery.ts`: LAN scan algorithm
- `server/src/middleware/auth.ts`: JWT protect + RBAC guards used on all non-public routes

**Domain Models:**
- `server/src/models/User.ts`
- `server/src/models/Warehouse.ts`
- `server/src/models/Shelf.ts`
- `server/src/models/Product.ts`

**Shared Types (mobile):**
- `mobile/src/types/index.ts`

## Naming Conventions

**Files:**
- Server models: PascalCase singular (`Product.ts`, `User.ts`)
- Server controllers/routes/middleware: camelCase (`authController.ts`, `errorHandler.ts`)
- Mobile screens: PascalCase with `Screen` suffix (`ProductFormScreen.tsx`)
- Mobile services: camelCase with `Service` suffix (`productService.ts`)
- Mobile stores: camelCase with `Store` suffix (`authStore.ts`)
- Mobile components: PascalCase (`WarehouseMap.tsx`, `FloatingActionButton.tsx`)

**Directories:**
- Server: lowercase (`controllers/`, `models/`, `routes/`, `middleware/`)
- Mobile screens: lowercase domain (`auth/`, `product/`, `shelf/`, `warehouse/`)
- Mobile source: lowercase (`store/`, `services/`, `hooks/`, `types/`, `theme/`)

## Where to Add New Code

**New API resource (e.g., "categories"):**
- Model: `server/src/models/Category.ts`
- Controller: `server/src/controllers/categoryController.ts`
- Route: `server/src/routes/categories.ts`
- Register in: `server/src/app.ts` → `app.use('/api/categories', categoryRoutes)`
- Mobile service: `mobile/src/services/categoryService.ts`
- Add types: `mobile/src/types/index.ts`

**New screen:**
- Create file: `mobile/src/screens/<domain>/<NameScreen>.tsx`
- Add route param type to `RootStackParamList` in `mobile/src/types/index.ts`
- Register screen in `mobile/src/navigation/AppNavigator.tsx`

**New shared component:**
- Place in `mobile/src/components/`
- Use PascalCase filename

**New global state:**
- Add to existing store if domain matches, or create `mobile/src/store/<name>Store.ts`
- Follow Zustand `create<State>()` pattern with inline actions

**New utility/hook (mobile):**
- Place in `mobile/src/hooks/`

**New server utility:**
- Place in `server/src/utils/`

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents (architecture maps, phases, tasks)
- Generated: No
- Committed: Yes

**`mobile/.expo/`:**
- Purpose: Expo SDK cache and project metadata
- Generated: Yes
- Committed: No (in `.gitignore`)

**`server/node_modules/`, `mobile/node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes
- Committed: No

**`mongo_data` (Docker volume):**
- Purpose: Persistent MongoDB data storage
- Generated: Yes (Docker)
- Committed: No

**`whisper_cache` (Docker volume):**
- Purpose: Cached Whisper model weights
- Generated: Yes (Docker)
- Committed: No

---

*Structure analysis: 2026-04-03*
