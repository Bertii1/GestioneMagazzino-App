# App Mobile

Stack: **React Native 0.81 + Expo 55 + TypeScript**  
State management: **Zustand 4.5**  
HTTP client: **Axios** (via `services/api.ts`)

---

## Struttura directory

```
mobile/
├── App.tsx                     # Entry point + check aggiornamenti
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx    # Stack navigator principale
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── ChangePasswordScreen.tsx
│   │   │   └── MyQRCodeScreen.tsx
│   │   ├── warehouse/
│   │   │   ├── WarehouseListScreen.tsx
│   │   │   └── WarehouseMapScreen.tsx
│   │   ├── shelf/
│   │   │   ├── ShelfDetailScreen.tsx
│   │   │   ├── ShelfQRScreen.tsx
│   │   │   └── BatchQRPrintScreen.tsx
│   │   ├── product/
│   │   │   ├── ProductListScreen.tsx
│   │   │   ├── ProductDetailScreen.tsx
│   │   │   ├── ProductFormScreen.tsx
│   │   │   └── ScanBarcodeScreen.tsx
│   │   └── admin/
│   │       └── AdminPanelScreen.tsx
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── warehouseStore.ts
│   │   └── serverStore.ts
│   ├── services/
│   │   ├── api.ts              # Axios instance
│   │   ├── serverDiscovery.ts
│   │   ├── authService.ts
│   │   ├── warehouseService.ts
│   │   ├── shelfService.ts
│   │   ├── productService.ts
│   │   ├── adminService.ts
│   │   └── updateService.ts
│   ├── hooks/
│   │   ├── useUpdateChecker.ts
│   │   └── useApiError.ts
│   ├── components/
│   │   ├── WarehouseMap.tsx    # Canvas griglia interattiva
│   │   └── FloatingActionButton.tsx
│   └── types/
│       └── index.ts            # Tutte le interfacce TypeScript condivise
```

---

## Navigazione

**File:** `mobile/src/navigation/AppNavigator.tsx`

Il navigator gestisce quattro fasi sequenziali all'avvio:

```
Fase 1 — Server Setup
  serverStore.discover()
    → FIXED_API_URL (hardcoded per prod)
    → URL da AsyncStorage
    → discoverServer() (scan LAN)
    → fallback: schermata input manuale

Fase 2 — Session Restore
  authStore.restoreSession()
    → legge JWT da AsyncStorage
    → GET /api/auth/me
    → se fallisce: schermata Login

Fase 3 — Cambio password obbligatorio
  Se mustChangePassword === true
    → ChangePasswordScreen (blocca la navigazione)

Fase 4 — App principale (MainTabs)
  Tab Magazzini | Tab Prodotti | Tab Admin
```

### Navigation param types

Definiti in `types/index.ts` come `RootStackParamList`:

| Screen | Params |
|---|---|
| `Login` | — |
| `ChangePassword` | — |
| `MainTabs` | — |
| `WarehouseMap` | `{ warehouseId: string }` |
| `ShelfDetail` | `{ shelfId: string }` |
| `ProductDetail` | `{ productId: string }` |
| `ProductForm` | `{ productId?: string, shelfId?: string, level?: number }` |
| `ScanBarcode` | — |
| `ShelfQR` | `{ shelfId: string, level: number }` |
| `BatchQRPrint` | `{ warehouseId: string }` |
| `MyQRCode` | — |
| `AdminPanel` | — |

---

## Screens

### Auth

**`LoginScreen`**  
Login email/password e login via QR code.
- Mostra form email/password con validazione locale
- Bottone "Scansiona QR" apre la fotocamera
- QR atteso: URI `magazzino://login/{loginToken}`
- In caso di `mustChangePassword: true`, naviga a `ChangePasswordScreen`

**`ChangePasswordScreen`**  
Obbligatorio al primo accesso e dopo reset admin.
- Richiede la password corrente per conferma
- Dopo il cambio, riceve un nuovo JWT con `tokenVersion` aggiornata

**`MyQRCodeScreen`**  
Genera il QR personale per il login rapido.
- Legge `loginToken` tramite `GET /api/auth/qr-token`
- Azione "Rigenera" chiama `POST /api/auth/qr-token/regenerate`

---

### Warehouse

**`WarehouseListScreen`**  
Lista dei magazzini con ricerca inline.
- Tap su un magazzino → `WarehouseMapScreen`
- Admin: bottone "+" per creare magazzino

