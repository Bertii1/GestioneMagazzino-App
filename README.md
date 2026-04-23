<div align="center">

# Gestione Magazzino HCS

**App mobile-first per gestire prodotti in magazzino**

Mappa interattiva &nbsp;·&nbsp; Scansione barcode &nbsp;·&nbsp; Riconoscimento AI &nbsp;·&nbsp; Aggiornamenti OTA

<br>

[![Deploy](https://github.com/Bertii1/GestioneMagazzino-App/actions/workflows/deploy.yml/badge.svg)](https://github.com/Bertii1/GestioneMagazzino-App/actions/workflows/deploy.yml)
[![Build Mobile](https://github.com/Bertii1/GestioneMagazzino-App/actions/workflows/build-mobile.yml/badge.svg)](https://github.com/Bertii1/GestioneMagazzino-App/actions/workflows/build-mobile.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.81-61dafb?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47a248?logo=mongodb&logoColor=white)
![Licenza](https://img.shields.io/badge/Licenza-MIT-f0db4f)

</div>

---

## Indice

- [Screenshot & Demo](#screenshot--demo)
- [Perché questo progetto](#perché-questo-progetto)
- [Stack](#stack)
- [Avvio rapido](#avvio-rapido)
- [Architettura](#architettura)
- [API Reference](#api-reference)
- [Aggiornamenti OTA](#aggiornamenti-ota)
- [Deployment](#deployment)
- [Variabili d'ambiente](#variabili-dambiente)
- [Servizi Docker](#servizi-docker)
- [Contribuire](#contribuire)
- [Licenza](#licenza)

---

## Screenshot & Demo

<div align="center">

<!-- Demo GIF — sostituisci con il path reale una volta pronta -->
<!-- Dimensione consigliata: max 600px larghezza, registra con Expo Go o simulatore -->

![Demo](docs/screenshots/demo.gif)

</div>

<br>

<div align="center">

| Login & QR Code | Mappa Magazzino | Dettaglio Scaffale | Scheda Prodotto |
|:---:|:---:|:---:|:---:|
| ![Login](docs/screenshots/login.png) | ![Mappa](docs/screenshots/warehouse.png) | ![Scaffale](docs/screenshots/shelf.png) | ![Prodotto](docs/screenshots/product.png) |

</div>

> **Come aggiungere le immagini:** crea la cartella `docs/screenshots/`, salva i file con i nomi indicati sopra e rimuovi questo blocco. Dimensione consigliata per gli screenshot: **390 × 844 px** (portrait, iPhone 14 Pro / Pixel 7).

---

## Perché questo progetto

Gestire un magazzino con fogli Excel o interfacce web lente è frustrante. Questo progetto risolve il problema con un'app mobile che funziona sulla rete locale — niente cloud obbligatorio — scopre automaticamente il server in LAN e permette di trovare un prodotto scansionando il barcode in meno di 3 secondi.

| Funzionalità | Dettaglio |
|---|---|
| **Mappa interattiva** | Ogni scaffale ha una posizione in griglia (x, y, livello, slot) |
| **Scansione barcode** | Ricerca istantanea tramite fotocamera |
| **Riconoscimento AI** | Google Gemini identifica il prodotto da una foto |
| **Trascrizione vocale** | Whisper ASR per inserire prodotti a mani libere |
| **QR code login** | Accesso rapido senza digitare credenziali |
| **Aggiornamenti OTA** | Nuove versioni senza passare dagli store |
| **Self-hosted** | Un `docker compose up` e sei operativo |

---

## Stack

| Layer | Tecnologia |
|---|---|
| Mobile | React Native 0.81 + Expo 55 (TypeScript) |
| Backend | Express 4.19 + TypeScript |
| Database | MongoDB 7 + Mongoose 8.5 |
| Auth | JWT + bcrypt + QR code login |
| Infra | Docker Compose — Caddy, MongoDB, Whisper ASR |
| CI/CD | GitHub Actions — OIDC → AWS SSM deploy, EAS Build |
| AI | Google Gemini (riconoscimento prodotti) |
| Logging | Pino |

---

## Avvio rapido

### Produzione (Docker Compose)

```bash
git clone https://github.com/Bertii1/GestioneMagazzino-App.git
cd GestioneMagazzino-App

cp server/.env.example server/.env
# Modifica MONGODB_URI e JWT_SECRET

docker compose up -d
# Server + MongoDB + Caddy HTTPS su porta 80/443
```

### Sviluppo locale

```bash
# Backend
cd server && npm install && cp .env.example .env
npm run dev          # http://localhost:3000

# Mobile (in un altro terminale)
cd mobile && npm install
npx expo start       # QR code per Expo Go

# Whisper ASR (opzionale, richiede GPU o pazienza)
docker compose --profile whisper up -d
```

---

## Architettura

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
│   ├── services/        # API client, server discovery LAN
│   ├── store/           # Zustand (auth, server, warehouse)
│   ├── hooks/           # useUpdateChecker (OTA + version check)
│   ├── navigation/      # React Navigation stack + tabs
│   └── types/           # TypeScript interfaces condivise
├── deploy/
│   ├── SERVER.md              # Documentazione server produzione
│   ├── setup-github-oidc.sh  # Setup OIDC AWS (one-time)
│   └── backup-mongo.sh        # Backup MongoDB
├── .github/workflows/
│   ├── deploy.yml       # Auto-deploy server via SSM
│   └── build-mobile.yml # Build APK via EAS
├── docker-compose.yml
├── Caddyfile
└── release.sh           # Build locale (EAS)
```

**Pattern server:** `Routes → Controllers → Models`

**Pattern mobile:** `Screens → Stores (Zustand) → Services → api.ts (Axios)`

### Modello dati

```
Warehouse (griglia N×M)
  └── Shelf (posizione x, y — N livelli)
        └── Product (barcode, foto, brand, categoria, condizione, slot)
                ↕
          ProductCatalog (lookup interno per barcode)
```

---

## API Reference

Tutte le rotte sono prefissate con `/api/`.

| Metodo | Rotta | Descrizione |
|:---:|---|---|
| `POST` | `/api/auth/login` | Login → token JWT |
| `POST` | `/api/auth/register` | Registrazione utente |
| `GET` | `/api/warehouses` | Lista magazzini |
| `POST` | `/api/warehouses` | Crea magazzino |
| `PUT` | `/api/warehouses/:id` | Modifica magazzino |
| `GET` | `/api/warehouses/:id/shelves` | Scaffali del magazzino |
| `GET` | `/api/products` | Prodotti (filtri: warehouseId, shelfId, q) |
| `GET` | `/api/products/barcode/:barcode` | Cerca per barcode |
| `GET` | `/api/products/brands` | Lista marche |
| `GET` | `/api/products/categories` | Lista categorie |
| `GET` | `/api/products/catalog/:barcode` | Lookup catalogo interno |
| `POST` | `/api/products` | Crea prodotto |
| `POST` | `/api/products/:id/photos` | Upload foto |
| `POST` | `/api/transcribe` | Trascrizione vocale (Whisper) |
| `POST` | `/api/vision/recognize` | Riconoscimento AI (Gemini) |
| `GET` | `/api/backup` | Backup database (bearer auth) |
| `GET` | `/health` | Health check + `minAppVersion` |

---

## Aggiornamenti OTA

L'app controlla aggiornamenti ad ogni avvio:

1. **OTA** — bundle JS aggiornato via `expo-updates`, riavvio automatico
2. **Versione minima** — `/health` espone `minAppVersion`; se l'app è troppo vecchia appare un alert bloccante

```bash
# Pubblicare un aggiornamento OTA
cd mobile && eas update --branch main

# Build APK completo
./release.sh --android --bump-patch
```

---

## Deployment

### Server (automatico)

Push su `main` con modifiche in `server/**`, `docker-compose.yml` o `Caddyfile`:

```
GitHub Actions → OIDC → IAM Role → SSM send-command → git pull → docker compose build → health check
```

```bash
# Trigger manuale
gh workflow run deploy.yml
```

### Mobile (automatico)

Push su `main` con modifiche in `mobile/**`:

```
GitHub Actions → EXPO_TOKEN → EAS Build → APK su expo.dev
```

---

## Variabili d'ambiente

| Variabile | Obbligatoria | Default | Descrizione |
|---|:---:|---|---|
| `MONGODB_URI` | ✅ | — | Connection string MongoDB |
| `JWT_SECRET` | ✅ | — | Secret per firma JWT |
| `PORT` | | `3000` | Porta server |
| `GEMINI_API_KEY` | | — | API key Google Gemini |
| `BACKUP_API_KEY` | | — | Bearer token endpoint backup |
| `MIN_APP_VERSION` | | `1.0.0` | Versione minima app mobile |
| `WHISPER_URL` | | `http://whisper-asr:9000` | URL servizio Whisper |
| `CORS_ORIGIN` | | `*` | Origini CORS consentite |
| `ADMIN_EMAIL` | | `admin@magazzino.local` | Email admin iniziale |
| `ADMIN_PASSWORD` | | `admin123` | Password admin iniziale |

---

## Servizi Docker

| Servizio | Container | Porta | Note |
|---|---|---|---|
| Caddy | `magazzino_caddy` | 80, 443 | Reverse proxy, auto HTTPS |
| Server | `magazzino_server` | 3000 (interna) | API Express |
| MongoDB | `magazzino_mongo` | 27017 (interna) | Volume `mongo_data` |
| Whisper | `magazzino_whisper` | 9000 (interna) | Profilo `whisper` |

---

## Contribuire

Il progetto è piccolo e ben delimitato — un buon posto per contribuire senza perdersi in una codebase enorme.

**Come iniziare:**

1. Fai un fork e clona il repo
2. Crea un branch: `git checkout -b feat/nome-feature`
3. Segui la struttura esistente (MVC server, Screens/Stores mobile)
4. Apri una PR con una descrizione chiara di cosa fa e perché

**Aree dove serve aiuto:**

- **Test** — nessun framework di test è ancora configurato (grande opportunità)
- **iOS support** — la build è impostata per Android, l'iOS path è aperta
- **Web frontend** — oggi esiste solo l'app mobile
- **Performance** — nessun profiling fatto sulla discovery LAN
- **Documentazione API** — una spec OpenAPI sarebbe utile

Non serve chiedere permesso per aprire una issue o una PR — ogni contributo è benvenuto.

---

## Licenza

Distribuito sotto licenza [MIT](LICENSE).
