# Gestione Magazzino

App client-server per la gestione di prodotti in magazzino con mappa interattiva.

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Mobile | React Native + Expo (TypeScript) |
| Backend | Node.js + Express (TypeScript) |
| Database | MongoDB + Mongoose |
| Auth | JWT |
| Mappa | react-native-svg |
| Barcode | expo-camera |

---

## Avvio rapido

### 1. Server

```bash
cd server
npm install

# Copia e configura le variabili d'ambiente
cp .env.example .env
# Modifica .env con la tua MONGODB_URI e JWT_SECRET

npm run dev
# Server disponibile su http://localhost:3000
```

### 2. Mobile

```bash
cd mobile
npm install
npx expo start
```

Apri l'app con **Expo Go** sul telefono (stesso WiFi del server).

> Aggiorna `BASE_URL` in `src/services/api.ts` con l'IP locale del tuo server.

---

## Struttura progetto

```
gestione_magazzino/
├── server/                  # Backend Express + MongoDB
│   └── src/
│       ├── models/          # User, Warehouse, Shelf, Product
│       ├── routes/          # auth, warehouses, shelves, products
│       ├── controllers/     # logica CRUD
│       └── middleware/      # JWT auth, error handler
└── mobile/                  # App React Native + Expo
    └── src/
        ├── screens/         # Login, Mappa, Prodotti, Scaffali...
        ├── components/      # WarehouseMap (SVG), ProductCard...
        ├── services/        # API client (Axios)
        ├── store/           # Zustand (auth, warehouse)
        ├── navigation/      # React Navigation
        └── types/           # Tipi TypeScript condivisi
```

## API principali

```
POST /api/auth/login                          → token JWT
GET  /api/warehouses                          → lista magazzini
GET  /api/warehouses/:id/shelves              → scaffali del magazzino
GET  /api/products?warehouseId=&shelfId=&q=  → prodotti con filtri
GET  /api/products/barcode/:barcode           → cerca per barcode
POST /api/products                            → crea prodotto
```

## Modello dati

```
Warehouse → Shelf → Product
              ↑
         warehouseId, x, y, levels
```

Un `Product` ha: `barcode` (univoco), `name`, `details`, `shelfId`, `level` (ripiano), `slot`.
