# Codebase Concerns

**Analysis Date:** 2026-04-03

---

## Tech Debt

**No test suite whatsoever:**
- Issue: Zero test files exist anywhere in the project — no unit, integration, or E2E tests for either server or mobile.
- Files: entire `server/src/` and `mobile/src/` trees
- Impact: Any change to controllers, models, services, or screens is unverifiable. Regressions go undetected. Refactoring is unsafe.
- Fix approach: Add Vitest + Supertest for the Express server (controllers, middleware, models); add Jest + React Native Testing Library for the mobile screens and stores.

**`ProductFormScreen.tsx` is a 699-line God component:**
- Issue: A single file handles barcode scanning, inline camera modal, voice recording, Whisper transcription, online barcode lookup (two external APIs), warehouse/shelf/level selection, and CRUD save logic.
- Files: `mobile/src/screens/product/ProductFormScreen.tsx`
- Impact: Extremely hard to test, maintain, and review. Changes to one feature risk breaking unrelated features. Violates the 800-line file limit and the single-responsibility principle.
- Fix approach: Extract `useBarcodeScanner`, `useVoiceTranscription`, and `useBarcodeProductLookup` custom hooks; move the lookup card UI into a `LookupResultCard` component; move the inline scanner into a `BarcodeScannerModal` component.

**`AppNavigator.tsx` mixes navigation, server-discovery UI, and auth gate logic (309 lines):**
- Issue: The navigator file contains three fully separate concerns — server setup screen with its own form state, discovery progress spinner, and the full navigation tree.
- Files: `mobile/src/navigation/AppNavigator.tsx`
- Impact: Any change to onboarding flow, auth gates, or navigation structure risks breaking the others. Inline `ServerSetupScreen` component has no independent testability.
- Fix approach: Move `ServerSetupScreen` to its own file under `mobile/src/screens/onboarding/`. Extract server-discovery guard into a `ServerGate` component.

**`useWarehouseStore` is unused:**
- Issue: `mobile/src/store/warehouseStore.ts` defines a Zustand store for `selectedWarehouse` and `shelves`, but screens (`ProductFormScreen`, `ShelfDetailScreen`, `WarehouseListScreen`) all fetch data locally via direct service calls without writing to or reading from this store.
- Files: `mobile/src/store/warehouseStore.ts`
- Impact: Dead code adds confusion about which is the authoritative state source. Devs may write to the store thinking it's propagated, or read from it expecting current data.
- Fix approach: Either wire it properly as a shared cache layer, or delete it and rely solely on local fetch-on-focus patterns consistently.

**`@tanstack/react-query` is installed but not used:**
- Issue: `react-query` appears in `mobile/package.json` but there is no `QueryClient`, `useQuery`, or `useMutation` usage anywhere in the codebase. All data fetching is done manually with `useState` + `useCallback` + service calls.
- Files: `mobile/package.json`
- Impact: Adds ~30 KB to the bundle for zero benefit. Inconsistent signal for future developers about intended patterns.
- Fix approach: Either migrate data-fetching screens to `useQuery`/`useMutation` (significantly simplifying loading/error/refresh logic), or remove the dependency.

**Cascading deletes are absent at the database/API layer:**
- Issue: Deleting a `Warehouse` via `DELETE /api/warehouses/:id` does not delete its associated `Shelf` documents. Deleting a `Shelf` does not delete its `Product` documents. MongoDB has no referential integrity.
- Files: `server/src/controllers/warehouseController.ts`, `server/src/controllers/shelfController.ts`
- Impact: Orphaned `Shelf` and `Product` documents accumulate silently. Products reference non-existent shelves/warehouses, causing populate calls to return `null` fields that the mobile app does not handle.
- Fix approach: In `deleteWarehouse`, first delete all shelves and products for that warehouseId. In `deleteShelf`, first delete all products for that shelfId. Wrap in a Mongoose session/transaction.

