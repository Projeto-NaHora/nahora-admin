# ADR 0002: Facades with RxJS over Signals

**Status:** Accepted  
**Date:** 2025-07-13  
**Deciders:** Project lead + Reasonix Code (grill session)

---

## Context

Each screen feature (Login, Dashboard, Professional Detail) has a **Facade** that encapsulates business logic and exposes state + actions to the component.

The project's `CLAUDE.md` recommends Angular signals (`signal()`, `computed()`, `effect()`) as the standard state primitive. However, the facade's primary job is composing asynchronous data streams — paginated API calls, authentication state, and dependent requests (list → detail).

We need to decide which reactive primitive the facades should expose.

## Considered Options

### Option A: Signals everywhere

- Facades hold `signal<>` and `computed<>` for all state
- `effect()` or `toObservable()` bridges between signals and HTTP
- Pagination is a `signal<number>` for current page + a `computed(() => professionalService.fetchPage(page()))` — but `computed` is synchronous, it can't hold a `Promise` or `Observable`
- Actual implementation would need `toObservable(page).pipe(switchMap(...))` anyway — signals don't model async streams natively

### Option B: RxJS Observables everywhere

- Facades expose `BehaviorSubject`, `Observable`, `Subject` for all state and actions
- Components subscribe via `async pipe` in templates
- Pagination: `private page$ = new BehaviorSubject(0)` → `this.professionals$ = page$.pipe(switchMap(page => this.service.fetch(page)))`
- Auth refresh queue is a natural RxJS stream: `refresh$.pipe(switchMap(...))`

### Option C: Mixed — Observables in facades, signals in components (chosen)

- Facades expose RxJS Observables (for async stream composition)
- Components can convert to signals via `toSignal()` for local synchronous state (e.g. form fields, button disabled states)

## Decision

**Option C — Mixed, with RxJS as the primary facade primitive.**

## Rationale

1. **Stream composition is RxJS's strength.** Pagination, refresh token queuing, and dependent data loading are all "stream in → transform → stream out" patterns. RxJS operators (`switchMap`, `combineLatest`, `catchError`, `retry`) express these concisely. Signals require explicit `toObservable()` bridges to achieve the same.

2. **`async pipe` is zero-boilerplate.** In templates, `{{ professionals$ | async }}` handles subscribe/unsubscribe/change detection automatically. Converting to signals adds `toSignal()` calls without eliminating the RxJS code underneath.

3. **Signals still have a place.** Synchronous UI concerns (form validity, button disabled state, "olhinho" toggle for password) are simpler with `signal()` than with small `BehaviorSubject`s. The mixed approach lets each primitive do what it's best at.

4. **No performance concern.** Both change detection strategies (OnPush) work equally well with `async pipe` and signals. The `async pipe` marks the component for check on emission — same as signal writes.

## Consequences

- **Positive:** Pagination, refresh, and dependent data loading are expressed naturally as pipes
- **Positive:** Facades remain framework-agnostic in their core logic (just RxJS)
- **Negative:** Inconsistency with the `CLAUDE.md` recommendation — developers must know both paradigms
- **Mitigation:** Clear rule documented in CONTEXT.md: *"Facades expose RxJS for async data streams; components use signals (or `toSignal()`) for synchronous UI state"*
- **Mitigation:** `async pipe` throughout templates keeps the observable-to-view bridge simple
