# Factory asset pipeline

The playable factory uses Kenney Factory Kit 3.0 models rendered into ordinary transparent PNGs. ASP.NET serves the committed exports in `wwwroot/assets/factory/`; running and building the app requires no renderer, graphics service, JavaScript package install, or 3D engine.

The selected original GLBs, their texture, the included CC0 license, official URLs, and archive checksum live in `assets/kenney-factory-kit/`. See its `PROVENANCE.md`. The official package was inspected: 143 GLB models, with OBJ and FBX alternatives. No AI-generated artwork is used.

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

The renderer uses a fixed orthographic camera at `(9, -14, 14)`, looking at `(0, -0.5, 0.3)`, orthographic width 12.6, a 5 m area light at `(-3, -4, 9)` with energy 1250, ambient fill, Standard color management, and Cycles CPU at 24 samples with denoising. It exports 2080 × 1240 RGBA PNGs for a logical 1040 × 620 canvas. Flat-color source swatches map to the site's burgundy, red, cream, navy, and blue, retaining authored UVs and geometry. The floor uses cream tonal variations.

Grounding shadows are baked into the common floor using camera-invisible copies of the stations in their resting poses. Station sprites have transparent backgrounds and no duplicate floor shadow. CSS adds no shadow. Working and power states share those grounding shadows. Alpha cropping keeps four physical pixels of padding around each sprite silhouette, making parcel hit areas distinct. The manifest records each cropped image's dimensions, logical size, and ground pivot, so different poses can change bounds without jumping. No object is stretched to fit a UI box.

## Add or change an asset

1. Obtain its GLB from the official package, retain the original under `assets/kenney-factory-kit/models/`, and retain any relative texture dependency. Update provenance if using a different package version.
2. Add a `model(...)` and `export(...)` call in `scripts/assets/render.py`. Use source-model metres, the existing camera and scale, and a ground anchor. For articulated models set the authored joints' Euler rotation mode explicitly before posing them. Add reusable state names, source model names, and entrance/exit coordinates to the manifest generation.
3. Run the regeneration command. Commit the source, renderer, manifest, and PNG exports together.
4. Use `factory.sprite(...)` in `wwwroot/scene.js` to place the new sprite. Connections and travel routes must use projected manifest anchors. Adjust station controls independently of the ground pivots; never move artwork alone to repair a parcel path.
5. Inspect desktop, mobile station navigation, keyboard focus, reduced motion, and transparent-image loading. Run the existing backend smoke test. Check that state changes and restarts interrupt travel correctly.

`scene.js` is a small DOM asset layer; `app.js` retains server requests, mission state, inspectors, and interruptible animation. Parcels travel only for real receipts and observed SQLite inserts. Station controls and mission progress do not wait for travel. The queue is deliberately in memory and the database outage remains injected write failure.

Before/after screenshots are in `docs/screenshots/`. Verification notes are in `docs/graphics-verification.md`.
