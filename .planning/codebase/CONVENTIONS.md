# Coding Conventions

**Analysis Date:** 2026-04-03

## Naming Patterns

**Files:**
- React Native screen components: PascalCase + `Screen` suffix — `ProductFormScreen.tsx`, `ShelfDetailScreen.tsx`
- React Native shared components: PascalCase — `FloatingActionButton.tsx`, `WarehouseMap.tsx`
- Services (mobile): camelCase + `Service` suffix — `productService.ts`, `authService.ts`
- Stores (mobile): camelCase + `Store` suffix — `authStore.ts`, `warehouseStore.ts`
- Controllers (server): camelCase + `Controller` suffix — `productController.ts`, `authController.ts`
- Routes (server): plural noun, lowercase — `products.ts`, `warehouses.ts`, `shelves.ts`
- Models (server): PascalCase singular — `Product.ts`, `Shelf.ts`, `User.ts`
- Middleware (server): camelCase descriptive — `auth.ts`, `errorHandler.ts`
- Type definition files: lowercase `index.ts`

**Functions:**
- Controller handlers: camelCase verb + noun — `getProducts`, `createProduct`, `deleteProduct`, `getProductByBarcode`
- Service methods: camelCase verb + noun — `getAll`, `getById`, `getByBarcode`, `create`, `update`, `delete`
- React component handlers: camelCase `handle` prefix — `handleSave`, `handleConnect`, `handleInlineScan`
- React component state setters: auto-generated `set` prefix from `useState`
- Async operations in hooks/stores: camelCase verbs — `login`, `logout`, `register`, `restoreSession`
- Private helpers: camelCase descriptive — `buildCleanName`, `generateInternalCode`, `signToken`, `applyTranscription`

**Variables:**
- camelCase throughout — `selectedWarehouseId`, `listeningField`, `lookupResult`
- Boolean flags: adjective or `is` prefix — `isEdit`, `isAuthenticated`, `isLoading`, `saving`, `looking`
- Ref variables: camelCase + `Ref` suffix — `scanHandledRef`, `recordingRef`, `listeningFieldRef`

**Types and Interfaces:**
- Interface names: PascalCase `I` prefix for Mongoose documents — `IProduct`, `IUser`, `IWarehouse`, `IShelf`
- Interface names: PascalCase no prefix for app-level types — `AuthRequest`, `AppError`, `LookupResult`
- DTO types: PascalCase + `Dto` suffix — `CreateProductDto`, `UpdateProductDto`, `CreateShelfDto`
- Type aliases: PascalCase — `ApiErrorShape`, `RootStackParamList`, `TabParamList`
- Generic API wrapper: `ApiResponse<T>` pattern
- Navigation param lists: PascalCase + `ParamList` suffix — `RootStackParamList`, `TabParamList`
- State shape interfaces: PascalCase + `State` suffix — `AuthState`

**Constants:**
- Local constants: camelCase — `const PORT`, `const app`, `const router`
- Enum-like string literals use union types: `'admin' | 'operator'`, `'idle' | 'recording' | 'transcribing'`

## Code Style

**Formatting:**
- No Prettier config file found; formatting is manual/editor-driven
- Semicolons used consistently
- Single quotes for strings in TypeScript
- 2-space indentation throughout
- Trailing commas in multi-line structures

**Linting:**
- ESLint configured for server only via `server/package.json` lint script: `eslint src/**/*.ts`
- No ESLint config file found (no `.eslintrc*`) — relies on defaults or editor integration
- Mobile has one explicit `// eslint-disable-next-line react-hooks/exhaustive-deps` suppression in `ProductFormScreen.tsx`

**TypeScript:**
- `strict: true` enabled in both `server/tsconfig.json` and `mobile/tsconfig.json`
- `esModuleInterop: true` on server for CommonJS interop
- Server target: `ES2020`, module: `commonjs`
- Mobile extends `expo/tsconfig.base` with `strict: true`
- Mobile path alias: `@/*` maps to `src/*`
- Explicit return types on async controller functions: `Promise<void>`
- `unknown` used for caught errors in `catch` blocks; then cast to expected shape inline

## Import Organization

**Server order (observed):**
1. Node.js built-ins (`crypto`)
2. Third-party packages (`express`, `mongoose`, `bcryptjs`, `jsonwebtoken`)
3. Local modules with relative paths (`../models/Product`, `./middleware/auth`)

**Mobile order (observed):**
1. React and React Native core (`react`, `react-native`)
2. Expo packages (`expo-camera`, `expo-av`)
3. Third-party navigation/query libraries (`@react-navigation/*`, `@tanstack/react-query`)
4. Internal services (`../../services/api`)
5. Internal stores (`../store/authStore`)
6. Internal types (`../../types`)
7. UI icon libraries (`@expo/vector-icons`)

**Path Aliases:**
- Mobile: `@/*` → `src/*` (defined in `mobile/tsconfig.json`), but actual imports use relative paths (`../../services/api`) — alias is available but not consistently used

## Error Handling