**`updateProduct` and `updateShelf` accept unvalidated `req.body` directly:**
- Issue: The `PUT /:id` routes for products and shelves pass `req.body` directly to `findByIdAndUpdate` with no input validation middleware applied.
- Files: `server/src/routes/products.ts` (line 36), `server/src/routes/shelves.ts` (line 10), `server/src/controllers/productController.ts` (line 75), `server/src/controllers/shelfController.ts` (line 47)
- Impact: Any authenticated user can inject arbitrary fields (e.g., changing `warehouseId` to an invalid ObjectId, setting `quantity` to a string, adding unlisted fields to the document).
- Fix approach: Add `express-validator` chains to the `PUT` routes mirroring the `POST` validators. Strip unknown fields before passing to `findByIdAndUpdate`.

---

## Security Considerations

**Open user registration — any user can self-register as admin:**
- Risk: `POST /api/auth/register` accepts a `role` field in `req.body`. The validator checks `name`, `email`, and `password`, but does not strip or validate `role`. Any unauthenticated caller can register with `{ "role": "admin" }` and gain full admin access.
- Files: `server/src/routes/auth.ts`, `server/src/controllers/authController.ts` (line 21-29)
- Current mitigation: None.
- Recommendations: Strip `role` from the registration body on the server and default all new users to `operator`. Provide a separate admin-only endpoint or a seed-script for promoting users.

**QR login token has no expiry:**
- Risk: `loginToken` is a static 64-character hex string stored permanently in the `User` document. A leaked or photographed QR code provides indefinite login access with no expiry and no session invalidation.
- Files: `server/src/models/User.ts`, `server/src/controllers/authController.ts` (`qrLogin`)
- Current mitigation: `regenerateQrToken` exists but must be triggered manually.
- Recommendations: Add a `loginTokenExpiresAt` field with a TTL (e.g., 24 hours). After login, either rotate the token or enforce re-generation. Rate-limit the `/api/auth/qr-login` endpoint.

**CORS is fully open (`app.use(cors())`):**
- Risk: The Express server accepts cross-origin requests from any origin with no allowlist.
- Files: `server/src/app.ts` (line 16)
- Current mitigation: The server is LAN-only in current deployment, which reduces exposure, but the configuration is unsafe if the server is ever exposed publicly.
- Recommendations: Configure `cors({ origin: [...allowedOrigins] })` or at minimum restrict to `http://localhost:*` and the LAN subnet in development.

**No rate limiting on any endpoint:**
- Risk: Authentication endpoints (`/api/auth/login`, `/api/auth/qr-login`, `/api/auth/register`) have no brute-force protection.
- Files: `server/src/app.ts`, `server/src/routes/auth.ts`
- Current mitigation: None.
- Recommendations: Apply `express-rate-limit` to auth routes (e.g., 10 requests per 15 minutes per IP).

**External barcode lookup calls are made from the mobile client with no server proxy:**
- Risk: `ProductFormScreen` calls `https://api.upcitemdb.com` and `https://opengtindb.org` directly from the device. API keys (if added in future), network patterns, and scanned barcodes are exposed client-side.
- Files: `mobile/src/screens/product/ProductFormScreen.tsx` (lines 189-232)
- Current mitigation: Currently uses unauthenticated/free-tier endpoints, so no key exposure yet.
- Recommendations: Move barcode lookups to a server-side proxy endpoint so that future API keys stay server-side and rate-limit usage can be centralized.

**`JWT_SECRET` falls back to `process.env.JWT_SECRET as string` with no runtime check:**
- Risk: If `JWT_SECRET` is undefined at startup, `jwt.sign` receives an empty string as secret and still produces tokens, all of which are trivially forgeable.
- Files: `server/src/controllers/authController.ts` (line 9), `server/src/middleware/auth.ts` (line 20)
- Current mitigation: `db.ts` checks for `MONGODB_URI` before connecting, but no equivalent check exists for `JWT_SECRET`.
- Recommendations: Add a startup validation block in `server/src/app.ts` that throws if `JWT_SECRET` is missing or shorter than 32 characters.

---

## Known Bugs

**Shelf deletion leaves orphaned products — no warning or cleanup:**
- Symptoms: After deleting a shelf, its products remain in the database with a `shelfId` pointing to a non-existent document. The mobile product list displays them with `shelfId` resolving to `null`, causing a runtime crash on `ShelfDetailScreen` when trying to read `shelf.code`.
- Files: `server/src/controllers/shelfController.ts`, `mobile/src/screens/product/ProductDetailScreen.tsx` (line 50 — unsafe cast `as Shelf`)
- Trigger: Delete a shelf that contains products, then view any of those products.
- Workaround: None — the product list will show the orphaned products; navigating to their detail screen crashes.

