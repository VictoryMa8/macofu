# Agent prompt: overhaul Macofu’s game graphics with a reusable asset kit

Implement this in `/Users/victoryma/Repositories/macofu`. Complete the graphics overhaul and verify it in the browser. This is an implementation task, not a request for another plan or mockup.

## Goal

Replace the current hand-authored SVG factory illustrations with a cohesive factory scene built from professionally authored game assets. Establish an asset pipeline we can reuse for future Macofu games.

The agreed approach is to trial **Kenney Factory Kit**, render its 3D models into 2D sprites using one consistent camera, lighting setup, and material palette, and integrate those sprites into the existing browser game. Keep the game itself 2D; a full 3D engine is unnecessary for this task.

Official source: https://kenney.nl/assets/factory-kit

The publisher currently lists the kit as 3D, with 140 files and a CC0 license. Verify the actual downloaded package and its included license. Obtain assets from the official publisher, preserve the license and provenance, and do not purchase anything or use a third-party re-upload. Do not silently substitute a different art style or pack if a download or rendering dependency is blocked; report the specific blocker after completing unaffected preparation.

## Read and inspect first

- `/Users/victoryma/Repositories/macofu/README.md`: current missions, controls, backend behavior, and verification.
- `/Users/victoryma/Repositories/macofu/docs/discovery.md`: user feedback and product direction.
- `/Users/victoryma/Repositories/macofu/docs/prototype-brief.md`: historical context; some sections describe an earlier prototype.
- `/Users/victoryma/Repositories/macofu/wwwroot/index.html`
- `/Users/victoryma/Repositories/macofu/wwwroot/style.css`
- `/Users/victoryma/Repositories/macofu/wwwroot/app.js`
- `/Users/victoryma/Repositories/macofu/Lab.cs`
- `/Users/victoryma/Repositories/macofu/Program.cs`

Inspect the running app at http://127.0.0.1:5080/ if available, or start it using the README. Capture the existing scene before editing. Inspect available rendering tools, including whether Blender is available, before choosing the export workflow. Use supported, permitted tooling and make asset generation reproducible.

## Visual direction

Create a small, tangible factory with consistent perspective, scale, lighting, and grounding shadows. Aim for a coherent game world assembled from modular machinery, conveyors, parcels, and storage, rather than a row of disconnected icons. Use an orthographic three-quarter camera and keep object silhouettes legible at the sizes used in the browser.

Retain the current site palette:

- Burgundy `#780000`
- Red `#c1121f`
- Cream `#fdf0d5`
- Navy `#003049`
- Blue `#669bbc`

Use these as the material and interface palette, allowing shading and tonal variations needed for dimensional artwork. Keep the cream website background and readable navy text. Preserve the current brand mark and restrained interface unless a small adjustment is needed to fit the scene.

The user explicitly dislikes excessive subtitles, small explanatory captions, marketing language, and repeated instructions. Preserve the recent copy cleanup. Keep objectives, controls, and useful operational state visible; keep explanations inside Hint, Inspect order, Code, and expandable logs. Do not add decorative section labels, tutorial cards, or more prose to explain the new graphics.

Use the pack’s actual models. Inspect the available pieces and choose appropriate physical representations for:

- API: an intake, scanner, or processing machine.
- Queue: a visibly accumulating buffer of parcels.
- Worker: a robot arm or processing machine with clear paused and working states.
- Database: a storage or output station with clear online and offline states.
- Requests/orders: parcels that travel along connected routes.

The factory metaphor must remain understandable. Keep short functional names and accessible controls so learners can identify the API, queue, worker, and database. Avoid arbitrary machinery or decoration that obscures the request paths.

## Asset pipeline

