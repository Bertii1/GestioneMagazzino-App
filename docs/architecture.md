# Architettura del sistema

## Panoramica

GestioneMagazzino è un sistema client-server composto da:

- **Backend REST API** — Node.js/Express/TypeScript su EC2, dietro Caddy
- **App mobile** — React Native/Expo, mobile-first, funziona in LAN o via Internet
- **Database** — MongoDB 7 con Mongoose 8.5
- **Infrastruttura** — Docker Compose, auto-deploy via GitHub Actions + AWS SSM

```
                              ┌──────────────────────────────┐
                              │        EC2 (eu-south-1)      │
  ┌──────────────────┐        │  ┌──────────┐  ┌──────────┐  │
  │   App Mobile     │ HTTPS  │  │  Caddy   │→ │ Express  │  │
  │  React Native    │───────→│  │ :80/:443 │  │  :3000   │  │
  │  Expo 55         │        │  └──────────┘  └─────┬────┘  │
  └──────────────────┘        │                      │        │
                              │              ┌────────▼─────┐ │
         LAN locale           │              │  MongoDB :27017│ │
  ┌──────────────────┐ HTTP   │              └──────────────┘ │
  │  stesso subnet   │───────→│                               │
  └──────────────────┘        └───────────────────────────────┘
```

---

## Server — pattern MVC

Entry point: `server/src/app.ts`

```
app.ts
  ├── helmet + cors + express.json (10MB) + rateLimit
  ├── metricsMiddleware (Prometheus)
  │
  ├── /api/auth       → routes/auth.ts       → authController.ts
  ├── /api/warehouses → routes/warehouses.ts → warehouseController.ts
  │                                            shelfController.ts (nested)
  ├── /api/shelves    → routes/shelves.ts    → shelfController.ts
  ├── /api/products   → routes/products.ts   → productController.ts
  │                                            productPhotoController.ts
  ├── /api/vision     → routes/vision.ts     → visionController.ts (Gemini AI)
  ├── /api/users      → routes/users.ts      → userController.ts
  ├── /api/backup     → routes/backup.ts     → mongodump stream
  ├── /api/version    → routes/version.ts    → versionController.ts
  ├── /metrics        → routes/metrics.ts    → prometheus (bloccato da Caddy)
  ├── /health         → { status: 'ok', minAppVersion }
  ├── /uploads/       → static (foto prodotti, Cache-Control 7gg)
  └── errorHandler middleware (catch-all)
```

### Middleware pipeline (richieste protette)

```
Request
  → helmet (security headers)
  → cors (CORS_ORIGIN env)
  → rateLimit (500 req/15min prod | 1000 dev)
  → authLimiter su /api/auth (15 req/15min prod)
  → metricsMiddleware (counter + histogram Prometheus)
  → protect
      estrae "Authorization: Bearer <token>"
      verifica firma JWT con JWT_SECRET
      carica user da DB
      controlla tokenVersion (invalida logout)
      attacca req.user
  → [requireAdmin] (role === 'admin')
  → controller function
  → [errorHandler] log Pino + risposta JSON uniforme
```

---

## Mobile — pattern Screens / Stores / Services

Entry point: `mobile/App.tsx` → `navigation/AppNavigator.tsx`

```
App.tsx (update check OTA + modal)
  └── AppNavigator.tsx
        │
        ├── [fase 1] Server Setup
        │     serverStore.discover()
        │       → URL fisso (FIXED_API_URL)
        │       → URL salvato in AsyncStorage
        │       → scansione subnet LAN (serverDiscovery.ts)
        │       → input manuale utente
        │
        ├── [fase 2] Session Restore
        │     authStore.restoreSession()
        │       → legge token da AsyncStorage
        │       → GET /api/auth/me
        │
        ├── [fase 3] Change Password (se mustChangePassword=true)
        │     ChangePasswordScreen
        │
        └── [fase 4] MainTabs
              ├── Tab Magazzini
              │     WarehouseListScreen
              │       → WarehouseMapScreen (griglia interattiva)
              │           → ShelfDetailScreen (prodotti per ripiano)
              │               → ShelfQRScreen (QR singolo ripiano)
              │               → BatchQRPrintScreen (stampa QR multipli)
              │
              ├── Tab Prodotti
              │     ProductListScreen (filtri: warehouse, shelf, q)
              │       → ProductDetailScreen (foto, azioni)
              │           → ProductFormScreen (crea / modifica)
              │               → ScanBarcodeScreen (fotocamera)
              │
              └── Tab Admin  (visibile solo se role === 'admin')
                    AdminPanelScreen (gestione utenti)
```

### Flusso dati

```
Screen
  ↓  chiama azione
Zustand Store (authStore / warehouseStore / serverStore)
  ↓  chiama service
Service layer (authService / productService / ...)
  ↓  HTTP Axios (JWT header automatico, timeout 10s)
api.ts (base URL dinamica impostata da serverStore)
  ↓
Server API → risposta JSON
  ↓
Store aggiorna state → re-render screen
```

---

## Dipendenze chiave tra layer

```
AppNavigator
  ├── serverStore.discover()
  │     → serverDiscovery.discoverServer()
  │     → GET /health (ping, timeout 600ms)
  │
  ├── authStore.restoreSession()
  │     → authService.getStoredToken()
  │     → authService.getMe() → GET /api/auth/me
  │
  └── user.role → mostra/nasconde tab Admin

ProductFormScreen
  ├── productService.lookupCatalog(barcode)
  │     → GET /api/products/catalog/:barcode  (autofill offline)
  ├── POST /api/vision/identify (FormData foto → Gemini AI → autofill)
  └── productService.create/update → POST/PUT /api/products

App.tsx
  └── updateService.checkForUpdate()
        → GET /api/version?platform=android
        → modal aggiornamento (forceUpdate blocca l'app)
```

---

## Monitoring (profilo opzionale)

```bash
docker compose --profile monitoring up
```

```
Express :3000/metrics  (prometheus-client)
  ↓  scraping ogni 15s
Prometheus
  ↓  datasource
Grafana  →  http://DOMAIN/grafana

Pino logs → stdout → Promtail → Loki → Grafana (logs)
```

**Metriche esposte:**

| Metrica | Tipo | Labels |
|---|---|---|
| `magazzino_http_requests_total` | Counter | method, route, status_code |
| `magazzino_http_request_duration_seconds` | Histogram | method, route |

Buckets histogram: `0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5` secondi.

---

## Sicurezza

| Misura | Implementazione |
|---|---|
| Rate limiting | express-rate-limit (globale + stretto su /api/auth) |
| HTTPS | Caddy (Let's Encrypt automatico) |
| JWT | HS256, scadenza configurabile (default 7d) |
| Logout sicuro | tokenVersion su ogni user — incrementato al logout |
| Bcrypt | genSalt(10) su ogni password |
| Helmet | Header HTTP di sicurezza su tutte le risposte |
| Metrics | /metrics bloccato esternamente da Caddy (403) |
| Backup | Bearer token separato (BACKUP_API_KEY) |
| Deploy AWS | OIDC federation, nessuna chiave statica, accesso solo SSM |
| Timing attacks | timingSafeEqual per confronto token in versionController |
