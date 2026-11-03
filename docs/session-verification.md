# Independent learner sessions

Verified locally on November 2, 2026.

Each browser's cookie selects a separate `Lab`, queue, mission state, event history, and SQLite connection. Requests hold a lease so idle cleanup cannot dispose a factory during an active request. The background worker visits each factory and obeys its own pause and database controls. Reloads and tabs share the browser cookie. Unknown and expired cookies receive a fresh server-generated identity.

`node scripts/smoke-test.mjs` passed both lessons, including exact-order completion, receipt and journey retention, bounded queues, and restart. The test now retains its own cookie rather than using global state.

`node scripts/session-test.mjs` passed:

- Two browsers receive distinct random HttpOnly, SameSite=Strict cookies; lab responses use `Cache-Control: no-store`.
- Route and worker controls, queued orders, mission selection, database recovery, and completion stay isolated.
- An order ID from another factory returns 404 from both order lookup and journey inspection, before and after delivery.
- Restarting one factory preserves the other's saved orders, evidence, and progress.
- Concurrent submissions and another learner's mission switch remain isolated.
- A new client retaining the same cookie sees the existing factory, without receiving another identity.
- Health checks, source inspection, and the lesson HTML do not issue session cookies.
- HTTPS forwarded by Fly results in Secure cookies. The cookie policy uses the protocol header documented in [Fly's request headers](https://docs.fly.io/networking/request-headers); it does not use that header to authorize access.

`node scripts/session-lifecycle-test.mjs` passed against a temporary server configured for two factories and a two-second idle timeout:

- Capacity returns 503 with Retry-After and preserves existing factories.
- Expired factories release capacity; their former cookie cannot recover old orders or journeys.
- Regular requests keep an active factory's identity and controls intact while other factories expire.
- Health checks and source inspection remain available at capacity.

A browser walkthrough completed Accepted, but missing, reloaded the page, and confirmed the saved-order completion remained. A second tab without a mission query opened the same completed factory. No browser warnings or errors were observed. Independent browser identities and cross-factory behavior were checked through the HTTP tests above.

The Debug build, Release publish, factory asset/motion checks, JavaScript syntax checks, and `git diff --check` passed. The Debug build reported NU1900 because the sandbox could not reach NuGet's vulnerability feed; compilation succeeded. Docker packaging was updated to include `LearnerLabs.cs`, and Fly health checks now use `/healthz`. A container build was not run because the local Docker daemon was unavailable. These changes have not been deployed.
