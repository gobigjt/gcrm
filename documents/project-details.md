# CRM + ERP Platform (Non-SaaS)

## 1. SINGLE-TENANT ARCHITECTURE

-   Single organization system (no multi-tenant separation)
-   Users belong to the same organization
-   Role-based permissions: Super Admin, Admin, Manager, Agent, Accountant, HR
-   JWT authentication with short-lived access tokens (15 min) + rotating refresh tokens (7 days)
-   Role-Based Access Control (RBAC) — granular per-permission via `roles`, `permissions`, `role_permissions`, `user_permissions` tables
-   Super Admin bypasses all role checks; per-user permission overrides supported

## 2. CRM MODULE

-   Lead management (CRUD, stages, sources)
-   Activities timeline
-   Follow-ups with reminders
-   Kanban pipeline
-   Auto lead assignment via lead forms

## 3. COMMUNICATION MODULE

-   WhatsApp API (Meta/Twilio) — template-based
-   Email (SMTP)
-   SMS (optional)
-   Templates & message logging

## 4. SALES MODULE

-   Proposals, Quotations, Orders
-   GST invoices (CGST / SGST / IGST)
-   Payments & notes
-   Customer master

## 5. PURCHASE MODULE

-   Vendors, Purchase Orders (PO), Goods Receipt Notes (GRN), vendor invoices

## 6. INVENTORY

-   Products, SKU, HSN codes
-   Multi-warehouse stock tracking
-   Low-stock alerts
-   Stock adjustments & movement history

## 7. PRODUCTION

-   Bill of Materials (BOM)
-   Work orders with timeline and status

## 8. FINANCE

-   Chart of accounts, journal entries, expenses
-   P&L report (`GET /finance/reports/pl`)
-   Account ledger (`GET /finance/accounts/:id/ledger`)

## 9. GST (INDIA)

-   CGST, SGST, IGST on invoices
-   GSTIN stored in company settings
-   GST report (`GET /finance/reports/gst`) — per-period CGST/SGST/IGST breakdown with totals

## 10. HR & PAYROLL

-   Employees (linked to users)
-   Attendance tracking
-   Monthly payroll with salary components and slip status

## 11. LEAD CAPTURE

-   Lead forms with configurable fields (`lead_forms` table)
-   **Public API** (no auth): `GET /capture/:formKey` — render form; `POST /capture/:formKey` — submit lead
-   Auto-creates a Lead record from submissions
-   Facebook Ads / landing page integration via form keys

## 12. SYSTEM SETTINGS

-   Company profile (name, GSTIN, address, logo, currency, fiscal year)
-   Redis-cached company settings
-   Audit logs (`GET /settings/audit-logs`)

## 13. ADMIN PANEL

-   Users management (`/users`) — create, edit, toggle status, per-user permissions
-   Roles management — create, edit, assign permissions
-   Permissions overview (80 permissions: 10 modules × 8 actions)
-   Dashboard stats (open leads, revenue, active orders, employee count)

## 14. ADVANCED FEATURES

-   **Export (CSV)**: leads, invoices, employees, stock (`GET /export/*`)
-   **Notifications**: per-user notification feed with read/unread, type, module, link (`/notifications`)
-   AI scoring — planned
-   Push notifications / email alerts — planned

## 15. TECH STACK

-   Backend: **NestJS** (TypeScript)
-   DB: **PostgreSQL 16**
-   Cache: **Redis 7** (ioredis, optional — graceful fallback if unavailable)
-   Storage: S3 (planned — logo_url currently stored as URL string)
-   Frontend: **React 18** + Vite + Tailwind CSS v3
-   Mobile: **Flutter** (`ezcrm/`) — GetX, JWT + refresh, RBAC-aware routing; API base URL via `--dart-define=API_BASE_URL=` (default Android emulator: `http://10.0.2.2:4000/api`). See `ezcrm/README.md`.

## 16. API DESIGN

-   REST — all endpoints under `/api/`
-   JWT Bearer auth (access token in `Authorization: Bearer <token>`)
-   Refresh via `POST /api/auth/refresh` with `{ refresh_token }`
-   Versioning: planned (`/api/v1/`)

## 17. DATABASE

-   No tenant_id (single-tenant)
-   Migration runner: `npm run migrate` (applies `migrations/00N_*.sql` in order, tracked in `schema_migrations`)
-   Migrations include initial schema → RBAC → seeds → Super Admin → role_id FK → refresh tokens → notifications → lead forms → module settings → CRM enhancements → **demo data (`012_demo_data.sql`)** → **`013_fix_demo_password_hashes.sql`** (corrects demo bcrypt for password `Demo@123`; run `npm run migrate` if demo login fails after 012)

## 18. UI

-   Top navigation (sticky, two-row: brand+user / nav tabs)
-   Light/dark theme toggle — persisted to localStorage, respects system preference
-   Modules: Dashboard, CRM, Sales, Purchase, Inventory, Production, Finance, HR & Payroll, Comms, Settings, Users
-   Modern design: gradient stat cards, pill nav, backdrop-blur modals, animated theme toggle

## 19. DEPLOYMENT

-   **Docker**: `backend/Dockerfile`, `frontend/Dockerfile` (multi-stage builds)
-   **docker-compose.yml**: postgres + redis + backend + frontend (nginx reverse proxy)
-   `.env.example`: all required environment variables documented
-   CI/CD: planned (GitHub Actions)

## 20. OUTPUT

-   Schema + migrations (PostgreSQL)
-   REST API (NestJS, 13 modules, ~130 endpoints)
-   React frontend (Vite + Tailwind, full dark mode)
-   Flutter mobile app (`ezcrm/`, module screens + typed models)
-   Docker Compose for one-command local/production deployment
