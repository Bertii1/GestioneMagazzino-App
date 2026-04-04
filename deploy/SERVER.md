# Server Produzione

## Accesso

| | |
|---|---|
| **URL** | `https://YOUR_SERVER_URL` |
| **Health check** | `https://YOUR_SERVER_URL/health` |
| **EC2 Instance** | `YOUR_EC2_INSTANCE_ID` (t3.small, eu-south-1) |
| **IP (Elastic)** | `YOUR_ELASTIC_IP` |
| **Security Group** | `YOUR_SECURITY_GROUP_ID` (solo 80/443, no SSH) |
| **IAM Role** | `MagazzinoEC2Role` (SSM access) |

## Accesso al server (SSM - no SSH)

```bash
# Apri shell interattiva via Session Manager
aws ssm start-session --target YOUR_EC2_INSTANCE_ID --region eu-south-1

# Esegui comando singolo
aws ssm send-command \
  --instance-ids YOUR_EC2_INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["docker stats --no-stream"]' \
  --region eu-south-1 \
  --output text
```

> **Nota:** SSH non e' piu' disponibile. L'accesso avviene esclusivamente via AWS Systems Manager (SSM).
> Richiede AWS CLI e il plugin Session Manager: `brew install --cask session-manager-plugin` (macOS)
> oppure: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html

## Credenziali Admin (primo avvio)

- **Email:** `admin@magazzino.local`
- **Password:** `admin123` (da cambiare al primo login)

## Comandi utili

```bash
# Apri sessione SSM
aws ssm start-session --target YOUR_EC2_INSTANCE_ID --region eu-south-1

# Una volta dentro:
cd /opt/magazzino

# Stato container
docker compose ps

# Logs server
docker compose logs server --tail 50 -f

# Logs MongoDB
docker compose logs mongo --tail 50 -f

# Riavvio
docker compose restart

# Deploy aggiornamento
docker compose down && docker compose up -d --build

# Avvia whisper (solo quando serve transcription audio)
docker compose --profile whisper up -d
```

## Struttura servizi

| Servizio | Container | Porta interna | Note |
|---|---|---|---|
| Caddy (HTTPS) | magazzino_caddy | 80, 443 | Unico esposto pubblicamente |
| API Server | magazzino_server | 3000 | Solo rete Docker |
| MongoDB | magazzino_mongo | 27017 | Solo rete Docker |
| Whisper ASR | magazzino_whisper | 9000 | Profilo opzionale (`--profile whisper`) |

## Sicurezza

- **No SSH pubblica** — accesso solo via SSM (Session Manager)
- **IMDSv2 obbligatorio** — protezione da SSRF
- **EBS cifrato** — dati a riposo crittografati
- **Elastic IP** — IP fisso, non cambia al riavvio
- **Whisper opzionale** — non gira di default, risparmi CPU
