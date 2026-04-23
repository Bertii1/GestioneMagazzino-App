# API Reference

Base path: `/api/` — tutte le risposte in JSON.

**Autenticazione:** header `Authorization: Bearer <token>` (JWT).  
**Admin:** richiede `role === 'admin'` oltre al token.  
**Bearer key:** alcune rotte usano `Authorization: Bearer <BACKUP_API_KEY>` (token statico).

---

## Autenticazione (`/api/auth`)

### `POST /api/auth/login`

Autenticazione email e password.

**Body:**
```json
{ "email": "user@example.com", "password": "secret" }
```

**Risposta 200:**
```json
{
  "token": "<jwt>",
  "user": { "_id": "...", "name": "Mario", "email": "...", "role": "operator" },
  "mustChangePassword": false
}
```

**Errori:** `400` validazione, `401` credenziali errate.

---

### `POST /api/auth/register`

Crea un nuovo utente. **Richiede:** JWT + ruolo admin.

**Body:**
```json
{
  "name": "Mario Rossi",
  "email": "mario@example.com",
  "password": "almeno6char",
  "role": "operator"
}
```

**Risposta 201:**
```json
{ "user": { "_id": "...", "name": "Mario Rossi", "email": "...", "role": "operator" } }
```

Il nuovo utente ha `mustChangePassword: true` e riceve un `loginToken` per il QR.

---

### `POST /api/auth/change-password`

Cambio password. **Richiede:** JWT. Invalida tutte le sessioni precedenti.

**Body:**
```json
{ "currentPassword": "vecchia", "newPassword": "nuova6char" }
```

**Risposta 200:**
```json
{ "message": "Password aggiornata", "token": "<nuovo-jwt>" }
```

---

### `POST /api/auth/logout`

Invalida il token corrente (incrementa `tokenVersion`). **Richiede:** JWT.

**Risposta 200:**
```json
{ "message": "Logout effettuato" }
```

---

### `GET /api/auth/me`

Restituisce il profilo dell'utente autenticato. **Richiede:** JWT.

