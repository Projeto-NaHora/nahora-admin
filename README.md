# Nahora Admin

Admin dashboard for the **Nahora** platform — review and verify **Professional** registration attempts by inspecting identity documents (RG front/back, selfie holding document) and approving or rejecting applicants.

| | |
|---|---|
| **Stack** | Angular 21 (standalone), TypeScript 5.9, RxJS 7.8, SCSS |
| **Test runner** | Vitest 4 |
| **Package manager** | npm 11 |
| **Formatting** | Prettier 3 (100 col, single quotes, Angular HTML parser) |

---

## Domain glossary

> Full definitions live in [CONTEXT.md](CONTEXT.md). Quick reference below.

| Term | Meaning |
|---|---|
| **Professional** | A person who registered on Nahora to offer services. Submits RG front + back photos and a selfie holding the document for identity verification. |
| **Admin** | The privileged user of this dashboard. Only users with `tipoUsuario === "ADMIN"` are granted access. |
| **Verification** | Reviewing a Professional's documents and calling `PATCH /admin/profissionais/{id}/verificar` with `{ "aprovado": boolean }`. |

## Features

### Login (`/login`)
- Email + password form with NgOptimizedImage logo, show/hide password toggle, and "keep connected" checkbox
- `POST /auth/login` → checks `tipoUsuario === "ADMIN"`; non-admin users are rejected with an in-app message
- User-facing error messages for 401, network failure, timeout, and generic server errors
- Facade: [LoginFacade](src/app/features/login/login.facade.ts)

### Dashboard (`/dashboard`)
- Paginated table of pending Professionals (`GET /admin/profissionais/pendentes?page=&size=`)
- Client-side search by name, email, or ID (300ms debounce)
- Pagination controls with "start–end of total" display
- Per-row approve / reject / detail buttons with loading spinners (tracks in-flight operations by ID)
- Skeleton loading state and error banner
- Logout in sidebar
- Facade: [DashboardFacade](src/app/features/dashboard/dashboard.facade.ts)

### Professional Detail (`/dashboard/:id`)
- Receives Professional data via router state (no additional API call)
- Displays personal data (name, phone, email, registration date) and three document previews (RG front, RG back, selfie)
- Click-to-expand image overlay for each document
- Approve / reject action buttons with loading state
- Breadcrumb navigation back to Dashboard
- Facade: [ProfessionalDetailFacade](src/app/features/professional-detail/professional-detail.facade.ts)

---

## Architecture

```
src/app/
├── app.ts                        # Root component — just <router-outlet>
├── app.config.ts                 # provideHttpClient + 3 interceptors + provideRouter
├── app.routes.ts                 # Route definitions (lazy-loaded features)
├── core/
│   ├── guards/
│   │   └── auth.guard.ts         # CanActivateFn — redirects to /login if no access token
│   ├── interceptors/
│   │   ├── base-url.interceptor.ts   # Prepends environment.apiUrl to relative URLs
│   │   ├── auth.interceptor.ts       # Attaches Authorization: Bearer header
│   │   └── refresh.interceptor.ts    # Catches 401, refreshes token, queues concurrent calls
│   ├── services/
│   │   ├── auth.service.ts           # login(), refreshToken(), logout(), token CRUD (localStorage)
│   │   └── professional.service.ts   # getPending(), verifyProfessional()
│   └── types/
│       ├── auth.types.ts             # LoginRequest, LoginResponse, AuthState
│       └── professional.types.ts     # Professional, PagedResponse<T>, VerifyRequest
├── features/
│   ├── login/                    # LoginComponent + LoginFacade
│   ├── dashboard/                # DashboardComponent + DashboardFacade
│   └── professional-detail/      # ProfessionalDetailComponent + ProfessionalDetailFacade
└── shared/
    └── components/               # (empty — reserved for shared UI)
```

### Design decisions (ADRs)

| ADR | Status | Summary |
|---|---|---|
| [0001](docs/adr/0001-use-axios-over-angular-httpclient.md) | **Superseded** | Originally chose Axios for simpler 401-refresh-queue code; migrated to Angular `HttpClient` with functional interceptors. |
| [0002](docs/adr/0002-facades-with-rxjs-over-signals.md) | **Accepted** | Facades expose RxJS Observables for async stream composition; templates consume via `async` pipe. Signals are used only for synchronous UI state (form fields, toggles). |

### HTTP layer

Three functional interceptors run in order:

1. **`baseUrlInterceptor`** — prepends `environment.apiUrl` to relative request URLs (e.g. `/auth/login` → `https://nahora-backend-staging.up.railway.app/api/v1/auth/login`). Absolute URLs pass through unchanged.
2. **`authInterceptor`** — reads `accessToken` from `AuthService` (which reads `localStorage`) and sets `Authorization: Bearer <token>` if available.
3. **`refreshInterceptor`** — on `401` responses (except `/auth/refresh` itself): calls `AuthService.refreshToken()`, queues concurrent 401s via `shareReplay(1)` so only one refresh fires, retries the original request with the new token, and redirects to `/login` if refresh fails.

