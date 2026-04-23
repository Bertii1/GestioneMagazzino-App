# Modello dati

Tutti i modelli sono definiti in `server/src/models/` con Mongoose 8.5 e MongoDB 7.

## Relazioni tra entità

```
User
  └── loginToken (QR personale)

Warehouse (griglia N×M)
  └── Shelf (posizione x, y nella griglia)
        └── Product (barcode, foto, condizione, slot)
                ↕
          ProductCatalog (lookup offline per barcode noti)

AppVersion (metadati versione APK per piattaforma)
```

---

## User

**File:** `server/src/models/User.ts`

| Campo | Tipo | Obbligatorio | Default | Note |
|---|---|:---:|---|---|
| `name` | String | ✅ | — | trimmed |
| `email` | String | ✅ | — | unique, lowercase, trimmed |
| `password` | String | ✅ | — | hash bcrypt, minlength 6, nascosto in toJSON |
| `role` | `'admin' \| 'operator'` | | `'operator'` | |
| `mustChangePassword` | Boolean | | `true` | forzato al primo accesso e dopo reset |
| `loginToken` | String | | hex 32 bytes | unique, usato per QR code login |
| `tokenVersion` | Number | | `0` | incrementato al logout per invalidare JWT |
| `createdAt` | Date | | auto | timestamps Mongoose |
| `updatedAt` | Date | | auto | timestamps Mongoose |

**Metodi istanza:**

```ts
user.comparePassword(candidate: string): Promise<boolean>
// bcrypt.compare(candidate, this.password)
```

**Hook pre-save:** hash automatico della password se modificata.

**toJSON transform:** rimuove il campo `password` dalla serializzazione.

**Indici:**
- `email` — unique
- `loginToken` — unique

---

## Warehouse

**File:** `server/src/models/Warehouse.ts`

| Campo | Tipo | Obbligatorio | Default | Note |
|---|---|:---:|---|---|
| `name` | String | ✅ | — | trimmed |
| `description` | String | | — | trimmed, opzionale |
| `gridWidth` | Number | ✅ | `10` | colonne griglia, min 1 |
| `gridHeight` | Number | ✅ | `10` | righe griglia, min 1 |
| `createdAt` | Date | | auto | |
| `updatedAt` | Date | | auto | |

La griglia `gridWidth × gridHeight` è il canvas su cui vengono posizionati gli scaffali. Ogni scaffale occupa una cella (x, y).

---

## Shelf

**File:** `server/src/models/Shelf.ts`

| Campo | Tipo | Obbligatorio | Default | Note |
|---|---|:---:|---|---|
| `warehouseId` | ObjectId | ✅ | — | ref: Warehouse |
| `code` | String | ✅ | — | uppercase, trimmed, es. "A1" |
| `name` | String | | — | trimmed, opzionale |
| `x` | Number | ✅ | — | colonna nella griglia, min 0 |
| `y` | Number | ✅ | — | riga nella griglia, min 0 |
| `levels` | Number | ✅ | `3` | numero ripiani, min 1 |
| `capacity` | Number | | — | capacità totale opzionale, min 1 |
| `createdAt` | Date | | auto | |
| `updatedAt` | Date | | auto | |

**Indici:**
- `{ warehouseId: 1, code: 1 }` — unique (codice univoco per magazzino)

---

## Product

**File:** `server/src/models/Product.ts`

| Campo | Tipo | Obbligatorio | Default | Note |
|---|---|:---:|---|---|
| `barcode` | String | ✅ | — | unique, trimmed |
| `name` | String | ✅ | — | trimmed |
| `description` | String | | — | trimmed |
| `color` | String | | — | trimmed |
| `brand` | String | | — | trimmed |
| `category` | String | | — | trimmed |
| `condition` | `'nuovo' \| 'usato' \| 'vuoto'` | | `'nuovo'` | |
| `photos` | String[] | | `[]` | array di filename in `/uploads/products/` |
| `details` | Map<string, unknown> | | — | campi custom freeform |
| `warehouseId` | ObjectId | ✅ | — | ref: Warehouse |
| `shelfId` | ObjectId | ✅ | — | ref: Shelf |
| `level` | Number | ✅ | — | ripiano 1-based, min 1 |
| `slot` | String | | — | posizione sul ripiano, es. "L1", "L2" |
| `quantity` | Number | ✅ | `0` | min 0 |
| `createdAt` | Date | | auto | |
| `updatedAt` | Date | | auto | |

**Indici:**
- `{ warehouseId: 1 }`
- `{ shelfId: 1, level: 1 }`
- `{ name: 'text', description: 'text' }` — full-text search (usato da `?q=`)

**Foto:** I file vengono salvati su disco in `/uploads/products/` con nome `{productId}-{randomBytes}.{ext}`. Vengono eliminati da disco quando il prodotto è cancellato o la foto rimossa.

---

## ProductCatalog

**File:** `server/src/models/ProductCatalog.ts`

| Campo | Tipo | Obbligatorio | Default | Note |
|---|---|:---:|---|---|
| `barcode` | String | ✅ | — | unique, trimmed |
| `name` | String | ✅ | — | trimmed |
| `description` | String | | — | trimmed |
| `color` | String | | — | trimmed |
| `brand` | String | | — | trimmed |
| `category` | String | | — | trimmed |
| `createdAt` | Date | | auto | |
| `updatedAt` | Date | | auto | |

**Scopo:** catalogo offline dei barcode già visti. Ogni volta che un prodotto viene creato o aggiornato, il server esegue un upsert nel catalogo (eccetto barcode che iniziano con `INT-`, considerati interni). L'app mobile usa `GET /api/products/catalog/:barcode` per autofill rapido senza doverlo cercare su database esterno.

---

## AppVersion

**File:** `server/src/models/AppVersion.ts`

| Campo | Tipo | Obbligatorio | Default | Note |
|---|---|:---:|---|---|
| `platform` | String | ✅ | — | unique, es. `'android'` o `'ios'` |
| `version` | String | ✅ | — | formato semver `x.y.z` |
| `buildNumber` | Number | | `1` | numero build incrementale |
| `downloadUrl` | String | ✅ | — | URL HTTPS APK/IPA |
| `minVersion` | String | ✅ | — | versione minima supportata |
| `createdAt` | Date | | auto | |
| `updatedAt` | Date | | auto | |

**Logica aggiornamento mobile:**
- `version > currentAppVersion` → aggiornamento disponibile (facoltativo)
- `minVersion > currentAppVersion` → aggiornamento forzato (blocca l'app)

---

## Convenzioni Mongoose

- Tutti i modelli usano `{ timestamps: true }` (campi `createdAt` / `updatedAt` automatici).
- I campi String usano `trim: true` per default.
- Le risposte API omettono automaticamente `__v` (versione documento Mongoose).
- Le password non vengono mai serializzate (toJSON transform su User).
