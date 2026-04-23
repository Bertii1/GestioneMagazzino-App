# Autenticazione e autorizzazione

---

## Panoramica

Il sistema usa **JWT (HS256)** per autenticare le richieste API. Il token viene generato al login e deve essere incluso in ogni richiesta protetta nell'header:

```
Authorization: Bearer <token>
```

Sul mobile, il token è salvato in **AsyncStorage** e aggiunto automaticamente da un interceptor Axios.

---

## Login email / password

```
[App] LoginScreen
  ↓  POST /api/auth/login  { email, password }

[Server] authController.login
  ↓  Trova user per email
  ↓  bcrypt.compare(password, user.password)
  ↓  Se ok: genera JWT { sub: userId, tokenVersion }
  ↓  Risposta: { token, user, mustChangePassword }

[App] salva token in AsyncStorage
  ↓  Se mustChangePassword → ChangePasswordScreen
  ↓  Altrimenti → MainTabs
```

Il JWT include:
- `sub` — `_id` dell'utente (string)
- `tokenVersion` — snapshot della versione corrente del token
- `iat`, `exp` — emissione e scadenza (default 7 giorni)

---

## Login QR code

Ogni utente ha un `loginToken` (32 byte hex, univoco) usato come credenziale alternativa.

```
[Admin / User] MyQRCodeScreen
  ↓  GET /api/auth/qr-token
  ↓  Genera QR che codifica: magazzino://login/{loginToken}

[Altro dispositivo] LoginScreen → bottone "Scansiona QR"
  ↓  Camera legge QR → estrae loginToken
  ↓  POST /api/auth/qr-login  { token: loginToken }

[Server] authController.qrLogin
  ↓  User.findOne({ loginToken })
  ↓  Genera JWT identico al login normale
  ↓  Risposta: { token, user, mustChangePassword }
```

Il QR login bypassa la password ma non bypassa `mustChangePassword`: se l'utente deve cambiare la password, viene reindirizzato comunque.

---

## Restore della sessione (app launch)

Ad ogni avvio dell'app, la sessione viene ripristinata senza richiedere re-login:

```
[App] authStore.restoreSession()
  ↓  legge token da AsyncStorage
  ↓  Se assente → schermata Login

  ↓  GET /api/auth/me  (con token nell'header)

[Server] protect middleware
  ↓  Verifica firma JWT
  ↓  Carica user da DB
  ↓  Confronta jwt.tokenVersion === user.tokenVersion
  ↓  Se mismatch → 401

[App] Se 200 → stato autenticato + naviga MainTabs
      Se 401 → rimuove token, schermata Login
```

---

## Logout

```
[App] bottone Logout
  ↓  POST /api/auth/logout

[Server] authController.logout
  ↓  user.tokenVersion += 1
  ↓  user.save()
  ↓  Risposta 200

[App] rimuove token da AsyncStorage
      naviga a Login
```

Tutti i JWT emessi in precedenza diventano invalidi immediatamente (il campo `tokenVersion` nel token non corrisponde più a quello nel DB).

---

## Cambio password obbligatorio

Attivato in due casi:
1. **Primo accesso** — tutti i nuovi utenti hanno `mustChangePassword: true`
2. **Reset admin** — dopo `POST /api/users/:id/reset-password`

```
[App] login → mustChangePassword: true
  ↓  naviga a ChangePasswordScreen (bloccante)

[User] inserisce password corrente + nuova password
  ↓  POST /api/auth/change-password { currentPassword, newPassword }

[Server] authController.changePassword
  ↓  bcrypt.compare(currentPassword, user.password)
  ↓  Se ok: hash nuova password, salva
  ↓  tokenVersion += 1  (invalida tutte le sessioni precedenti)
  ↓  Genera nuovo JWT
  ↓  user.mustChangePassword = false
  ↓  Risposta: { message, token: <nuovo-jwt> }

[App] aggiorna token in AsyncStorage
      naviga a MainTabs
```

---

## Ruoli e autorizzazione

| Ruolo | Permessi |
|---|---|
| `operator` | lettura di magazzini, scaffali, prodotti; aggiunta foto; trascrizione vocale; visione AI |
| `admin` | tutto di operator + creazione/modifica/eliminazione di magazzini, scaffali, prodotti; gestione utenti |

Il middleware `requireAdmin` viene applicato dopo `protect`:

```ts
router.post('/', protect, requireAdmin, createWarehouse)
//               ↑ verifica JWT    ↑ verifica role === 'admin'
```

Se il ruolo è insufficiente, la risposta è `403 Forbidden`.

---

## Rigenera QR token

Un utente può rigenerare il proprio QR token in qualsiasi momento (ad esempio se perde il dispositivo su cui era salvato):

```
POST /api/auth/qr-token/regenerate

[Server] genera nuovi 32 byte hex
         user.loginToken = newToken
         user.save()
         Risposta: { loginToken }
```

Il vecchio QR code diventa inutilizzabile immediatamente.

---

## Sicurezza sessioni

| Misura | Dettaglio |
|---|---|
| `tokenVersion` | Logout invalida tutti i JWT precedenti senza lista nera |
| bcrypt | genSalt(10), hashing al salvataggio tramite hook pre-save Mongoose |
| JWT scadenza | 7 giorni (configurabile via `JWT_EXPIRES_IN`) |
| Rate limiting | 15 tentativi / 15 minuti su `/api/auth` in produzione |
| QR token | 32 byte casuali (256 bit di entropia), rigenerabile on-demand |
| Password campo | Rimosso dalla serializzazione JSON tramite `toJSON` transform di Mongoose |

---

## Autenticazione endpoint non-JWT

Due endpoint usano un bearer token statico separato dal JWT utente:

| Endpoint | Token |
|---|---|
| `GET /api/backup/dump` | `BACKUP_API_KEY` env |
| `PUT /api/version` | `BACKUP_API_KEY` env |

Il confronto è fatto con `crypto.timingSafeEqual` per prevenire timing attacks.

---

## Flusso completo (primo utilizzo)

```
Admin crea account utente
  POST /api/auth/register { name, email, password, role }
  → user creato con mustChangePassword=true, loginToken generato

Utente riceve credenziali e accede
  POST /api/auth/login { email, password }
  → { token, mustChangePassword: true }

App reindirizza a ChangePasswordScreen
  POST /api/auth/change-password { currentPassword, newPassword }
  → { token: <nuovo> }        ← tokenVersion incrementato

Sessioni successive: app usa token da AsyncStorage
  GET /api/auth/me → user OK → MainTabs

Logout:
  POST /api/auth/logout → tokenVersion incrementato → token invalido
  App rimuove token → Login
```