**Risposta 200:**
```json
{
  "_id": "...",
  "name": "Mario",
  "email": "mario@example.com",
  "role": "operator",
  "mustChangePassword": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### `POST /api/auth/qr-login`

Login tramite token QR (scan del QR personale di un utente).

**Body:**
```json
{ "token": "<loginToken>" }
```

**Risposta 200:** uguale a `/login`.

---

### `GET /api/auth/qr-token`

Restituisce il `loginToken` dell'utente corrente per generare il QR. **Richiede:** JWT.

**Risposta 200:**
```json
{ "loginToken": "<hex-string>" }
```

---

### `POST /api/auth/qr-token/regenerate`

Rigenera il `loginToken` (invalida il QR precedente). **Richiede:** JWT.

**Risposta 200:**
```json
{ "loginToken": "<nuovo-hex-string>" }
```

---

## Magazzini (`/api/warehouses`)

Tutte le rotte richiedono **JWT**.

### `GET /api/warehouses`

Lista tutti i magazzini, ordinati per data creazione DESC.

**Risposta 200:**
```json
[
  {
    "_id": "...",
    "name": "Magazzino A",
    "description": "Piano terra",
    "gridWidth": 10,
    "gridHeight": 8,
    "createdAt": "..."
  }
]
```

---

### `GET /api/warehouses/:id`

Singolo magazzino.

**Risposta 200:** oggetto Warehouse. `404` se non trovato.

---

### `POST /api/warehouses`

Crea magazzino. **Richiede:** admin.

**Body:**
```json
{
  "name": "Magazzino B",
  "gridWidth": 12,
  "gridHeight": 8,
  "description": "Secondo piano"
}
```

**Risposta 201:** oggetto Warehouse creato.

---

### `PUT /api/warehouses/:id`

Aggiorna magazzino. **Richiede:** admin. Stessi campi del POST.

**Risposta 200:** oggetto Warehouse aggiornato.

---

### `DELETE /api/warehouses/:id`

Elimina magazzino. **Richiede:** admin.

**Risposta 200:**
```json
{ "message": "Magazzino eliminato" }
```

---

## Scaffali (`/api/warehouses/:warehouseId/shelves` e `/api/shelves`)

Tutte le rotte richiedono **JWT**.

### `GET /api/warehouses/:warehouseId/shelves`

Lista scaffali di un magazzino, ordinati per codice ASC.

**Risposta 200:**
```json
[
  {
    "_id": "...",
    "warehouseId": "...",
    "code": "A1",
    "name": "Corsia A Scaffale 1",
    "x": 0,
    "y": 0,
    "levels": 4,
    "capacity": 100
  }
]
```

---

### `POST /api/warehouses/:warehouseId/shelves`

Crea scaffale.

**Body:**
```json
{
  "code": "B3",
  "x": 2,
  "y": 1,
  "levels": 3,
  "name": "Scaffale B3",
  "capacity": 50
}
```

**Risposta 201:** oggetto Shelf creato. `409` se `code` già esiste nel magazzino.

---

### `GET /api/shelves/:id`

Singolo scaffale con populate `warehouseId.name`.

---

### `PUT /api/shelves/:id`

Aggiorna scaffale. Stessi campi del POST.

---

### `DELETE /api/shelves/:id`

Elimina scaffale.

---

## Prodotti (`/api/products`)

Tutte le rotte richiedono **JWT**.

### `GET /api/products`

Lista prodotti con filtri opzionali.

**Query params:**

| Param | Tipo | Descrizione |
|---|---|---|
| `warehouseId` | string | Filtra per magazzino |
| `shelfId` | string | Filtra per scaffale |
| `q` | string | Ricerca full-text (name + description) |

**Risposta 200:** array Product con populate `shelfId` e `warehouseId`.

---

### `GET /api/products/:id`

Singolo prodotto con populate `shelfId` (levels) e `warehouseId` (gridWidth, gridHeight).

---

### `GET /api/products/barcode/:barcode`

Cerca prodotto per barcode esatto.

**Risposta 200:** oggetto Product. `404` se non trovato.

---

### `GET /api/products/catalog/:barcode`

Lookup nel catalogo interno (`ProductCatalog`). Utile per autofill offline.

**Risposta 200:**
```json
{
  "barcode": "8001600300800",
  "name": "Prodotto Esempio",
  "brand": "Marca X",
  "category": "Categoria Y",
  "color": "Rosso"
}
```

`404` se il barcode non è mai stato censito.

---

### `GET /api/products/brands`

Lista brand distinti (ordinati alfabeticamente).

**Risposta 200:** `["Marca A", "Marca B", ...]`

---

### `GET /api/products/categories`

Lista categorie distinte (ordinate alfabeticamente).

**Risposta 200:** `["Cat A", "Cat B", ...]`

---

### `POST /api/products`

Crea prodotto. **Richiede:** admin.

**Body:**
```json
{
  "barcode": "8001600300800",
  "name": "Prodotto Esempio",
  "warehouseId": "<id>",
  "shelfId": "<id>",
  "level": 2,
  "slot": "L3",
  "quantity": 10,
  "condition": "nuovo",
  "brand": "Marca X",
  "category": "Categoria Y",
  "color": "Rosso",
  "description": "Descrizione opzionale"
}
```

**Risposta 201:** oggetto Product creato.  
Effetto collaterale: upsert `ProductCatalog` (salva barcode → nome/brand/categoria per lookup futuro).

---

### `PUT /api/products/:id`

Aggiorna prodotto. Accetta subset dei campi del POST.

**Risposta 200:** oggetto Product aggiornato + upsert catalogo.

---

### `DELETE /api/products/:id`

Elimina prodotto e tutte le sue foto dal disco.

---

### `POST /api/products/:id/photos`

Aggiungi foto al prodotto (max 5).

**Content-Type:** `multipart/form-data`  
**Campo:** `photo` (file immagine, max 5MB)

**Risposta 201:**
```json
{ "filename": "abc123.jpg", "photos": ["abc123.jpg", "def456.jpg"] }
```

**Errori:** `400` se già 5 foto, `415` se non è un'immagine, `413` se > 5MB.

---

### `DELETE /api/products/:id/photos/:filename`

Rimuove una foto del prodotto dal disco e dal documento.

**Risposta 200:**
```json
{ "photos": ["foto-rimasta.jpg"] }
```

---

## Visione AI (`/api/vision`)

### `POST /api/vision/identify`

Identifica un prodotto da una foto tramite Google Gemini. **Richiede:** JWT + `GEMINI_API_KEY`.

**Content-Type:** `multipart/form-data`  
**Campo:** `image` (file immagine, max 10MB)

**Risposta 200:**
```json
{
  "name": "Nome prodotto",
  "brand": "Marca",
  "model": "Modello",
  "color": "Colore",
  "description": "Descrizione breve",
  "category": "Categoria",
  "barcode": null
}
```

**Errori:** `404` prodotto non riconosciuto, `429` rate limit Gemini, `503` API key mancante.

---

## Versioni app (`/api/version`)

### `GET /api/version`

Restituisce la versione corrente dell'app mobile. **Senza autenticazione.**

**Query params:** `platform` — `android` (default) | `ios`

**Risposta 200:**
```json
{
  "version": "1.3.0",
  "buildNumber": 42,
  "minVersion": "1.2.0",
  "downloadUrl": "https://expo.dev/..."
}
```

---

### `PUT /api/version`

Aggiorna i metadati di versione. **Richiede:** `Authorization: Bearer <BACKUP_API_KEY>`.

**Body:**
```json
{
  "platform": "android",
  "version": "1.4.0",
  "buildNumber": 43,
  "downloadUrl": "https://expo.dev/...",
  "minVersion": "1.2.0"
}
```

**Risposta 200:**
```json
{ "success": true, "data": { ... } }
```

**Validazioni:** URL deve essere HTTPS e host in allowlist (`expo.dev`, `objects.githubusercontent.com`, `github.com`). Versione in formato `x.y.z`.

---

## Utenti (`/api/users`)

Tutte le rotte richiedono **JWT + admin**.

### `GET /api/users`

Lista utenti ordinati per data creazione DESC.

**Risposta 200:**
```json
{
  "users": [
    { "_id": "...", "name": "Mario", "email": "...", "role": "admin", "createdAt": "..." }
  ]
}
```

---

### `DELETE /api/users/:id`

Elimina utente. Non permette l'auto-eliminazione.

**Risposta 200:**
```json
{ "message": "Utente eliminato" }
```

---

### `POST /api/users/:id/reset-password`

Reimposta la password di un utente e forza il cambio al prossimo accesso.

**Body:**
```json
{ "newPassword": "temporanea123" }
```

**Risposta 200:**
```json
{ "message": "Password reimpostata" }
```

---

## Backup (`/api/backup`)

### `GET /api/backup/dump`

Esegue `mongodump --gzip --archive` e streamma il risultato. **Richiede:** `Authorization: Bearer <BACKUP_API_KEY>`.

**Risposta 200:**
- `Content-Type: application/gzip`
- `Content-Disposition: attachment; filename="backup-YYYY-MM-DD.gz"`
- Body: stream binario gzip del dump MongoDB

---

## Health check

### `GET /health`

Senza autenticazione. Usato dal deploy CI e dal server discovery mobile.

**Risposta 200:**
```json
{
  "status": "ok",
  "minAppVersion": "1.2.0"
}
```

---

## Codici di errore comuni

| Status | Causa |
|---|---|
| `400` | Validazione fallita (express-validator) |
| `401` | Token mancante, scaduto o invalidato (logout) |
| `403` | Ruolo insufficiente (richiede admin) |
| `404` | Risorsa non trovata |
| `409` | Conflitto (es. barcode o codice scaffale duplicato) |
| `413` | File troppo grande |
| `415` | Tipo file non supportato |
| `429` | Rate limit superato |
| `500` | Errore interno (dettagli nascosti in prod) |