Token storage is `localStorage` with keys `accessToken` and `refreshToken`.

### Facade pattern

Each feature has a `@Injectable()` facade provided at the component level (`providers: [XxxFacade]`). Facades:

- **Encapsulate business logic** — API orchestration, error handling, navigation
- **Expose RxJS Observables** — consumed by templates via `async` pipe
- **Expose action methods** — called from templates on user interaction
- Are **testable in isolation** — services are mocked in facade specs

Components are thin: inject the facade, bind template to its observables and action methods. No business logic in components.

### Routing

| Path | Component | Guard |
|---|---|---|
| `/login` | `LoginComponent` (lazy) | none |
| `/dashboard` | `DashboardComponent` (lazy) | `authGuard` |
| `/dashboard/:id` | `ProfessionalDetailComponent` (lazy) | `authGuard` |
| `/` | redirect → `/login` | — |
| `**` | redirect → `/login` | — |

The `authGuard` checks `AuthService.isAuthenticated()` (localStorage token presence) and redirects unauthenticated users to `/login`.

### State management

- **Async data** (API responses, loading/error flags, pagination) → RxJS `BehaviorSubject` + `Observable` pipes in facades, consumed via `async` pipe
- **Synchronous UI** (form fields, show/hide toggles) → RxJS `BehaviorSubject` in facades; components may convert to signals with `toSignal()` for local sync state
- **`ChangeDetectionStrategy.OnPush`** on all components — `async` pipe triggers change detection on emission

---

## Getting started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### Install

```bash
npm install
```

### Development server

```bash
npm start
```

This runs `ng serve` on `http://localhost:4200`. API requests are proxied through `proxy.conf.json`:

```
/api → https://nahora-backend-staging.up.railway.app
```

The development environment ([`environment.development.ts`](src/environments/environment.development.ts)) sets `apiUrl` to `/api/v1` (relative), so requests go through the proxy.

### Build

```bash
npm run build
```

Production output lands in `dist/`.

### Test

```bash
npm test
```

Runs Vitest. All spec files live beside their source files as `*.spec.ts`.

### Diagnose login issues

```bash
./scripts/diagnose-login.sh [API_URL]
```

Tests TCP connectivity, CORS preflight, and a sample login request against the backend.

---

## API contracts

| Method | Endpoint | Service method |
|---|---|---|
| `POST` | `/auth/login` | `AuthService.login()` |
| `POST` | `/auth/refresh` | `AuthService.refreshToken()` |
| `GET` | `/admin/profissionais/pendentes?page=&size=` | `ProfessionalService.getPending()` |
| `PATCH` | `/admin/profissionais/{id}/verificar` | `ProfessionalService.verifyProfessional()` |

All endpoints are relative in service code — the `baseUrlInterceptor` prepends the API base URL from the environment config.

---

## Environments

| File | `apiUrl` | Used when |
|---|---|---|
| [`environment.development.ts`](src/environments/environment.development.ts) | `/api/v1` (proxy) | `ng serve` |
| [`environment.ts`](src/environments/environment.ts) | `https://nahora-backend-staging.up.railway.app/api/v1` | `ng build` (production) |

---

## Code conventions

- **Standalone components** — no NgModules; `standalone: true` is the default in Angular 21 and omitted
- **`inject()`** over constructor injection
- **`input()` / `output()`** functions over `@Input()` / `@Output()` decorators
- **`@if` / `@for` / `@switch`** control flow over `*ngIf` / `*ngFor` / `*ngSwitch`
- **`class` / `style` bindings** over `ngClass` / `ngStyle`
- **`ChangeDetectionStrategy.OnPush`** on every component
- **Single quotes**, 2-space indent, trailing newlines
- **SCSS** with semantic class names (no BEM, no CSS framework)
- **Accessibility** — all interactive elements have `aria-label`; color contrast meets WCAG AA

---

## Project files

```
.
├── angular.json              # Angular CLI config
├── tsconfig.json             # TypeScript config (strict, ES2022, module preserve)
├── tsconfig.app.json         # App-specific TS overrides
├── tsconfig.spec.json        # Test-specific TS overrides
├── package.json              # Dependencies & scripts
├── proxy.conf.json           # Dev server API proxy
├── .editorconfig             # Editor settings
├── .prettierrc               # Formatter config
├── CONTEXT.md                # Domain glossary & architectural rules
├── docs/
│   ├── adr/                  # Architecture Decision Records
│   └── 0001-migrate-axios-to-angular-httpclient.md  # Migration plan
├── public/                   # Static assets (favicon, logo)
├── scripts/
│   └── diagnose-login.sh     # Backend connectivity diagnostic
└── src/
    ├── main.ts               # Bootstrap
    ├── index.html            # HTML host page
    ├── styles.scss           # Global styles (reset, font, button base)
    ├── environments/         # Environment configs
    └── app/                  # Application code (see architecture diagram above)
```
