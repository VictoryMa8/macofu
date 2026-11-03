# Deploying Macofu

Live demo: https://macofu.fly.dev/.

The Docker image runs the ASP.NET app, background worker, SQLite store, frontend, and source inspector together. It uses Microsoft's .NET 10 images and runs as the unprivileged `app` user. The build context includes only the app's source and web assets; local lab data and developer files are excluded.

## Fly.io

The configured app is `macofu` in the `personal` organization. Pushes to GitHub's `main` branch now run [Deploy to Fly.io](https://github.com/VictoryMa8/macofu/actions/workflows/fly.yml). The workflow checks the factory assets and motion, builds the app, and smoke-tests both lessons in an isolated local lab before deploying that commit. It then compares every live web asset and all four source-inspector files with the checked-out commit and checks the lesson API. Production verification uses read-only requests.

The workflow serializes deployments, keeps the existing single-machine configuration, and tags each image `git-COMMIT_SHA` with an `org.opencontainers.image.revision` label. A failed check stops the deployment. The Actions page shows whether a push has finished going live. The workflow can also be run manually on `main`.

GitHub Actions authenticates through the repository's `FLY_API_TOKEN` Actions secret. It is scoped to the `macofu` app and expires after one year. To rotate it, use the existing Fly login and pipe a newly created token directly into GitHub's encrypted secret store without displaying or saving its value:

```sh
set -o pipefail
fly tokens create deploy --app macofu --name 'GitHub Actions macofu' --expiry 8760h | gh secret set FLY_API_TOKEN --app actions --repo VictoryMa8/macofu
```

To deploy manually, sign in using `fly auth login`, then run:

```sh
fly deploy --app macofu --remote-only --ha=false
fly status --app macofu
```

To host a separate copy in another account, create a new app and use its returned name:

```sh
fly apps create --generate-name
fly deploy --app YOUR_APP_NAME --remote-only --ha=false
```

The `--ha=false` option creates one application machine. Keep one machine: learner sessions, queues, and progress live in that process, with a separate in-memory SQLite database for each factory. An application restart loses all sessions. An idle machine stops automatically and starts again on the next request, beginning fresh labs. A separate persistent database or volume is not needed for this demo. Multiple application instances would require shared session storage or routing each learner consistently to the same instance.

The configuration uses HTTPS, Chicago, one shared CPU, and 512 MB of memory. Hosting usage is billed by Fly.io under the account's current plan; stopping an idle machine reduces running time.

## Demo behavior

Each browser has its own factory, including its orders, database, queue, controls, mission progress, and request evidence. A random HttpOnly, SameSite=Strict cookie identifies the factory; HTTPS connections use Secure cookies, including HTTPS forwarded by Fly Proxy. Tabs in the same browser share a factory. Restart and mission changes affect only that browser. There are no accounts and progress is not durable.

Factories expire after two hours without lab API requests; open lessons keep their sessions active by polling. Idle cleanup disposes the factory's SQLite connection. The default limit is 1,000 factories; new sessions receive HTTP 503 with Retry-After when full, while existing sessions continue. Override with `LearnerSessions__IdleTimeout` and `LearnerSessions__MaxSessions`. `/healthz` and source inspection do not create factories; Fly health checks use `/healthz` to avoid allocating idle sessions.

## Verify a deployment

```sh
node scripts/verify-deployment.mjs
```

This checks that the live app matches the local checkout. To exercise both lessons against production explicitly:

```sh
MACOFU_TEST_URL=https://macofu.fly.dev node scripts/smoke-test.mjs
MACOFU_TEST_URL=https://macofu.fly.dev node scripts/session-test.mjs
```

The tests exercise their own learner factories; restarts do not affect other visitors. The session test verifies independent browser identities and factory state. Open the deployment in a browser and check the factory assets, logo, and source inspector as well.

Verified November 1, 2026: the remote container build succeeded, Fly.io reported one running machine in `ord` with its health check passing, and all existing mission smoke checks passed against the HTTPS deployment. The public page rendered the factory and Curiosity Spark logo, and the Code inspector displayed the packaged C# source. The browser reported no warnings or errors. The smoke test left the demo at the opening Rush hour puzzle. See [deployment screenshot](screenshots/macofu-deployed.png).

The beginner lesson UI was deployed later the same day as `deployment-01M6CE6S9CMJCX30X0VBD0ZZTC`. The single `ord` machine is started with its health check passing. Both mission smoke tests passed against production, and browser verification confirmed the expanded introduction, explicit part and goal labels, and source inspector beside the factory. No browser warnings or errors were observed. See the [updated live screenshot](screenshots/lesson-deployed.png).

The progressive lesson revision was deployed as `deployment-01M6CF3M1G83GPB4Z6W73JET8R` on November 1, 2026. It introduces one next action at a time, explicit route choices, a larger code workspace, and contextual lesson options. The remote build succeeded, the single machine's health check passed, and both production mission smoke tests passed. Browser verification confirmed the new guided entry, collapsed optional details, an action-free global header, and the enlarged source inspector without console warnings or errors. See the [live code workspace](screenshots/guided-code-live.png) and [verification notes](lesson-verification.md).

The focused interface revision was deployed as `deployment-01M6CGARF6XRCN3Z5MSZ0SFQ8M` on November 1, 2026. It adds a dedicated introduction before the factory, removes redundant status and decorative copy, and groups supporting features in Help & tools. The remote build, single-machine health check, and both production mission smoke tests passed. Live browser verification confirmed that the factory starts hidden, the default action card has no empty progress, and the aggregate status, hint link, and footer are absent. No browser warnings or errors were observed. See the [live introduction](screenshots/focused-intro-live.png) and [live factory](screenshots/focused-workspace-live.png).

The full-stack landing page was deployed as `deployment-01M6CJJ1FFF07588CK9RVGNWYJ` on November 1, 2026. The remote build and Fly.io machine health checks passed. Read-only HTTPS verification confirmed that the homepage, landing stylesheet and script, lesson page, and lesson script exactly match the workspace files; `/api/state` returned HTTP 200. Browser verification confirmed the full-stack illustration and the first module's entry point, with no console warnings or errors. The existing local factory checks also passed. See the [live landing page](screenshots/landing-deployed.jpg).

The module library was deployed as `deployment-01M6CK042H1ARRV04PYARS0R17` on November 1, 2026. It groups modules into Frontend, Backend, Data, and Cloud & DevOps, with the order dispatch factory available under Backend. Homepage navigation now opens the library, and lessons link back to it. The remote build and machine health checks passed. Live HTML, styles, scripts, and lesson navigation matched local source exactly. Browser checks verified category selection, direct links, browser history, keyboard access, both lesson entry points, and layouts down to 320 pixels; the live page reported no console warnings or errors. See the [deployed module library](screenshots/modules-deployed.jpg).

## Local container

```sh
docker build -t macofu .
docker run --rm -p 8080:8080 macofu
```

Open http://localhost:8080.