**`WarehouseMapScreen`**  
Visualizza la griglia `gridWidth × gridHeight` del magazzino.
- Usa il componente `WarehouseMap` (canvas/SVG)
- Scaffali occupano celle (x, y) nella griglia
- Tap su scaffale → `ShelfDetailScreen`
- Header: bottone stampa QR batch → `BatchQRPrintScreen`

---

### Shelf

**`ShelfDetailScreen`**  
Dettaglio scaffale con prodotti raggruppati per ripiano.
- Lista prodotti per ripiano (1, 2, 3, ...)
- Tap su prodotto → `ProductDetailScreen`
- Tap su ripiano → `ShelfQRScreen`

**`ShelfQRScreen`**  
QR code per un singolo ripiano.
- Dati codificati: `shelf:{shelfId}:level:{level}`
- Utile per stampare e applicare fisicamente sullo scaffale

**`BatchQRPrintScreen`**  
Stampa QR per tutti gli scaffali e ripiani di un magazzino.
- Genera PDF stampabile con griglia di QR code

---

### Product

**`ProductListScreen`**  
Lista prodotti con filtri e ricerca.
- Filtri: magazzino, scaffale, testo libero (`?q=`)
- FAB "+" → `ProductFormScreen` (solo admin)
- Tap → `ProductDetailScreen`

**`ProductDetailScreen`**  
Scheda completa del prodotto.
- Galleria foto (swipe)
- Informazioni: barcode, posizione (magazzino/scaffale/livello/slot), condizione, quantità
- Azioni: modifica → `ProductFormScreen`, elimina

**`ProductFormScreen`**  
Form di creazione e modifica prodotto.

Campi:
- `barcode` — input manuale o da scanner (`ScanBarcodeScreen`)
- `name`, `description`, `brand`, `category`, `color`
- `warehouseId`, `shelfId`, `level`, `slot`
- `quantity`, `condition` (nuovo / usato / vuoto)
- `photos` (max 5, da fotocamera o galleria)

Funzionalità speciali:
- **Lookup catalogo:** al blur del campo barcode chiama `GET /api/products/catalog/:barcode` per autofill automatico
- **Vision AI:** bottone fotocamera chiama `POST /api/vision/identify`, i campi vengono precompilati con la risposta Gemini

**`ScanBarcodeScreen`**  
Scanner barcode tramite fotocamera (supporta EAN-13, QR, ecc.).
- Al riconoscimento ritorna il valore al form chiamante

---

### Admin

**`AdminPanelScreen`**  
Gestione utenti (visibile solo a `role: 'admin'`).
- Lista utenti con nome, email, ruolo
- Azioni: crea utente, elimina utente, reset password
- Nuovi utenti vengono creati con `mustChangePassword: true`

---

## Zustand Stores

### `authStore`

**File:** `mobile/src/store/authStore.ts`

```ts
State:
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  mustChangePassword: boolean
  pendingQrToken: string | null   // token da mostrare come QR dopo registrazione

Azioni:
  login(email, password)          // POST /auth/login → salva JWT in AsyncStorage
  loginWithQr(loginToken)         // POST /auth/qr-login
  logout()                        // POST /auth/logout → rimuove JWT da AsyncStorage
  restoreSession()                // AsyncStorage → /auth/me
  clearPendingQr()
  clearMustChangePassword()
```

### `warehouseStore`

**File:** `mobile/src/store/warehouseStore.ts`

```ts
State:
  selectedWarehouse: Warehouse | null
  shelves: Shelf[]

Azioni:
  setSelectedWarehouse(warehouse)
  setShelves(shelves)
```

### `serverStore`

**File:** `mobile/src/store/serverStore.ts`

```ts
Costanti:
  FIXED_API_URL = 'https://18.102.152.192.nip.io'  // URL produzione fisso
  STORAGE_KEY   = 'server_url'                       // AsyncStorage key

State:
  serverUrl: string | null
  isDiscovering: boolean
  progress: number                // percentuale discovery 0-100

Azioni:
  discover()                      // flusso completo (vedi Server Discovery)
  setManualUrl(url)               // normalizza, verifica, salva
  reset()                         // cancella AsyncStorage + ridiscovery
```

---

## Services

### `api.ts` — Axios instance

**File:** `mobile/src/services/api.ts`

- Base URL dinamica (impostata da `serverStore` via `setServerUrl()`)
- Timeout: 10 secondi
- **Request interceptor:** legge JWT da AsyncStorage, aggiunge `Authorization: Bearer <token>`
- **Response interceptor:** se 401, rimuove JWT da AsyncStorage (sessione scaduta/invalidata)

