# Testing Patterns

**Analysis Date:** 2026-04-03

## Test Framework

**Runner:** None configured

**Status:** Zero test files exist in the codebase. No test runner, assertion library, or testing framework is installed in either `server/package.json` or `mobile/package.json`. No `jest.config.*`, `vitest.config.*`, or equivalent configuration files are present.

**Run Commands:**
```bash
# No test commands defined — must be added
```

## Test File Organization

**Location:** No test files exist.

**Expected pattern for future tests (based on project structure):**
```
server/src/
├── controllers/
│   ├── productController.ts
│   └── productController.test.ts    # co-located unit tests
├── models/
│   ├── Product.ts
│   └── Product.test.ts
mobile/src/
├── services/
│   ├── productService.ts
│   └── productService.test.ts
└── store/
    ├── authStore.ts
    └── authStore.test.ts
```

## Current Coverage

**Coverage: 0%** — no tests exist at any layer (unit, integration, E2E).

## Missing Test Infrastructure

### Server (Node.js / Express / TypeScript)

Recommended packages to install:
```bash
cd server
npm install --save-dev jest ts-jest @types/jest supertest @types/supertest
```

Recommended `jest.config.ts` for server:
```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};

export default config;
```

### Mobile (React Native / Expo / TypeScript)

Recommended packages to install:
```bash
cd mobile
npm install --save-dev jest jest-expo @testing-library/react-native @types/jest
```

Recommended `jest.config.ts` for mobile:
```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};

export default config;
```

## Priority Test Areas

### High Priority — Server Controllers

Controllers at `server/src/controllers/` contain all business logic and are the highest-value test targets.

**What to test in `productController.ts`:**
- `getProducts`: filtering by `warehouseId`, `shelfId`, text search `q`
- `getProduct`: 404 when not found, populated response shape
- `createProduct`: validation errors, successful creation returning 201
- `updateProduct`: 404 when not found, `runValidators: true` behavior
- `deleteProduct`: 404 when not found, successful deletion message

**Example test structure for controller (server):**
```typescript
// server/src/controllers/productController.test.ts
import request from 'supertest';
import app from '../app';

describe('GET /api/products', () => {
  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('returns product list for authenticated user', async () => {
    // Set up auth token and mock data
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

### High Priority — Auth Middleware

`server/src/middleware/auth.ts` guards all protected routes.

**What to test:**
- Missing `Authorization` header → 401
- Malformed `Bearer` token → 401
- Valid token, user not found in DB → 401
- Valid token, user found → `req.user` populated, `next()` called
- `requireAdmin`: non-admin user → 403
- `requireAdmin`: admin user → `next()` called

### High Priority — Mobile Stores

Zustand stores at `mobile/src/store/` contain the core state management logic.

**What to test in `authStore.ts`:**
- `login`: successful login sets `isAuthenticated: true`, `user`, `token`
- `login`: service failure propagates error
- `logout`: clears user, token, sets `isAuthenticated: false`
- `restoreSession`: with stored token, restores user state
- `restoreSession`: with no stored token, sets `isLoading: false`
- `clearPendingQr`: sets `pendingQrToken: null`

**Example Zustand store test:**
```typescript
// mobile/src/store/authStore.test.ts
import { useAuthStore } from './authStore';
import { authService } from '../services/authService';

jest.mock('../services/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    pendingQrToken: null,
  });
});

describe('login', () => {
  it('sets authenticated state on success', async () => {
    const fakeUser = { _id: '1', name: 'Test', email: 'test@test.com', role: 'operator' as const, createdAt: '' };
    mockAuthService.login.mockResolvedValue({ token: 'tok', user: fakeUser });

    await useAuthStore.getState().login('test@test.com', 'password');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('tok');
  });
});
```

### Medium Priority — Mobile Services

Services at `mobile/src/services/` are thin wrappers around the `api` axios instance. Testing them requires mocking `api`.

**What to test in `productService.ts`:**
- `getAll`: passes params correctly, returns typed array
- `getById`: constructs correct URL with id
- `create`: posts DTO, returns created product
- `delete`: calls delete endpoint, returns void

**Mocking pattern for services:**
```typescript
// mobile/src/services/productService.test.ts
import { productService } from './productService';
import api from './api';

jest.mock('./api');
const mockApi = api as jest.Mocked<typeof api>;

describe('productService.getAll', () => {
  it('returns products array', async () => {
    mockApi.get.mockResolvedValue({ data: [{ _id: '1', name: 'Test' }] });
    const result = await productService.getAll();
    expect(mockApi.get).toHaveBeenCalledWith('/products', { params: undefined });
    expect(result).toHaveLength(1);
  });
});
```

### Medium Priority — Server Models

Mongoose models at `server/src/models/` contain schema validation and pre-save hooks.

**What to test in `User.ts`:**
- `comparePassword`: returns true for matching password, false for wrong password
- Pre-save hook: password is hashed before save, not stored in plaintext
- `toJSON` transform: password field excluded from serialized output
- Schema validation: `email` unique constraint, `role` enum restriction

**What to test in `Product.ts`:**
- Schema validation: required fields (`barcode`, `name`, `warehouseId`, `shelfId`, `level`)
- `level` minimum constraint (`min: 1`)
- `quantity` minimum constraint (`min: 0`)
- Text indexes exist for search

### Low Priority — Error Handler Middleware

`server/src/middleware/errorHandler.ts` is simple but critical.

**What to test:**
- Error with `statusCode` uses that status
- Error without `statusCode` defaults to 500
- In `development` env: `console.error` called
- In `production` env: `console.error` not called
- Response shape: always `{ message: string }`

## Test Database Strategy

Server tests require MongoDB access. Recommended approach:

```bash
npm install --save-dev mongodb-memory-server
```

```typescript
// server/src/test/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
```

## Async Testing Patterns

**All controller and service tests are async:**
```typescript
it('returns 404 for missing product', async () => {
  const res = await request(app)
    .get('/api/products/000000000000000000000000')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(404);
  expect(res.body.message).toBe('Prodotto non trovato');
});
```

## Error Testing Patterns

**Expected error response shape from server:**
```typescript
// Validation error
expect(res.body).toEqual({ errors: expect.arrayContaining([expect.objectContaining({ msg: expect.any(String) })]) });

// Not found / auth error
expect(res.body).toEqual({ message: expect.any(String) });
```

## Mocking

**What to mock:**
- External HTTP calls in mobile services (mock `api` axios instance)
- `authService` in store tests
- `AsyncStorage` in service and store tests: `jest.mock('@react-native-async-storage/async-storage')`
- MongoDB in server unit tests (use `mongodb-memory-server` for integration)
- External barcode lookup APIs in `ProductFormScreen` tests

**What NOT to mock:**
- The `errorHandler` middleware (test it as integration through `supertest`)
- Mongoose schema validation (use real mongoose with in-memory MongoDB)
- Zustand store logic (test state transitions directly via `store.setState` and `store.getState`)

## Coverage Targets

**Required minimum:** 80% (per project testing rules)

**Recommended coverage command once framework is installed:**
```bash
# Server
cd server && npx jest --coverage

# Mobile
cd mobile && npx jest --coverage
```

## Recommended Test Script Additions

Add to `server/package.json`:
```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

Add to `mobile/package.json`:
```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

---

*Testing analysis: 2026-04-03*
