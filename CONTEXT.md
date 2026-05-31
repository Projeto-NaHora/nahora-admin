# Nahora Admin — Domain Glossary

## Core Concepts

### Professional
A person who registers on the Nahora platform to offer services. Professionals submit identity documents (RG front/back photo + selfie holding document) for verification. Admin users review and approve/reject these registration attempts.

- **Aliases:** `profissional` (API), `applicant` (during registration flow)
- **Statuses:** `pending` | `approved` | `rejected`

### Admin
A privileged user who logs into this dashboard to review and verify Professional registration attempts. Only users with `tipoUsuario === "ADMIN"` are granted access.

- **Aliases:** `gestor` (business), `ADMIN` (API)

### Verification
The act of reviewing a Professional's submitted documents and deciding whether to approve or reject their registration.

- **API:** `PATCH /admin/profissionais/{id}/verificar` with `{ "aprovado": boolean }`
- **Result:** Returns `204` on success; Professional moves from pending to approved/rejected state.

## Architectural Rules

### HTTP Client
Use **axios** (exported instance from `core/http.ts`), not Angular's `HttpClient`. The interceptor pipeline handles:
- Attaching `Authorization: Bearer <accessToken>` header
- Auto-refresh on 401 with request queuing during refresh
- Redirect to `/login` if refresh fails

### State Management
- **Facades** expose RxJS `Observable`-based state for async data streams (lists, pagination, auth status)
- **Templates** consume facades via `async pipe`
- **Signals** are acceptable for purely synchronous UI state (form states, toggles, visibility flags) — convert via `toSignal()` where mixing paradigms

### UI Layer
- SCSS custom styles with semantic class names (no BEM, no CSS framework)
- View Encapsulation handles scoping — no need for namespace prefixes
- Implement exactly from Figma designs when provided
