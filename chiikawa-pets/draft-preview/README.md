# DRAFT: one-character motion lab

Run `python build_preview.py` from the repository, then open
`치이카와_동작_초안.html`. This is self-contained and separate from both the
vocabulary app and the published docs. Production approval validation is not
bypassed: this lab uses its own draft renderer and only the tested pure timing
helper. It never invokes the production mount/manifest resolver.

The original generated PNG sheets are copied byte-for-byte into `assets/`.
The renderer uses rectangles, per-frame pivots and uniform scaling, not raster
edits, warping, mirroring, tweened limb deformation or repeated copies posing as
new drawings. `config.json` remains `approvalStatus: draft`.

Current visible art:
- 4 front-facing contact/passing keyposes, not a smooth 12-frame cycle.
- 3 held poses alternating actual arm/leg drawings, plus a relaxed release pose.
- 4 landing keyposes: contact, bent legs, balance, neutral; still draft artwork.

Controls: play/pause, frame step, optional sideways project maintainer translation, lift,
release and safe reset. Mouse/touch can drag the character itself; Escape
safely puts it down. Enter toggles lift/release. The prototype drag target alone
uses `touch-action:none`; the surrounding page scrolls normally. Reduced motion
stops automatic loops/falls and allows manual pose inspection. Hide/resize/cancel
resets safely. `window.draftPreview.getState()` exposes read-only diagnostics.

Foot/project maintainer pivots were initially aligned from alpha bounds, not measured anatomical
contacts. There is still body/face variation, and the 4-pose cadence is visibly
coarse. Sideways translation is only a contact test of front-facing artwork,
not evidence of correct side-facing walk animation. Reversal never flips art.

Required visual QA: crops cannot include neighboring sprites; both walking rows
must share a baseline; held poses must keep a stable torso/grab anchor; switching
sheets must not jump outside the stage; cancellation must not throw; actual
mobile scrolling and pointer capture need browser testing. This lab does not
read/write study data or localStorage and does not approve these illustrations.

Uniform per-sheet calibration: walk 1.00, held 1.08, landing 0.99. Based on
approximate head/torso widths of 489px / 451px / 495px; no per-frame scaling
or anatomical warping. Held expression and body shape still differ slightly.
