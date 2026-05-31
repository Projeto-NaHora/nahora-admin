# Refactor: Migrate from Axios to Angular HttpClient

## Problem Statement

The project uses Axios as its HTTP client (per ADR 0001), but the Angular HttpClient is a better fit — it's already in the dependency tree (`@angular/common`), integrates natively with Angular's DI and testing infrastructure, and supports functional interceptors that handle the 401-refresh-queue pattern cleanly. The current Axios integration requires a manual DI wrapper (`HttpClientService`), module-level token functions outside DI, and forces services to wrap Promise-based calls with `from()`. Reversing this decision eliminates a 14 kB dependency and aligns the codebase with Angular idioms.

## Solution

Replace Axios with Angular's `HttpClient` using three functional interceptors:

1. **`baseUrlInterceptor`** — prepends `environment.apiUrl` to relative request URLs (replaces axios's `baseURL`)
2. **`authInterceptor`** — attaches `Authorization: Bearer <accessToken>` header (replaces axios request interceptor)
3. **`refreshInterceptor`** — catches 401 responses, calls `/auth/refresh`, queues concurrent requests via `shareReplay(1)`, retries originals, and redirects to `/login` on failure (replaces axios response interceptor)

Token management moves from module-level functions in `http.ts` into `AuthService`, making tokens DI-accessible. The `HttpClientService` wrapper class is removed — services inject `HttpClient` directly. Error handling in `LoginFacade` is updated from Axios-specific shapes to Angular's `HttpErrorResponse`.

## Commits

### Commit 1 — Scaffold: add `provideHttpClient` to app config

Add `provideHttpClient()` to `app.config.ts`. No interceptors yet. This is a pure no-op — nothing uses Angular's `HttpClient` at this point. All existing code and tests continue to pass.

**Verification:** `ng build` and `ng test` pass unchanged.

---

### Commit 2 — Extend `AuthService` with token management methods

Add token management methods to `AuthService` (they currently live as module-level functions in `http.ts`):

- `getAccessToken(): string | null` — reads from localStorage
- `getRefreshToken(): string | null` — reads from localStorage
- `setTokens(accessToken, refreshToken): void` — writes to localStorage
- `clearTokens(): void` — removes from localStorage
- `refreshToken(): Observable<{ accessToken, refreshToken }>` — calls `POST /auth/refresh` via the existing `HttpClientService` (axios), stores new tokens on success

The existing `login()` method continues to import `setTokens` from `http.ts` — this duplication is intentional and temporary. `refreshToken()` is new; it is not yet called by anything.

**Verification:** extend `auth.service.spec.ts` with tests for each new method. All tests pass.

---

### Commit 3 — Create `baseUrlInterceptor`

New file: `src/app/core/interceptors/base-url.interceptor.ts`

```typescript
export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('http')) {
    return next(req.clone({ url: `${environment.apiUrl}${req.url}` }));
  }
  return next(req);
};
```

New file: `src/app/core/interceptors/base-url.interceptor.spec.ts` — test with `HttpTestingController`:

- Relative URL gets `environment.apiUrl` prepended
- Absolute URLs pass through unchanged
- URLs already containing `http` pass through unchanged

Wire into `app.config.ts`: `provideHttpClient(withInterceptors([baseUrlInterceptor]))`.

**Verification:** interceptor tests pass. No existing code uses `HttpClient`, so no behavior change.

---

### Commit 4 — Create `authInterceptor`

New file: `src/app/core/interceptors/auth.interceptor.ts`

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  if (token) {
    return next(req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    }));
  }

  return next(req);
};
```

New file: `src/app/core/interceptors/auth.interceptor.spec.ts` — test with `HttpTestingController`:

- Attaches Bearer header when token exists
- Skips header when no token
- Does not mutate original request

Wire into `app.config.ts`: `provideHttpClient(withInterceptors([baseUrlInterceptor, authInterceptor]))`.

**Verification:** interceptor tests pass.

---

### Commit 5 — Create `refreshInterceptor`

New file: `src/app/core/interceptors/refresh.interceptor.ts`

The interceptor must handle:

1. **Skip non-401 errors** — pass through
2. **Skip refresh URL** — if the failing request is `/auth/refresh` itself, pass through (prevents infinite loop)
3. **Queue concurrent 401s** — use a module-level `refreshInProgress$: Observable<string> | null` with `shareReplay(1)` so multiple simultaneous 401s trigger only one refresh call
4. **Call `authService.refreshToken()`** — gets new tokens and stores them
5. **Retry originals** — clone each queued request with the new token and retry
6. **On refresh failure** — clear `refreshInProgress$`, call `authService.logout()`, navigate to `/login`

New file: `src/app/core/interceptors/refresh.interceptor.spec.ts` — test with `HttpTestingController`:

- Non-401 errors pass through
- `/auth/refresh` 401s pass through (no cycle)
- Single 401 triggers refresh, retries, and succeeds
- Multiple concurrent 401s trigger exactly one refresh call
- Refresh failure logs out and redirects to `/login`
- Requests arriving after refresh completes use the new token

Wire into `app.config.ts`: `provideHttpClient(withInterceptors([baseUrlInterceptor, authInterceptor, refreshInterceptor]))`.

**Verification:** interceptor tests pass. No service uses `HttpClient` yet, so existing app behavior unchanged.

---

### Commit 6 — Migrate `AuthService.login()` to `HttpClient`

Replace:

```typescript
private readonly httpClient = inject(HttpClientService);