### `authService.ts`

```
login(email, password)          → POST /api/auth/login   + salva JWT
changePassword(old, new)        → POST /api/auth/change-password
getMe()                         → GET  /api/auth/me
logout()                        → rimuove JWT da AsyncStorage
getStoredToken()                → legge JWT da AsyncStorage
qrLogin(loginToken)             → POST /api/auth/qr-login + salva JWT
getQrToken()                    → GET  /api/auth/qr-token
regenerateQrToken()             → POST /api/auth/qr-token/regenerate
```

### `warehouseService.ts`

```
getAll()           → GET    /api/warehouses
getById(id)        → GET    /api/warehouses/:id
create(dto)        → POST   /api/warehouses
update(id, dto)    → PUT    /api/warehouses/:id
delete(id)         → DELETE /api/warehouses/:id
```

### `shelfService.ts`

```
getByWarehouse(wId)    → GET    /api/warehouses/:wId/shelves
getById(id)            → GET    /api/shelves/:id
create(wId, dto)       → POST   /api/warehouses/:wId/shelves
update(id, dto)        → PUT    /api/shelves/:id
delete(id)             → DELETE /api/shelves/:id
```

### `productService.ts`

```
getBrands()                    → GET    /api/products/brands
getCategories()                → GET    /api/products/categories
getAll(params)                 → GET    /api/products?warehouseId=&shelfId=&q=
getById(id)                    → GET    /api/products/:id
getByBarcode(barcode)          → GET    /api/products/barcode/:barcode
lookupCatalog(barcode)         → GET    /api/products/catalog/:barcode  (null se 404)
create(dto)                    → POST   /api/products
update(id, dto)                → PUT    /api/products/:id
delete(id)                     → DELETE /api/products/:id
uploadPhoto(productId, uri)    → POST   /api/products/:id/photos  (FormData multipart)
deletePhoto(productId, fname)  → DELETE /api/products/:id/photos/:filename
```

### `adminService.ts`

```
listUsers()                         → GET    /api/users
createUser(name, email, pass, role) → POST   /api/auth/register
deleteUser(id)                      → DELETE /api/users/:id
resetUserPassword(id, newPassword)  → POST   /api/users/:id/reset-password
```

### `updateService.ts`

```ts
interface VersionInfo {
  version: string
  minVersion: string
  downloadUrl: string
  updateAvailable: boolean  // version > currentAppVersion
  forceUpdate: boolean      // minVersion > currentAppVersion
}

checkForUpdate(apiUrl)     → GET /api/version?platform=android
compareVersions(a, b)      → -1 | 0 | 1  (confronto semver)
openDownloadUrl(url)       → Linking.openURL(url)
```

---

## Server Discovery

**File:** `mobile/src/services/serverDiscovery.ts`

L'app trova il server sulla rete locale senza configurazione manuale.

**Algoritmo:**

```
1. Ottieni IP del dispositivo (expo-network)
2. Estrai subnet (es. 192.168.1.x)
3. Ordina gli IP da provare per priorità:
   [1, 2, 254, 100, 200, 240, 10, 20, 50, ... restanti]
   (gli IP "tipici" dei router prima)
4. Scansiona in batch da 30 IP in parallelo
5. Per ogni IP: GET http://{IP}:3000/health (timeout 600ms)
   - Se risposta ha app_id === 'gestione-magazzino' → trovato!
6. Ritorna URL al primo match, chiama onProgress(0-100)
```

**Costanti:**

| Costante | Valore |
|---|---|
| `PORT` | 3000 |
| `APP_ID` | `'gestione-magazzino'` |
| `TIMEOUT_MS` | 600ms |
| `BATCH_SIZE` | 30 |

**Fallback:** se nessun IP risponde, l'utente vede una schermata con input manuale URL.

---

## Hooks

### `useUpdateChecker`

**File:** `mobile/src/hooks/useUpdateChecker.ts`

Polling periodico della versione app. Tipicamente montato in `App.tsx`.

### `useApiError`

**File:** `mobile/src/hooks/useApiError.ts`

Parsing standardizzato degli errori Axios: estrae messaggi di validazione dal corpo della risposta (campo `errors` o `message`).

---

## Tipi condivisi

**File:** `mobile/src/types/index.ts`

Tutte le interfacce TypeScript usate nell'app: `User`, `Warehouse`, `Shelf`, `Product`, `ProductCatalog`, DTO di creazione/aggiornamento, `ApiResponse<T>`, `AuthResponse`, `RootStackParamList`.