**Navigation type-safety bypassed with `as unknown as` in two screens:**
- Symptoms: No runtime crash currently, but TypeScript provides no compile-time guarantee that the navigation call is correct.
- Files: `mobile/src/screens/product/ProductListScreen.tsx` (line 57), `mobile/src/screens/warehouse/WarehouseListScreen.tsx` (line 89)
- Trigger: Passed navigation prop is typed as `MainTabs` params only, not the full stack; workaround casts to `unknown` before re-typing.
- Workaround: Cast is in place. Fix by properly typing the navigator with a shared `useNavigation<NavigationProp<RootStackParamList>>()` hook instead of using the screen prop.

**`eslint-disable-next-line react-hooks/exhaustive-deps` suppresses a real hook warning:**
- Symptoms: Auto-lookup on mount in `ProductFormScreen` intentionally omits `doLookup` from the dependency array. If `doLookup` changes identity between renders it will silently run stale logic.
- Files: `mobile/src/screens/product/ProductFormScreen.tsx` (line 240-241)
- Trigger: Not currently triggering incorrect behavior because `doLookup` is wrapped in `useCallback`, but the suppression hides future regressions.
- Workaround: Suppressed lint rule.

---

## Performance Bottlenecks

**Full subnet scan (254 IPs, batches of 30) blocks app startup for up to ~5 seconds:**
- Problem: On first launch (or when cached server URL is unavailable), `discoverServer` probes all 254 LAN addresses. Each batch of 30 runs in parallel but the scan is serial across batches.
- Files: `mobile/src/services/serverDiscovery.ts`
- Cause: No mDNS/Bonjour or UDP broadcast is available in Expo; the implementation uses sequential HTTP polling as the only discovery mechanism.
- Improvement path: Reduce `BATCH_SIZE` for faster individual batches, or expose a QR-scannable server URL during first-time setup as an alternative to subnet scanning.

**`getProducts` has no pagination:**
- Problem: `GET /api/products` returns all products in the collection sorted by name in a single response. As inventory grows, the payload and sort cost grow unbounded.
- Files: `server/src/controllers/productController.ts` (line 15), `mobile/src/screens/product/ProductListScreen.tsx`
- Cause: No `limit`/`skip` or cursor-based pagination is implemented.
- Improvement path: Add `limit` and `page` query parameters server-side; use `FlatList`'s `onEndReached` in the mobile app for infinite scroll.

**Text search index covers `name` and `description` but not `barcode`:**
- Problem: Searching by barcode from `ProductListScreen` passes `q` as a `$text` query. Barcode is not in the text index, so full-text search will not match on barcodes.
- Files: `server/src/models/Product.ts` (line 37), `server/src/controllers/productController.ts` (line 13)
- Cause: The text index was built for name/description lookup only; barcode lookup uses a separate dedicated route (`/barcode/:barcode`) but the list screen search does not call it.
- Improvement path: Either add `barcode` to the text index, or in `getProducts`, add a regex/exact-match clause for barcode when the `q` param looks like a barcode string.

---

## Fragile Areas

**`ShelfQRScreen` uses a two-step async render loop for PNG export:**
- Files: `mobile/src/screens/shelf/ShelfQRScreen.tsx`
- Why fragile: Export relies on `setTimeout(() => ..., 150)` after setting `qrBase64` state to allow the off-screen SVG to render before calling `.toDataURL()`. Race conditions can occur on slower devices; `compositeRef.current` may still be null when the timeout fires.
- Safe modification: Do not shorten the 150 ms delay. Any refactor of the QR generation pipeline should use a `onLayout` callback on the SVG rather than a fixed timeout.
- Test coverage: None.

**`AuthRequest` uses non-null assertion (`req.user!`) in two controller functions:**
- Files: `server/src/controllers/authController.ts` (lines 90, 100)
- Why fragile: `getQrToken` and `regenerateQrToken` assume `req.user` is set because they are behind `protect` middleware. If the route is accidentally exposed without `protect`, a runtime crash occurs.
- Safe modification: Always check `if (!req.user)` before accessing `req.user._id`.

