# EzCRM / GCRM — Run the project (Windows)

This repo contains:

- **Backend**: NestJS API in `backend/` (base path prefix: **`/api`**)
- **Frontend**: React + Vite web app in `frontend/`
- **Mobile**: Flutter app in `crm_mobile/`

## Prerequisites

- **Node.js**: install an LTS version (18+ recommended)
- **PostgreSQL**: running locally (or use a hosted DB)
- (Optional) **Flutter**: for running `crm_mobile/`

## Backend (API) — local run

### 1) Configure environment

Copy the example env file and update it:

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

Minimum required values:

- **`DATABASE_URL`**: your Postgres connection string
- **`JWT_SECRET`**: any long random string

### 2) Install dependencies

```powershell
cd backend
npm install
```

### 3) Run database migrations

```powershell
cd backend
npm run migrate
```

If you want a fresh DB (drops/recreates schema via the project migrator), use:

```powershell
cd backend
npm run migrate:fresh
```

### 4) Start the API

```powershell
cd backend
npm run start:dev
```

Default API URL:

- **`http://localhost:4000/api`**

## Frontend (Web) — local run

### 1) Install dependencies

```powershell
cd frontend
npm install
```

### 2) Configure environment (if needed)

Check `frontend/.env`. You typically need the API base URL to point at the backend (examples):

- `http://localhost:4000/api`
- `https://<your-domain>/api` (production)

### 3) Start the dev server

```powershell
cd frontend
npm run dev
```

Vite default:

- **`http://localhost:5173`**

## Mobile (Flutter) — local run

The Flutter app expects a single base URL that **must end with `/api`**.

From `crm_mobile/README.md`, you can run:

```powershell
cd crm_mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000/api
```

Notes:

- Android emulator default often uses `http://10.0.2.2:4000/api`
- Physical devices must use your PC LAN IP and allow the port in firewall

## Facebook Lead Ads integration (optional)

This project can sync Facebook Lead Ads by connecting a Facebook Page in:

**Web → Settings → Lead platforms → Facebook Pages → “Continue with Facebook”**

### Required Meta app setup

In [Meta for Developers](https://developers.facebook.com/):

- Create an app
- Add **Facebook Login**
- Set **Valid OAuth Redirect URIs** to your web origin (e.g. `http://localhost:5173`)
- In **Facebook Login → Settings**, allow permissions:
  - `pages_show_list`
  - `pages_read_engagement`
  - `leads_retrieval`

If your app is **Live**, some permissions may require **App Review** for non-test users.

### Common sync errors

- **Error (#100) requires `pages_read_engagement`**
  - Disconnect the Page and reconnect using **Continue with Facebook**
  - In Meta’s dialog use **Edit settings** and enable all requested permissions
  - Ensure the permissions are enabled in **Facebook Login → Settings**

- **Error (#190) “must be called with a Page Access Token”**
  - The saved token is not a Page token (often a **User** token pasted manually)
  - Disconnect and reconnect via **Continue with Facebook** (recommended)
  - In “Advanced manual connect”, only paste a **Page access token**, not a User token

## Production notes (Railway / hosted)

- Set backend environment variables on the host (Railway Variables):
  - `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT` (if required by host)
  - Optional Facebook vars: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_GRAPH_API_VERSION`
- After changing env vars, **restart/redeploy** the backend so they take effect.

## Useful commands

### Backend

```powershell
cd backend
npm run build
npm run migrate:status
```

### Frontend

```powershell
cd frontend
npm run build
npm run preview
```

