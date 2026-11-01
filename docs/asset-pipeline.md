# Factory asset pipeline

The playable factory uses simple 3D geometry authored in `scripts/assets/render.py` and rendered into ordinary transparent PNGs. ASP.NET serves the committed exports in `wwwroot/assets/factory/`; running and building the app requires no renderer, graphics service, JavaScript package install, or 3D engine.

The earlier Kenney Factory Kit sources and their CC0 license remain in `assets/kenney-factory-kit/` as provenance for the previous scene. The current scene does not import those models. Its belts are welded meshes, and the scanner, worker, cabinet, and parcel are beveled solids with explicit dimensions. No generated images are used.

## Regenerate

With Python 3.13 on a platform supported by Blender's official `bpy` wheels:

```sh
python3.13 -m venv /tmp/macofu-render
/tmp/macofu-render/bin/pip install -r scripts/assets/requirements.txt
/tmp/macofu-render/bin/python scripts/assets/render.py
```

Alternatively, use Blender 5.2.3 LTS with Pillow available in its Python environment:

```sh
blender --background --python scripts/assets/render.py
```

The verified export environment was macOS arm64, Python 3.13, `bpy` 5.2.3 LTS, and Pillow 13.0.0. Blender's native module needed execution outside the Codex filesystem sandbox on this machine. The normal app runs independently. All rendering settings and world positions are in `scripts/assets/render.py`, with exact dependency versions in `scripts/assets/requirements.txt`.

The renderer uses a fixed orthographic camera at `(9, -14, 14)`, looking at `(0, -0.5, 0.3)`, orthographic width 12.6, a 7 m area light at `(-3, -4, 9)` with energy 650, ambient fill, Standard color management, and Cycles CPU at 64 samples with denoising. It exports 2080 × 1240 RGBA PNGs for a logical 1040 × 620 canvas. Silver housings, graphite belts, cobalt details, and amber parcels sit on one neutral floor slab. sRGB material colors are converted to linear values before rendering to prevent washed-out highlights. Red and green appear only on the cabinet's power indicator; the adjacent HTML status also names the power state.

The conveyor is one continuous welded mesh per layer, with exposed boundary faces around the branch, return path, and central opening. It has no repeated rollers or overlapping module end caps. The scanner has two posts and one crossbar. The worker uses two separated arm links and a small gripper. The storage cabinet has one shell and a flush shutter that opens for its online state; no separate doorway models intersect. Parcels have one tape strip. Keep small mechanical details out of these models so their silhouettes remain legible at lesson size.

Grounding shadows are baked into the common floor using camera-invisible copies of the stations in their resting poses. Station sprites have transparent backgrounds and no duplicate floor shadow. CSS adds no shadow. Working and power states share those grounding shadows. Alpha cropping keeps four physical pixels of padding around each sprite silhouette, making parcel hit areas distinct. The manifest records each cropped image's dimensions, logical size, and ground pivot, so different poses can change bounds without jumping. No object is stretched to fit a UI box.

Every manifest image URL includes a hash of that PNG's contents. The scene loads its floor and parcel animation texture from the same manifest as the machines. This prevents an older cached PNG from being stretched into a newer export's bounds. Regenerate the images and manifest together.

## Add or change an asset

1. Define the asset using the renderer's `box`, `cylinder`, and `link` helpers, or add a simple manifold mesh. Keep surfaces separated and avoid unnecessary seams, repeated details, and coplanar panels.
2. Add an `export(...)` call in `scripts/assets/render.py`. Use world-space metres, the existing camera and scale, and a ground anchor. Add reusable state names and entrance/exit coordinates to the manifest generation. Each export records its constituent geometry names; `sourceModels` is empty for code-authored assets.
3. Run the regeneration command. Commit the source, renderer, manifest, and PNG exports together.
4. Use `factory.sprite(...)` in `wwwroot/scene.js` to place the new sprite. Connections and travel routes must use projected manifest anchors. Adjust station controls independently of the ground pivots; never move artwork alone to repair a parcel path.
5. Inspect desktop, mobile station navigation, keyboard focus, reduced motion, and transparent-image loading. Run the existing backend smoke test. Check that state changes and restarts interrupt travel correctly.

`scene.js` is a small DOM asset layer; `app.js` retains server requests, mission state, inspectors, and interruptible animation. Parcels travel only for real receipts and observed SQLite inserts. Station controls and mission progress do not wait for travel. The queue is deliberately in memory and the database outage remains injected write failure.

Before/after screenshots are in `docs/screenshots/`. Verification notes are in `docs/graphics-verification.md`.
