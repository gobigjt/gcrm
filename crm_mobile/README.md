# EzCRM (Flutter)

GetX-based client for the NestJS API. All REST paths are relative to a single base URL that **must end with `/api`** (same global prefix as the backend).

## API base URL (`API_BASE_URL`)

Configured in code via `String.fromEnvironment` in `lib/app/core/network/api_client.dart`:

| Override | How |
|----------|-----|
| **Default** | `http://10.0.2.2:4000/api` — Android emulator only (`10.0.2.2` → host loopback) |
| **Custom** | `flutter run --dart-define=API_BASE_URL=<url>` (and the same for `flutter build`) |

Examples:

```bash
# iOS Simulator / desktop: host machine API on port 4000
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000/api

# Physical phone/tablet on same LAN as your PC (replace with your host IP)
flutter run --dart-define=API_BASE_URL=http://192.168.1.50:4000/api
```

Backend port defaults to **4000** (`PORT` in backend `.env`, see `backend/src/main.ts`).

## Platform notes

- **Android emulator**: default base URL usually works if the API listens on the host at `localhost:4000`.
- **iOS Simulator**: use `http://127.0.0.1:4000/api` (not `10.0.2.2`).
- **Physical devices**: use the computer’s LAN IP; ensure the phone and PC are on the same network and the OS firewall allows inbound TCP on the API port.
- **HTTP vs HTTPS**: plain `http://` is typical for local dev. On Android, cleartext may be restricted depending on `networkSecurityConfig` / OS version; if requests fail with connection errors, use HTTPS locally or allow cleartext for dev (see [Android network security](https://developer.android.com/privacy-and-security/security-config)).

## Run / test

```bash
cd ezcrm
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000/api
```

Release or profile builds must pass the same `--dart-define=API_BASE_URL=...` (or equivalent in your CI) so production/staging hosts are baked in at compile time.

## Project layout

- `lib/app/modules/*` — feature modules (auth, dashboard, CRM, sales, …)
- `lib/app/core/network/` — `ApiClient`, `ApiException`
- `lib/app/core/models/` — DTOs / list row models
- `lib/app/routes/` — GetX routes and permission middleware
