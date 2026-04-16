# Gestione Magazzino

App mobile-first per la gestione di prodotti in magazzino con mappa interattiva, scansione barcode, riconoscimento AI e aggiornamenti OTA.

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Mobile | React Native 0.81 + Expo 54 (TypeScript) |
| Backend | Express 4.19 + TypeScript |
| Database | MongoDB 7 + Mongoose 8.5 |
| Auth | JWT + bcrypt, QR code login |
| Infra | Docker Compose (Caddy, MongoDB, Whisper ASR) |
| CI/CD | GitHub Actions (OIDC → AWS SSM deploy, EAS Build) |
| AI | Google Gemini (riconoscimento prodotti) |
| Barcode | expo-camera |

---

## Avvio rapido

### Produzione (Docker)

```bash
docker compose up -d
# Server + MongoDB + Caddy HTTPS su porta 80/443
```

### Sviluppo

```bash
# Server
cd server && npm install && cp .env.example .env && npm run dev

# Mobile
cd mobile && npm install && npx expo start

# Whisper ASR (opzionale)
docker compose --profile whisper up -d
```

---

## Struttura progetto

```
gestione_magazzino/
├── server/src/
│   ├── models/          # User, Warehouse, Shelf, Product, ProductCatalog
│   ├── controllers/     # auth, warehouse, shelf, product, transcribe, vision
│   ├── routes/          # REST API endpoints
│   ├── middleware/      # JWT auth, error handler
│   └── config/          # env validation, DB, logger
├── mobile/src/
│   ├── screens/         # auth, warehouse, shelf, product
│   ├── services/        # API client, server discovery
│   ├── store/           # Zustand (auth, server, warehouse)
│   ├── hooks/           # useUpdateChecker (OTA + version check)
│   ├── navigation/      # React Navigation stack + tabs
│   └── types/           # TypeScript interfaces
├── deploy/
│   ├── SERVER.md        # Documentazione server produzione
│   ├── setup-github-oidc.sh  # Setup OIDC AWS per CI/CD
│   └── backup-mongo.sh       # Script backup MongoDB
├── .github/workflows/
│   ├── deploy.yml       # Auto-deploy server via SSM
│   └── build-mobile.yml # Build mobile via EAS
├── docker-compose.yml
├── Caddyfile
└── release.sh           # Build mobile locale (EAS)
```

## API

Tutte le rotte sono prefissate con `/api/`.

| Metodo | Rotta | Descrizione |
|--------|-------|-------------|
| POST | `/api/auth/login` | Login → token JWT |
| POST | `/api/auth/register` | Registrazione utente |
| GET | `/api/warehouses` | Lista magazzini |
| POST | `/api/warehouses` | Crea magazzino |
| PUT | `/api/warehouses/:id` | Modifica magazzino |
| GET | `/api/warehouses/:id/shelves` | Scaffali del magazzino |
| GET | `/api/products` | Prodotti (filtri: warehouseId, shelfId, q) |
| GET | `/api/products/barcode/:barcode` | Cerca per barcode |
| GET | `/api/products/brands` | Lista marche |
| GET | `/api/products/categories` | Lista categorie |
| GET | `/api/products/catalog/:barcode` | Lookup catalogo interno |
| POST | `/api/products` | Crea prodotto |
| POST | `/api/products/:id/photos` | Upload foto prodotto |
| POST | `/api/transcribe` | Trascrizione vocale (Whisper) |
| POST | `/api/vision/recognize` | Riconoscimento prodotto (Gemini AI) |
| GET | `/api/backup` | Backup database (bearer auth) |
| GET | `/health` | Health check + minAppVersion |

## Modello dati

```
Warehouse (griglia) → Shelf (posizione x,y, livelli) → Product (barcode, foto, brand, categoria, condizione)
                                                         ↕
                                                    ProductCatalog (lookup interno per barcode)
```

Un `Product` ha: `barcode`, `name`, `description`, `color`, `brand`, `category`, `condition` (nuovo/usato/vuoto), `photos[]`, `shelfId`, `level`, `slot`, `quantity`.

## Deployment

### Server (automatico)

Push su `main` con modifiche in `server/**`, `docker-compose.yml` o `Caddyfile` triggera deploy automatico:

```
GitHub Actions → OIDC → IAM Role → SSM send-command → git pull + docker compose build → health check
```

Deploy manuale: `gh workflow run deploy.yml`

### Mobile (automatico)

Push su `main` con modifiche in `mobile/**` triggera build Android APK su EAS:

```
GitHub Actions → EXPO_TOKEN → EAS Build → APK disponibile su expo.dev
```

Build manuale: `./release.sh --android|--ios|--all [--bump-patch]`

### Aggiornamenti OTA

L'app controlla aggiornamenti all'avvio:
1. **OTA** — bundle JS aggiornato via `expo-updates`, riavvio app
2. **Versione minima** — server espone `minAppVersion` in `/health`, alert bloccante se app troppo vecchia

Pubblicare OTA: `cd mobile && eas update --branch main`

## Variabili d'ambiente

| Variabile | Obbligatoria | Default | Descrizione |
|-----------|:---:|---------|-------------|
| `MONGODB_URI` | Si | — | Connection string MongoDB |
| `JWT_SECRET` | Si | — | Secret per firma JWT |
| `PORT` | | 3000 | Porta server |
| `GEMINI_API_KEY` | | — | API key Google Gemini |
| `BACKUP_API_KEY` | | — | Bearer token per endpoint backup |
| `MIN_APP_VERSION` | | 1.0.0 | Versione minima app mobile |
| `WHISPER_URL` | | http://whisper-asr:9000 | URL servizio Whisper |
| `CORS_ORIGIN` | | * | Origini CORS consentite |
| `ADMIN_EMAIL` | | admin@magazzino.local | Email admin iniziale |
| `ADMIN_PASSWORD` | | admin123 | Password admin iniziale |

## Servizi Docker

| Servizio | Container | Porta | Note |
|----------|-----------|-------|------|
| Caddy | magazzino_caddy | 80, 443 | Reverse proxy, auto HTTPS |
| Server | magazzino_server | 3000 (interna) | API Express |
| MongoDB | magazzino_mongo | 27017 (interna) | Volume `mongo_data` |
| Whisper | magazzino_whisper | 9000 (interna) | Profilo `whisper` |