1. Download and inspect the official kit. Retain the source models needed to reproduce the scene, together with the license and source URL.
2. Create a repeatable render/export script or configuration. Prefer Blender if available and suitable. Record the render-tool version, camera, lighting, material mapping, resolution, and export settings.
3. Export transparent PNG or WebP sprites at sufficient resolution for high-density displays. Keep consistent ground anchors, scale, and padding. If trimming images, preserve pivot offsets so animations do not jump. Keep shadows consistent and avoid duplicate shadows during compositing.
4. Add a small asset manifest identifying source models, sprite files, dimensions, ground/pivot anchors, connection points, and available visual states. Use reusable asset names, not mission-specific filenames.
5. Serve the exported sprites as ordinary static assets. Running or building the ASP.NET app must not require Blender or an asset-generation service.
6. Document one command/workflow for regenerating the sprites and adding a new asset in `/Users/victoryma/Repositories/macofu/docs/asset-pipeline.md`.

Do not use ImageGen, newly invented SVG machinery, or AI-generated 3D models as a substitute for the asset kit. Normal code-drawn connectors, selection outlines, status indicators, and layout primitives are fine. The machinery and world artwork must come from the authored asset library.

## Integration requirements

Retain ASP.NET, plain JavaScript, and CSS. Do not introduce React, a new game engine, a build-system migration, or a backend rewrite just for this overhaul. Prefer sprites in the existing DOM with lightweight animation unless the implementation demonstrates a concrete need for something else.

Refactor the scene’s positions and travel paths around asset anchors so parcels meet machine entrances and exits. The current illustrations and animations use hardcoded coordinates; replacing images without fixing those connections is insufficient. Keep this a small scene configuration and asset layer, not a general-purpose game framework.

Preserve every existing interaction:

- Click or drag a parcel into the API; one drag submits exactly one order.
- Select direct writes or queueing.
- Pause/resume the worker and toggle the database outage.
- Inspect machines, queued parcels, and order journeys; open the actual source files.
- Switch missions, restart the selected mission, and continue from mission one to mission two.
- Use keyboard controls and narrow-screen navigation; respect reduced-motion preferences.

Keep semantic HTML controls and clear focus states. Decorative sprites should not duplicate accessible labels. Provide meaningful state through more than color alone. Avoid page-wide horizontal overflow; if the scene needs horizontal scrolling on mobile, retain useful navigation to each station.

All progress must continue to come from server state. Parcel animation must follow real request outcomes and observed inserts, remain interruptible on reset/mission switching, and never delay backend processing or lock controls until an animation finishes.

## Preserve both missions

**Rush hour:** the database starts offline. Accept three orders through the queue during the outage, then deliver those exact orders after recovery. Ordinary direct writes cannot substitute for the protected orders.

**Accepted, but missing:** the database starts online, the worker paused, and one real order already queued with a `202` receipt. Complete the mission only when that exact order reaches SQLite. The inspector must retain the original `202` receipt while its database lookup changes from `404` to `200`.

The existing queue is deliberately in memory, and the database outage is fault injection. Preserve these semantics and the prototype’s local, shared-state behavior.

## Verification and delivery

- Build the project and run `/Users/victoryma/Repositories/macofu/scripts/smoke-test.mjs` against the running app. It resets the shared lab and finishes at mission one.
- Walk both missions through to completion in the browser. Verify drag/click submission, controls, source inspection, live order evidence, mission switching, and restart during parcel movement.
- Inspect desktop and mobile layouts, keyboard interaction, reduced-motion behavior, missing asset requests, and browser console errors.
- Confirm the exported graphics load without the rendering tools running and no old illustrated-machine fallback remains in the playable scene.
- Deliver the integrated scene, reusable sprites and manifest, selected source assets and license, reproducible render workflow, and brief pipeline documentation.
- Save before/after screenshots and show the finished scene in the final response. State what was verified and any concrete limitations. Leave a fresh second mission ready to play.

Proceed with reasonable implementation decisions. Do not stop after downloading a pack or showing a concept image. Finish a playable overhaul that proves this asset approach works for Macofu.
