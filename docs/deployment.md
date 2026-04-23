# Deployment & Infrastruttura

---

## Avvio rapido

```bash
# Produzione (server + DB + HTTPS)
docker compose up -d

# Con monitoring (Prometheus + Loki + Grafana)
docker compose --profile monitoring up -d

# Con Whisper ASR (richiede GPU o molta pazienza)
docker compose --profile whisper up -d

# Sviluppo locale mobile (Expo Metro in Docker)
docker compose --profile dev up -d
```

---

## Docker Compose

**File:** `docker-compose.yml`

### Servizi sempre attivi

#### `caddy` — Reverse proxy HTTPS

```yaml
image: caddy:2-alpine
ports: ["80:80", "443:443"]
volumes:
  - ./Caddyfile:/etc/caddy/Caddyfile
  - caddy_data:/data      # certificati Let's Encrypt
  - caddy_config:/config
```

- Termina TLS con certificato Let's Encrypt automatico
- Proxya tutte le richieste a `server:3000`
- Blocca `/metrics` con risposta 403 (non esposto pubblicamente)
- Serve `/grafana*` al servizio Grafana (profilo monitoring)
- Compressione gzip + zstd abilitata
- Logging JSON strutturato

**Caddyfile** (riassunto):

```
{$DOMAIN:localhost} {
    handle /metrics { respond 403 }
    handle /grafana* { reverse_proxy grafana:3000 }
    handle { reverse_proxy server:3000 }
    encode gzip zstd
}
```

#### `mongo` — MongoDB 7

```yaml
image: mongo:7
volumes:
  - mongo_data:/data/db
  - ./mongo-init.js:/docker-entrypoint-initdb.d/init.js
```

- Porta 27017 esposta solo sulla rete interna Docker
- Init script crea l'utente e il database al primo avvio
- Health check: `mongosh --eval "db.adminCommand('ping')"`

#### `server` — API Express

```yaml
build:
  context: ./server
  target: production          # multi-stage Dockerfile
depends_on:
  mongo: { condition: service_healthy }
env_file: server/.env
volumes:
  - uploads_data:/app/uploads # foto prodotti persistenti
```

- Build multi-stage: `node:20-alpine` per build, immagine minimale per runtime
- Porta 3000 solo rete interna
- Si avvia solo dopo che MongoDB è healthy

---

### Profilo `monitoring`

```bash
docker compose --profile monitoring up -d
```

| Servizio | Descrizione |
|---|---|
| `prometheus` | Scrape `/metrics` ogni 15s, retention 30gg |
| `loki` | Aggregazione log |
| `promtail` | Raccoglie stdout Docker → Loki |
| `grafana` | Dashboard su `/grafana` |

---

### Profilo `whisper`

```bash
docker compose --profile whisper up -d
```

- `magazzino_whisper` — Faster-Whisper ASR su porta 9000 (interna)
- Limiti: 0.5 CPU, 512MB RAM
- Usato da `POST /api/transcribe` per trascrizione vocale

---

### Profilo `dev`

```bash
docker compose --profile dev up -d
```

- `magazzino_mobile` — Expo Metro Bundler su porta 8081, 19000-19002
- Mount volume della cartella `mobile/` per hot reload

---

### Volumi persistenti

| Volume | Contenuto |
|---|---|
| `mongo_data` | Dati MongoDB |
| `uploads_data` | Foto prodotti (`/app/uploads/`) |
| `caddy_data` | Certificati TLS Let's Encrypt |
| `caddy_config` | Config Caddy runtime |
| `prometheus_data` | Metriche Prometheus |
| `loki_data` | Log aggregati Loki |
| `grafana_data` | Dashboard Grafana |

---

## GitHub Actions

### Deploy server — `.github/workflows/deploy.yml`

**Trigger:** push a `main` che modifica `server/**`, `docker-compose.yml`, `Caddyfile`, o il workflow stesso.

**Flusso:**

```
1. Checkout codice
2. AWS OIDC auth
     → assume IAM role GitHubActions-Deploy-Magazzino
     → nessuna chiave statica AWS necessaria
3. SSM send-command su EC2 (nessun SSH):
     cd /home/ec2-user/GestioneMagazzino-App
     git fetch --all --prune
     git reset --hard origin/main
     docker compose up -d --build server
     docker image prune -f
4. Health check (6 tentativi, 10s di intervallo):
     GET $SERVER_URL/health
5. Report success o failure
```

