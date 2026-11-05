# Macofu

Macofu means **Make coding fun again**: hands-on learning across full-stack software engineering. The home page presents that vision and the ambition for 20+ modules, with the order dispatch factory clearly identified as the first playable module. Its full-stack illustration is separate from the learner's lab. The module library at `/modules.html` groups content into Frontend, Backend, Data, and Cloud & DevOps. Backend contains the playable order dispatch factory; other areas are explicitly planned. Category links support direct URLs such as `/modules.html#data`, keyboard navigation, and browser history. The playable lessons live at `/lesson.html`; a `mission=rush-hour` or `mission=missing-order` query selects a part, preserving progress when that part is already selected.

Two playable backend missions in one order dispatch factory. **Rush hour** starts with a database write outage: accept three orders without the database, then deliver those same orders after recovery. **Accepted, but missing** starts with a customer’s `202 Accepted` receipt and no saved order. Explain the delay from the factory evidence, then save and verify the same order.

Live demo: [macofu.fly.dev](https://macofu.fly.dev/).

## Run

Requires .NET SDK 10.

```sh
 dotnet run --urls http://127.0.0.1:5080
```

Open http://127.0.0.1:5080.

Pushes to `main` automatically test and deploy to Fly.io. See the [deployment workflow](https://github.com/VictoryMa8/macofu/actions/workflows/fly.yml) for release status and [deployment](docs/deployment.md) for setup and manual commands.

Choose either lesson part using the navigation. Each part opens with a prominent scenario and objective; **Start lesson** reveals the factory and its current action. Rush hour walks through a failed direct write, choosing a waiting line, accepting three orders, and saving them after recovery. The learner chooses when to continue from the failure and from acceptance to saving. Switching parts starts a fresh lab; selecting the current part leaves its progress alone. **Help & tools → Restart this part** restarts the selected part and returns to its introduction.

- Click the parcel or drag it into the API to submit a real order.
- Choose **Change route** above the factory, then **Direct to database** or **Via queue**. The selected route stays visible after the choices close.
- Toggle database power and pause/start the worker to see which dependencies matter.
- Protect three orders during the outage, then deliver them to complete the challenge.
- Inspect machines or choose **Source code** beside **Factory** to see the actual C# source.
- In part two, **Inspect customer order** compares the original receipt and a live database lookup. Use the factory state recorded when that order arrived to explain the delay. After the worker saves it, choose **Verify saved order** to look up the same purchase order and complete the part.
- Queue parcels and the order list in Request history also open journeys. Select a journey stage to inspect its source. Expand **Request details and events** for the request path and the order’s log.

The default workspace shows the factory and one action card. **Help & tools** opens one supporting feature at a time: **Help with this step**, **Lesson progress**, **Factory guide**, or **Request history**. Full progress counts and completion states live in Lesson progress; the action card shows counts while accepting or saving orders. Database and worker status appear on their machines. Connection status appears only if the connection fails.

On desktop, **Source code** gives code the larger half of the workspace, beside an operable factory. It uses 14px type, a tall scrolling area, and preserved indentation. **Factory** returns to the lesson view. On narrow screens, guidance appears before the factory; use the factory navigation buttons or scroll the scene horizontally. All controls work with a keyboard; dragging is optional. Reduced-motion preferences remove parcel travel.

Future lessons should follow the beginner-first design rules in [AGENTS.md](AGENTS.md).

## What is real

ASP.NET handles each request. Direct writes return `201` after a SQLite insert, or `503` when the injected write outage is active. The queued route returns `202`, holds an order in an in-process queue, and a background worker inserts it into SQLite when both the worker and database are available. Full queues return `429` without accepting work.

The server tracks the first three orders accepted during the outage. Completing the challenge requires those exact orders to reach SQLite; turning the database on and making ordinary direct writes does not count. Failed requests can be retried without a lives or timer penalty.

Mission two begins with the queued route, an online database, a paused worker, and one real accepted order. The server checks the explanation and verifies that exact order against SQLite when the learner asks. Its receipt stays `202` after delivery, while the order lookup changes from `404` to `200`. Per-order events retain the opening factory state even after the general request log rolls over, so learners can investigate after starting the worker. Restart clears both goals and creates a new reported order.

Parcel movement is immediate visual feedback around actual requests and observed inserts. It does not delay the backend or block new actions. Counters and challenge progress come from server state. The source inspector loads the files used by the running app.

## Prototype boundaries

Each browser receives a private factory through a random, server-issued HttpOnly cookie. Orders, queue, SQLite database, controls, evidence, and mission progress are isolated from other browsers. Reloads and tabs in the same browser share that factory; switching parts or restarting affects only it. A separate browser profile or private browsing session gets another factory. No account is required. Blocking cookies prevents progress from being retained between requests.

Factories expire after two hours without lab API requests. An open lesson polls the API and keeps its session active. Expiration, clearing cookies, or an application restart begins a fresh factory; progress is not durable. Each factory uses an in-memory SQLite database and queue, not a durable broker. The database write outage is deliberate fault injection, not a disconnected cloud service; SQLite reads used by the inspector remain available. Restart clears only the current factory's orders and progress.

The server defaults to 1,000 simultaneous factories and rejects new sessions with HTTP 503 when full, preserving existing learners. Idle factories release their database connections. Configure `LearnerSessions__IdleTimeout` (for example `02:00:00`) and `LearnerSessions__MaxSessions` to adjust these limits. Hosting health checks use `/healthz`, which does not create a session.

The factory artwork uses simple code-authored 3D geometry: smooth conveyor belts, a scanner arch, a two-link worker arm, and a single storage cabinet. It is rendered into static 2D sprites with shared camera and connection anchors. See [asset pipeline](docs/asset-pipeline.md) for geometry, regeneration, and adding assets. The previous Kenney model sources and their CC0 license remain in the repository for provenance.

The first version used an icon diagram and prediction quiz. Rush hour replaces that interaction with a concrete routing puzzle, tactile parcels, a queue rack, a delivery worker, and a warehouse. Learning effectiveness and enjoyment still need testing.

## Verify

With the server running:

```sh
node scripts/smoke-test.mjs
node scripts/session-test.mjs
node scripts/session-lifecycle-test.mjs
node scripts/verify-factory.mjs
```

The smoke test creates its own browser session. It checks both missions, direct-write failure, queued acceptance, pause/resume, recovery, exact order identity in completion, direct-write success, queue capacity, invalid controls and missions, source allowlisting, diagnosis, explicit verification, journey evidence and retention, and restart. It finishes its factory at the opening Rush hour puzzle.

The session test checks two independent browsers, cross-session order and journey access, independent workers and progress, isolated resets and mission switches, and shared-cookie reload/tab continuity. The lifecycle test starts a temporary server from `bin/Debug/net10.0/Macofu.dll` (override with `MACOFU_TEST_DLL`) to verify expiration, capacity recovery, and active-session retention without changing the running app's settings.
