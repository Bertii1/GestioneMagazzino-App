# Technology Stack

**Analysis Date:** 2026-04-03

## Languages

**Primary:**
- TypeScript 5.5.x - Both server (`server/src/**`) and mobile (`mobile/src/**`)

**Secondary:**
- JavaScript - Build configs (`mobile/babel.config.js`, `mobile/metro.config.js`), MongoDB init script (`mongo-init.js`)

## Runtime

**Environment:**
- Node.js (no `.nvmrc` present; target ES2020 per `server/tsconfig.json`)

**Package Manager:**
- npm - Root, server, and mobile all use npm
- Lockfile: `package-lock.json` present at root; individual `node_modules` in `mobile/` and `server/`

## Frameworks

**Backend (server):**
- Express 4.19.x - HTTP server framework (`server/src/app.ts`)
- Mongoose 8.5.x - MongoDB ODM, models in `server/src/models/`

**Mobile (mobile):**
- React Native 0.81.x - Cross-platform mobile UI
- Expo ~54.0.0 - React Native toolchain and SDK, entry via `node_modules/expo/AppEntry.js`
- React 19.1.x - UI component library

**Navigation (mobile):**
- React Navigation 6.x - `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`
  - Stack navigator: `mobile/src/navigation/AppNavigator.tsx`
  - Bottom tabs: two tabs (Magazzini, Prodotti)

**State Management (mobile):**
- Zustand 4.5.x - Three stores: `mobile/src/store/authStore.ts`, `mobile/src/store/serverStore.ts`, `mobile/src/store/warehouseStore.ts`

**Data Fetching (mobile):**
- TanStack Query 5.90.x (`@tanstack/react-query`) - Available as dependency but primary data fetching done via service layer with axios
- Axios 1.7.x - HTTP client wrapping the API, configured in `mobile/src/services/api.ts`

**Testing:**
- Not detected - no test framework configured in any `package.json`

**Build/Dev:**
- ts-node-dev 2.0.0 - Development server with live reload (`server/package.json` `dev` script)
- TypeScript compiler (`tsc`) - Production build to `server/dist/`
- Expo Metro Bundler - Mobile JS bundler, port 8081
- Babel 7.24.x + babel-preset-expo 55.x - Mobile transpilation (`mobile/babel.config.js`)

## Key Dependencies

**Backend Critical:**
- `express` 4.19.x - Core HTTP layer (`server/src/app.ts`)
- `mongoose` 8.5.x - All data persistence (`server/src/models/*.ts`)
- `jsonwebtoken` 9.0.x - JWT auth tokens (`server/src/middleware/auth.ts`)
- `bcryptjs` 2.4.x - Password hashing (`server/src/models/User.ts`)
- `express-validator` 7.1.x - Request validation in routes
- `multer` 1.4.x - Multipart file upload for audio (`server/src/controllers/transcribeController.ts`)
- `cors` 2.8.x - CORS middleware
- `dotenv` 16.4.x - Environment variable loading

**Mobile Critical:**
- `expo-camera` ~17.0.x - Barcode scanning via `CameraView` (`mobile/src/screens/product/ProductFormScreen.tsx`, `ScanBarcodeScreen.tsx`)
- `expo-av` ~15.0.x - Audio recording for voice input (`Audio.Recording`)
- `expo-print` ^55.0.x - PDF/HTML printing for QR codes (`mobile/src/screens/shelf/BatchQRPrintScreen.tsx`)
- `expo-sharing` ~13.0.x - Share printed documents
- `expo-network` ~8.0.x - LAN IP address detection for server discovery (`mobile/src/services/serverDiscovery.ts`)
- `expo-file-system` ~18.0.x - File system access
- `@react-native-async-storage/async-storage` ^2.2.x - JWT token and server URL persistence
- `react-native-qrcode-svg` ^6.3.x - QR code display in screens
- `qrcode` ^1.5.x - QR code SVG generation for batch printing (`mobile/src/screens/shelf/BatchQRPrintScreen.tsx`)
- `react-native-svg` ^15.12.x - SVG rendering (required by QR libraries)
- `react-native-reanimated` ~4.1.x - Animations
- `react-native-gesture-handler` ~2.28.x - Gesture system
- `@expo/vector-icons` ^15.1.x - Ionicons icon set used throughout UI

## Configuration

**Environment:**
- Server reads from `.env` file (loaded via `dotenv/config` import at `server/src/app.ts` line 1)
- Required variables documented in `.env.example`: `MONGO_USER`, `MONGO_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV`, `HOST_IP`
- `WHISPER_URL` defaults to `http://whisper-asr:9000` in `server/src/controllers/transcribeController.ts` (not in `.env.example`)
- `MONGODB_URI` is constructed by docker-compose from `MONGO_USER`/`MONGO_PASSWORD` vars

**Build:**
- Server: `server/tsconfig.json` — target ES2020, module commonjs, strict mode, output to `server/dist/`
- Mobile: `mobile/tsconfig.json` — extends `expo/tsconfig.base`, strict mode, path alias `@/*` → `src/*`
- Mobile metro config: `mobile/metro.config.js`

## Platform Requirements

**Development:**
- Docker + Docker Compose (all services containerized via `docker-compose.yml`)
- Node.js for local development without Docker
- Expo Go app or Android/iOS simulator for mobile

**Production:**
- Docker Compose orchestration: `mongo` (MongoDB 7), `server` (Node.js API), `whisper-asr` (Python Whisper ASR service)
- Mobile: Expo build pipeline (not yet configured — no `eas.json` detected)
- Server listens on port 3000; MongoDB on 27017; Whisper ASR on 9000
- Mobile Metro dev server on ports 8081, 19000–19002 (dev profile only)

---

*Stack analysis: 2026-04-03*