**Concurrency:** `group: deploy-production` — un solo deploy alla volta.

**Secrets richiesti:**

| Secret | Descrizione |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | ARN del IAM role OIDC |
| `EC2_INSTANCE_ID` | ID istanza EC2 |
| `SERVER_URL` | URL base per health check |

**Trigger manuale:**

```bash
gh workflow run deploy.yml
```

---

### Build mobile — `.github/workflows/build-mobile.yml`

**Trigger:** push a `main` che modifica `mobile/**`, o `workflow_dispatch` con input.

**Input manuali:**

| Input | Opzioni | Default |
|---|---|---|
| `platform` | `android`, `ios`, `all` | `android` |
| `bump` | `patch`, `minor`, `major`, `none` | `patch` |

**Flusso:**

```
1. Checkout + setup Node 20
2. npm ci in mobile/
3. Installa EAS CLI
4. Login Expo con EXPO_TOKEN
5. [opzionale] Version bump in app.json (patch/minor/major)
6. TypeScript check (tsc --noEmit)
7. EAS Build:
     eas build --platform android --profile production --non-interactive
     eas build --platform ios --profile production --non-interactive
8. Notifica server della nuova versione:
     PUT $SERVER_URL/api/version
     { platform: "android", version: "x.y.z", downloadUrl: "..." }
9. Commit version bump su main
```

**Secrets richiesti:**

| Secret | Descrizione |
|---|---|
| `EXPO_TOKEN` | Token account Expo/EAS |
| `SERVER_URL` | URL API server |
| `BACKUP_API_KEY` | Bearer token per PUT /api/version |

---

## Ambiente di produzione (EC2)

- **Istanza:** t3.small, eu-south-1 (Milano)
- **OS:** Amazon Linux 2023
- **Accesso:** AWS SSM Session Manager (nessuna porta SSH esposta)
- **Sicurezza:** IMDSv2, EBS cifrato, Elastic IP, Security Group chiuso

**Accesso manuale:**

```bash
aws ssm start-session \
  --target YOUR_EC2_INSTANCE_ID \
  --region eu-south-1
```

**Comandi utili sul server:**

```bash
# Stato servizi
docker compose ps

# Log server
docker compose logs -f server

# Log Caddy
docker compose logs -f caddy

# Rebuild manuale
docker compose up -d --build server

# Backup manuale
./deploy/backup-mongo.sh
```

---

## Setup iniziale (one-time)

### 1. Setup IAM/OIDC per GitHub Actions

```bash
./deploy/setup-github-oidc.sh
```

Crea il provider OIDC e il ruolo IAM `GitHubActions-Deploy-Magazzino` con permessi SSM minimi.

### 2. EC2 user data (primo avvio)

```bash
./deploy/user-data.sh
```

Installa Docker, clona il repository, configura systemd per avvio automatico.

### 3. Variabili d'ambiente server

```bash
cp server/.env.example server/.env
# Modifica MONGODB_URI, JWT_SECRET, GEMINI_API_KEY, BACKUP_API_KEY
```

### 4. Primo avvio

```bash
docker compose up -d
# Verifica
curl https://DOMAIN/health
```

L'admin iniziale viene creato automaticamente con `ADMIN_EMAIL` / `ADMIN_PASSWORD` (default: `admin@magazzino.local` / `admin123`). Il flag `mustChangePassword: true` forza il cambio al primo accesso.

---

## Build mobile locale

```bash
# Android APK
./release.sh --android

# iOS
./release.sh --ios

# Entrambi + bump patch version
./release.sh --all --bump-patch
```

Richiede EAS CLI installato e login Expo:

```bash
npm install -g eas-cli
eas login
```

---

## Aggiornamenti OTA

Gli aggiornamenti OTA non richiedono un rebuild dell'app:

```bash
cd mobile

# Pubblica update su branch main (utenti ricevono al prossimo avvio)
eas update --branch main --message "Fix bug critico"

# Pubblica su branch specifico (per canary)
eas update --branch staging
```

L'app controlla aggiornamenti OTA ad ogni avvio tramite `expo-updates`. Se disponibile, scarica e riavvia automaticamente.