**Server pattern:**
- All async controller handlers use `try/catch` with `next(err)` to forward to global `errorHandler` middleware
- `errorHandler` middleware at `server/src/middleware/errorHandler.ts` formats all unhandled errors as `{ message }` JSON with appropriate status code
- Validation errors from `express-validator` return `{ errors: errors.array() }` at status 400
- 404 responses return `{ message: '...' }` inline within handlers (not thrown)
- Auth errors return `{ message: '...' }` directly in `protect` middleware

**Mobile pattern:**
- Screen-level handlers use `try/catch/finally` with `Alert.alert('Errore', msg)` for user-facing errors
- `handleApiError` utility at `mobile/src/hooks/useApiError.ts` extracts `response.data.message` from Axios errors
- Global Axios interceptor in `mobile/src/services/api.ts` handles 401 by clearing `auth_token` from AsyncStorage
- Store actions (`authStore`) propagate errors to callers; screens are responsible for catching and showing alerts

## Logging

**Framework:** `console.log` and `console.error` (no logging library)

**Patterns:**
- Server startup: `console.log` for server start message and environment
- Error handler: `console.error('[ERROR]', err)` only in `development` environment
- No logging in controllers — errors propagate via `next(err)`
- Mobile: no explicit logging; errors surface via `Alert.alert`

## Comments

**When to Comment:**
- Italian-language inline comments for domain concepts and section dividers throughout
- Section separators using `──` box-drawing characters: `// ── Sezione ──────────`
- JSDoc-style `/** ... */` block comments on exported utility functions — `api.ts`, `useApiError.ts`
- Inline `//` comments on schema fields to explain domain meaning: `// ripiano (1-based)`, `// colonne della griglia mappa`
- Mongoose model indexes annotated: `// Indici per ricerche frequenti`

**Language:**
- Italian used for all user-facing strings, error messages, and inline comments
- Code identifiers remain English

## Function Design

**Size:**
- Controller functions are concise (15–30 lines each), one responsibility per function
- Screen components can be large (`ProductFormScreen.tsx` at ~700 lines) due to co-located styles and sub-components
- Helper functions extracted as named functions within the same file when reused: `Field`, `buildCleanName`, `generateInternalCode`

**Parameters:**
- Controllers use Express signature: `(req, res, next)` with `AuthRequest` type for authenticated routes
- Service methods accept typed DTOs: `create(dto: CreateProductDto)`
- React component helpers defined as local `function` declarations (not arrow functions) when they need clear naming

**Return Values:**
- Controller functions always return `Promise<void>`; they call `res.json()` or `res.status().json()` directly
- Service methods return typed promises: `Promise<Product>`, `Promise<Product[]>`, `Promise<void>`
- Store actions return `Promise<void>`; state updates happen via Zustand `set()`

## Module Design

**Exports:**
- Server controllers: named exports for each handler function — `export const getProducts = ...`
- Server middleware: named exports — `export const protect`, `export const requireAdmin`
- Server models: default export of Mongoose model — `export default mongoose.model<IProduct>(...)`
- Mobile services: named const object exports — `export const productService = { ... }`
- Mobile stores: named export of Zustand store hook — `export const useAuthStore = create<AuthState>(...)`
- Mobile screens: default export of React component function

**Barrel Files:**
- No barrel `index.ts` re-exports in either `server/src` or `mobile/src`
- Types consolidated in single barrel: `mobile/src/types/index.ts`
- Each module imported directly by relative path

## Data Transfer Objects

**Pattern:**
- `Create*Dto` interfaces for creation payloads — `CreateProductDto`, `CreateShelfDto`, `CreateWarehouseDto`
- `Update*Dto` often typed as `Partial<Create*Dto>` — `export type UpdateProductDto = Partial<CreateProductDto>`
- DTOs defined in `mobile/src/types/index.ts` alongside domain interfaces

## Zustand Store Pattern

**Structure:**
```typescript
interface AuthState {
  // state fields
  user: User | null;
  isLoading: boolean;
  // actions (same interface)
  login: (email: string, password: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  // initial state
  user: null,
  isLoading: true,
  // action implementations
  login: async (email, password) => {
    const { token, user } = await authService.login(email, password);
    set({ token, user, isAuthenticated: true });
  },
}));
```
- State and actions co-located in one interface
- Services called inside store actions; stores do not contain API logic directly
- `set()` called with partial state object (immutable update)

## Service Object Pattern

**Mobile services use object literal with async methods:**
```typescript
export const productService = {
  async getAll(params?: { warehouseId?: string }): Promise<Product[]> {
    const { data } = await api.get<Product[]>('/products', { params });
    return data;
  },
  async create(dto: CreateProductDto): Promise<Product> {
    const { data } = await api.post<Product>('/products', dto);
    return data;
  },
};
```
- All HTTP calls go through the shared `api` axios instance at `mobile/src/services/api.ts`
- Generic typed responses via `api.get<T>()` / `api.post<T>()`

---

*Convention analysis: 2026-04-03*