**Server URL is stored in `AsyncStorage` with no integrity check on format:**
- Files: `mobile/src/store/serverStore.ts`
- Why fragile: If the stored string is malformed (e.g., truncated during write), `verifyServerUrl` will fail silently and the app falls back to a full subnet scan, causing a slow startup every launch until the storage is cleared.
- Safe modification: Validate the stored URL format with a URL constructor before calling `verifyServerUrl`.

---

## Scaling Limits

**Single-node MongoDB with no replica set:**
- Current capacity: One MongoDB 7 container with a named volume.
- Limit: No read scaling, no automatic failover, no oplog for change streams.
- Scaling path: Deploy a 3-node replica set; adjust `MONGODB_URI` to include the `replicaSet` option.

**Whisper ASR model `small` is CPU-only:**
- Current capacity: Single container, `ASR_MODEL=small`, no GPU passthrough configured.
- Limit: Transcription takes 5-15 seconds per audio file on CPU for the `small` model; concurrent requests will queue.
- Scaling path: Pass through a GPU with `deploy.resources.reservations.devices` in `docker-compose.yml`; switch to `medium` or `large` model with GPU. Alternatively, add a task queue (e.g., Bull/BullMQ) to serialize transcription requests.

---

## Dependencies at Risk

**`multer` pinned to `1.4.5-lts.1` (LTS fork, not mainline):**
- Risk: The mainline `multer` package has been unmaintained for years. The LTS fork is community-maintained. No active security disclosures at time of analysis, but long-term support is uncertain.
- Impact: File upload handling for Whisper audio.
- Migration plan: Monitor `multer-lts` releases; evaluate migration to `busboy` directly or `@fastify/multipart` if the project moves frameworks.

**`onerahmet/openai-whisper-asr-webservice:latest` uses `latest` tag:**
- Risk: `docker-compose.yml` pins to `latest`, which means any upstream image update can silently change the ASR API contract or model format.
- Impact: Transcription endpoint may break without warning after a `docker compose pull`.
- Migration plan: Pin to a specific digest or semver tag (e.g., `onerahmet/openai-whisper-asr-webservice:v1.x.x`).

---

## Missing Critical Features

**No stock-movement or quantity-history tracking:**
- Problem: `quantity` on a product is a bare integer. There is no audit trail of who changed it, by how much, or when.
- Blocks: Inventory reporting, loss detection, supply-chain traceability.

**No pagination on any list endpoint:**
- Problem: `/api/products`, `/api/warehouses`, `/api/warehouses/:id/shelves` all return unbounded result sets.
- Blocks: Practical use beyond ~500 products before performance degrades.

**No logout invalidation / token blacklist:**
- Problem: JWT tokens are stateless. `authService.logout()` only removes the token from `AsyncStorage`. If a token is compromised, it remains valid until expiry (7 days by default).
- Blocks: Secure logout, session revocation.

**No input sanitization for the `details` Map field on Product:**
- Problem: `Product.details` is a `Map<string, unknown>` / `Schema.Types.Mixed` field. The API accepts arbitrary key-value pairs in this field with no validation or size limit.
- Blocks: Prevents potential DoS via very large or deeply nested `details` objects.

---

## Test Coverage Gaps

**All server controllers — 0% coverage:**
- What's not tested: Auth (register, login, QR login, token regeneration), product CRUD, shelf CRUD, warehouse CRUD, Whisper transcription proxy.
- Files: `server/src/controllers/`
- Risk: A regression in input validation, auth middleware, or error handling would go undetected until production.
- Priority: High

**All mobile screens and stores — 0% coverage:**
- What's not tested: Authentication flow, server discovery, product form validation, voice recording lifecycle, barcode lookup, QR export.
- Files: `mobile/src/screens/`, `mobile/src/store/`
- Risk: UI breakage from React Native or Expo version bumps is invisible.
- Priority: High

**Security-critical auth middleware — 0% coverage:**
- What's not tested: `protect` middleware token parsing, `requireAdmin` role check.
- Files: `server/src/middleware/auth.ts`
- Risk: A logic error in middleware (e.g., missing `return` before `next()`) silently passes unauthenticated requests through.
- Priority: High

---

*Concerns audit: 2026-04-03*