login(credentials: LoginRequest): Observable<LoginResponse> {
  return from(
    this.httpClient.post<LoginResponse>('/auth/login', credentials)
      .then(({ data }) => {
        setTokens(data.accessToken, data.refreshToken);
        return data;
      })
  );
}
```

With:

```typescript
private readonly http = inject(HttpClient);

login(credentials: LoginRequest): Observable<LoginResponse> {
  return this.http.post<LoginResponse>('/auth/login', credentials).pipe(
    tap((data) => this.setTokens(data.accessToken, data.refreshToken))
  );
}
```

Also update `refreshToken()` to use `HttpClient` and `this.setTokens()` instead of `HttpClientService` and the imported `setTokens`. Remove the `import { setTokens, clearTokens } from '../http'` — all token operations now use `this.*` methods.

**Key differences from Axios:**
- `HttpClient.post<T>()` returns `Observable<T>` (body only), not `Observable<{ data: T }>` — no `.then(({ data }) => ...)` needed
- `tap()` replaces the `.then()` side-effect
- No `from()` wrapping needed

Update `auth.service.spec.ts`:

```typescript
const mockHttp = { post: vi.fn().mockReturnValue(of(mockResponse)) };
TestBed.configureTestingModule({
  providers: [
    AuthService,
    { provide: HttpClient, useValue: mockHttp },
  ],
});
```

Mock expectations change from `mockResolvedValue` (Promise) to `mockReturnValue(of(...))` (Observable).

**Verification:** `auth.service.spec.ts` tests pass. The login flow now goes through the full Angular interceptor chain (base URL prefix → auth header → refresh on 401).

---

### Commit 7 — Migrate `ProfessionalService` to `HttpClient`

Replace `inject(HttpClientService)` with `inject(HttpClient)`. Remove `from()` wrapping and `.then(({ data }) => data)` destructuring:

- `getPending()`: `this.http.get<PagedResponse<Professional>>('/admin/profissionais/pendentes', { params: { page, size } })`
- `verifyProfessional()`: `this.http.patch(`/admin/profissionais/${id}/verificar`, body)`

Update `professional.service.spec.ts`: replace `{ provide: HttpClientService, useValue: mockHttp }` with `{ provide: HttpClient, useValue: mockHttp }`. Mock methods return `of(...)` instead of `mockResolvedValue`.

**Verification:** `professional.service.spec.ts` tests pass.

---

### Commit 8 — Update `LoginFacade` error handling

The `catchError` block in `login.facade.ts` currently uses Axios-specific error shapes:

| Current (Axios) | New (Angular `HttpErrorResponse`) |
|---|---|
| `err.response?.status === 401` | `err.status === 401` |
| `err.code === 'ECONNABORTED'` | `err.status === 0 && err.name === 'TimeoutError'` |
| `!err.response` (network error fallback) | `err.status === 0` (but not timeout) |
| `err.response.status` (generic server error) | `err.status` |

The updated error handler:

```
if (err.status === 401) → "E-mail ou senha inválidos."
else if (err.name === 'TimeoutError') → "O servidor demorou muito... Tente novamente."
else if (err.status === 0) → "Sem conexão com o servidor..."
else → "Erro do servidor (HTTP ${err.status}). Tente novamente."
```

Update `login.facade.spec.ts` error test cases to throw `HttpErrorResponse`-shaped objects instead of Axios-shaped ones:

- `throwError(() => new HttpErrorResponse({ status: 401 }))` instead of `throwError(() => ({ response: { status: 401 } }))`
- Timeout: `throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Timeout Error', ... }))` — actual Angular timeout representation

**Verification:** `login.facade.spec.ts` error tests pass with updated mocks.

---

### Commit 9 — Remove Axios, `http.ts`, and `HttpClientService`

- Delete `src/app/core/http.ts` (91 lines)
- Delete `src/app/core/services/http-client.service.ts` (15 lines)
- Run `npm uninstall axios`
- Search for any remaining references: `grep -r "axios\|HttpClientService\|from '../http'" src/` — expect zero matches

