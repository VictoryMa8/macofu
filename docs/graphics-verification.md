# Graphics overhaul verification

## Geometry simplification — November 1, 2026

The playable scene now uses simple code-authored solids instead of the previous assembled models. Smooth welded belts replace the repeated rollers; a two-link worker replaces the folded arm; a single cabinet shell with a flush shutter replaces the intersecting doorway pieces. Camera, sprite pivots, and projected parcel paths remain shared. The cabinet now faces the learner, and its new approach anchor keeps both delivery routes on the belt. Silver, graphite, cobalt, and amber distinguish machinery from orders. Image-content hashes prevent stale sprites from being stretched into new bounds.

- The local app built and ran at `http://127.0.0.1:5094`. The existing NU1900 vulnerability-service warning remains; compilation succeeded.
- `node scripts/verify-factory.mjs` passed export sizes, pivots, authored geometry, content hashes, distinct physical states, queue hit areas, all travel anchors, reduced motion, preference changes, and reset cancellation.
- `MACOFU_TEST_URL=http://127.0.0.1:5094 node scripts/smoke-test.mjs` passed both missions, order identity, receipts and lookups, queue capacity, source inspection, and restart.
- Browser verification at 1280 × 900 completed Rush hour after a failed direct write, a route change, three Enter submissions, and database recovery. All three parcels stayed separate on the queue lane. The open cabinet and worker state were exercised during saving. Source code remained beside the operable factory.
- At 390 × 844, the page and document widths were both 390px. Factory navigation brought database and worker controls fully into view after smooth scrolling settled. Enter started the worker and the missing-order lesson reached “The missing order is saved.”
- All scene image elements loaded, and browser warning/error logs were empty in the final verification. The local lab was returned to the opening Rush hour workspace.
- `git diff --check` and both JavaScript syntax checks passed.

`screenshots/clean-factory-desktop.jpg` is the actual revised desktop lesson. `screenshots/clean-factory-geometry.png` is a composite of the exported assets that shows the new geometry with three queued parcels.

## Previous model-based overhaul

Verified November 1, 2026, against the local ASP.NET app at http://127.0.0.1:5080/.

- `dotnet build`: succeeded, zero errors. NuGet emitted NU1900 warnings because its vulnerability service index was unavailable, including during a retry outside the sandbox. No project audit setting was changed.
- `node scripts/smoke-test.mjs`: all checks passed. Both missions, exact protected/target identities, original 202 receipts, SQLite lookups, bounded queue, control validation, allowlisted executing sources, retained journey events, and restart passed. The smoke test ended at Rush hour; browser testing subsequently left a fresh second mission.
- Final `scripts/assets/render.py` rerun from the documented environment completed successfully, followed by passing asset and motion checks.
- `node scripts/verify-factory.mjs`: passed PNG/manifest dimensions, 2x resolution, retained source models, finite pivots, station connections, distinct queue-parcel hit areas, reduced-motion travel, preference changes during travel, and cancellation on reset. The tests execute the actual animation function with a deterministic clock.
- Browser, desktop 1280 × 720: completed Rush hour with one click, one pointer drag, and one Enter submission. The drag increased protected/queued count by exactly one. Paused the worker, restored the database, observed all three orders waiting, resumed, and verified completion and matching saved identities. Direct requests also showed actual 503 rejection and 201 success.
- Continued using Mission 02. Opened the reported order's live inspector at HTTP 404, inspected executing worker, database, API, and queue source, resumed the worker, and observed that same order at HTTP 200 while the receipt remained HTTP 202. Completed mission two.
- Queued parcel buttons opened their matching order journeys after alpha cropping removed overlapping hit regions. Opened/closed source inspection, expanded the journey Events and Request log, and used the order inspector throughout delivery.
- Sent an order and restarted during visible flight: active parcel count changed from 1 to 0 and a new target order appeared. Submitted and switched missions during flight: active count returned to 0, with fresh mission state.
- Keyboard: Enter submitted an order, Tab reached Queue from Direct, and focus had a visible 3px outline. Controls remain native buttons.
- Mobile: tested the actual app inside a 390 × 844 iframe, because the browser tool's viewport override did not take effect. The page's client and scroll widths were both 390. Orders, Route, Queue, Worker, and Database navigation each brought their controls within the narrow viewport, including vertical access. Captured `factory-mobile.png`.
- Reduced motion: used a temporary development fixture forcing the app's media preference and the corresponding CSS media rule. Submission and completion showed zero travel parcels and zero confetti, with CSS animation disabled. Native OS preference emulation was unavailable; this was a simulated preference, supplemented by deterministic motion tests. All temporary fixtures were removed.
- All displayed image elements loaded. Both power states and robot poses were exercised. No missing-asset or other console warnings/errors were observed. No illustrated SVG machine remains in the playable scene; the brand mark and code-drawn route overlay are retained.
- Exports were loaded with no rendering job active; Blender is not needed by the app or its build. Source models, texture dependency, original CC0 license, official URLs, archive checksum, and actual package count (143 GLBs versus 140 listed by the publisher) are retained.

Screenshots: `screenshots/factory-before.png`, `screenshots/factory-after.png`, `screenshots/factory-mobile.png`, `screenshots/rush-hour-complete.png`, and `screenshots/missing-order-complete.png`.

Grounding shadows are shared in the static floor across robot/power states. The app remains the deliberately local, shared, in-memory-queue lab described in README. No backend semantics changed.
