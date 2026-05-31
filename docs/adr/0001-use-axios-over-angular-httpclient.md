# ADR 0001: Use Axios over Angular HttpClient

**Status:** Superseded  
**Date:** 2025-07-13  
**Deciders:** Project lead + Reasonix Code (grill session)

---

## Context

The admin dashboard needs an HTTP client with interceptors for:

1. Attaching `Authorization: Bearer <accessToken>` to every request
2. Detecting 401 responses, attempting silent token refresh, and retrying the original request
3. Queuing concurrent requests that arrive while a refresh is in-flight
4. Redirecting to `/login` when refresh fails

The client must also be mockable in Vitest unit tests.

## Considered Options

### Option A: Angular HttpClient (built-in)

- Native to Angular, tree-shakeable, integrated with DI via `provideHttpClient()`
- Interceptors use `HttpInterceptorFn` — operate on `HttpEvent<?>` streams, not raw requests/responses
- Refresh-with-queue requires cloning the request, piping through `catchError`, managing a shared `refresh$` observable with `shareReplay(1)` — possible but verbose
- Works well with `HttpTestingController` in tests

### Option B: Axios

- Interceptors operate on raw `(request) => request` and `(response) => response` / `(error) => Error` — imperative, flat, easy to read
- Request queue during refresh: a simple module-level `Promise` + `Subject` pattern, no stream plumbing
- Instance is a plain export (`core/http.ts`) — no DI wrapper needed when all calls use the same config
- Mocking via `vi.mock('axios')` returns a `vi.fn()` with `.mockResolvedValue` — straightforward
- Adds ~14kB gzipped dependency

### Option C: Fetch API (no client)

- Zero dependencies
- No interceptor pipeline — 401 retry must be hand-rolled per call
- No built-in timeout, no progress, no cancellation (AbortController is manual)
- Increases boilerplate in every service

## Decision

**Axios.**

## Rationale

1. **The refresh-with-queue flow is the deciding factor.** In Angular HttpClient, the interceptor chain runs as RxJS pipes on `HttpEvent` observables. Queuing concurrent requests (several calls hit 401 before refresh completes) requires tracking a shared `refresh$: Observable<void>` with `shareReplay(1)` and manually cloning each `HttpRequest` for retry. Axios does this in ~15 lines of imperative code — a module-level `Promise` variable and a few array pushes.

2. **No DI integration loss.** All HTTP calls go through the same base URL + interceptor. A single exported instance (`http.ts`) achieves this. If per-service customization were needed, DI would add value — it isn't.

3. **Testing simplicity.** `vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), ... } }))` is well-understood and works without Angular's `TestBed`.

## Consequences

- **Positive:** Refresh token flow is readable and testable in isolation
- **Positive:** Mock-based tests are simple and fast (no `HttpTestingController` setup)
- **Negative:** Another dependency in `package.json`; team must know axios API in addition to Angular patterns
- **Negative:** No type-safe progress events (`HttpEvent<UploadProgress>`) — irrelevant here since no file uploads from admin dashboard
- **Mitigation:** axios API is small and well-documented; TypeScript types are bundled

---

## Superseded

**Why:** Angular v21 functional interceptors (`HttpInterceptorFn`) handle the 401-refresh-queue pattern cleanly via `shareReplay(1)`. The `HttpClient` DI integration eliminates the need for a separate wrapper class (`HttpClientService`). Token management moved into `AuthService`, making it accessible via `inject()` inside interceptors. Axios is removed.

**Migration:** See `docs/0001-migrate-axios-to-angular-httpclient.md` for the step-by-step refactor plan.