**Verification:** `ng build` and `ng test` pass. No imports of `axios`, `HttpClientService`, or `../http` remain in the source tree.

---

### Commit 10 — Supersede ADR 0001

Update `docs/adr/0001-use-axios-over-angular-httpclient.md`:

- **Status:** ~~Accepted~~ → **Superseded**
- Add a brief note explaining why: "Angular v21 functional interceptors (`HttpInterceptorFn`) handle the 401-refresh-queue pattern cleanly via `shareReplay(1)`. The `HttpClient` DI integration eliminates the need for a separate wrapper class (`HttpClientService`). Token management moved into `AuthService`, making it accessible via `inject()` inside interceptors. Axios is removed."
- Do not delete the ADR — it remains as a historical record

**Verification:** ADR reads correctly.

---

## Decision Document

### Modules built/modified

- **`src/app/core/interceptors/`** — new directory with three functional interceptors (`base-url`, `auth`, `refresh`) and their tests
- **`src/app/core/services/auth.service.ts`** — gains token management methods; switches from `HttpClientService` to `HttpClient`
- **`src/app/core/services/professional.service.ts`** — switches from `HttpClientService` to `HttpClient`
- **`src/app/features/login/login.facade.ts`** — error handling updated from Axios to `HttpErrorResponse` shapes
- **`src/app/app.config.ts`** — gains `provideHttpClient(withInterceptors([...]))`
- **`src/app/core/http.ts`** — deleted
- **`src/app/core/services/http-client.service.ts`** — deleted

### Modules NOT modified

- All components and their templates
- `dashboard.facade.ts` and `professional-detail.facade.ts` (they consume services, not the HTTP layer directly)
- `auth.guard.ts` (only calls `authService.isAuthenticated()` — localStorage check, not HTTP)
- All types (`auth.types.ts`, `professional.types.ts`)
- Environment files
- Proxy config (`proxy.conf.json`)
- ADR 0002

### API contracts

- **`POST /auth/login`** — same request/response shape; response body is now unwrapped automatically by `HttpClient` (no `.data` accessor)
- **`POST /auth/refresh`** — same request/response shape; called from `AuthService.refreshToken()` instead of `http.ts` interceptor
- **`GET /admin/profissionais/pendentes`** — same params (`page`, `size`); response body unwrapped
- **`PATCH /admin/profissionais/{id}/verificar`** — same body (`{ aprovado: boolean }`)

### Architectural decisions

- **Functional interceptors** (`HttpInterceptorFn`) over class-based — idiomatic Angular v15+, supports `inject()` for DI access
- **Token management in `AuthService`** — tokens move from module-level functions to DI-injectable service methods; interceptors access them via `inject(AuthService)`
- **Refresh-queue via `shareReplay(1)`** — replaces Axios's imperative `Promise` + array queue; equally concise (~15 lines)
- **Base URL as an interceptor** — preserves existing service method signatures (`/auth/login` instead of `${environment.apiUrl}/auth/login`)
- **Refresh URL skip** — `req.url.includes('/auth/refresh')` in the refresh interceptor prevents infinite 401 → refresh → 401 loops, matching Axios's `_retry` flag

## Testing Decisions

### What makes a good test

Tests verify **external HTTP behavior**, not implementation details:
- Interceptor tests: "when I send a request without a token, the interceptor adds one" — not "the interceptor calls localStorage.getItem"
- Service tests: "login() calls POST /auth/login with the right body and returns the response" — not "the service calls http.post"

### Test strategy (per user directive: Option B — service-level mocks)

- **Interceptor tests** — use `HttpTestingController` (new). These are the only tests that drive the real interceptor chain.
- **Service tests** — mock `HttpClient` (replace `HttpClientService` mock). Same pattern as current tests: provide a `useValue` mock object in `TestBed`.
- **Facade tests** — mock `AuthService` / `ProfessionalService` (unchanged). No HTTP mock changes needed except `LoginFacade` error tests which must use `HttpErrorResponse`.

### Prior art

- Current `auth.service.spec.ts` and `professional.service.spec.ts` use `{ provide: HttpClientService, useValue: mockHttp }` — the new tests replace `HttpClientService` with `HttpClient` in the same pattern
- Current `login.facade.spec.ts` uses `{ provide: AuthService, useValue: mockAuthService }` — unchanged

## Out of Scope

- Moving facades from RxJS to signals — ADR 0002 remains in force
- Changing the token storage mechanism (localStorage → cookies/httpOnly) — current localStorage approach preserved
- Adding progress/upload support — no file uploads from admin dashboard
- Refactoring test infrastructure beyond the HTTP mock replacement
- Modifying any component, template, or stylesheet
- Changing the proxy configuration
- Touching ADR 0002
