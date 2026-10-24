# Background research and design handoff

**Design only, not implementation or an art approval.** Character verification → pair-interaction verification → background implementation is the requested sequence.

- `CANONICAL-SCENE-RESEARCH.txt`: Korean research, observed features vs inference, official and secondary sources, limitations.
- [reference-manifest.json](reference-manifest.json): external source URLs and hashes only. Reference media is excluded from this public export and is not approved for production use.
- `selector-design.md`: selector, state isolation, rendering/contrast, theme, safe anchors, loading, performance and source/approval architecture.
- `acceptance-tests.md`: exact future acceptance matrix and required PASS/FAIL/BLOCKED/NOT RUN record.

## Short decision

Keep `기본 들판 · 앱 배경` and a distinct `배경 없음`. Future selectable scene IDs: `open-field-ep06`, `cave-meal-ep05`, `sleepover-ep24`. Official stills confirm field texture, cave wall motif and bedding composition—not complete clean room/landscape assets. Existing reference stills contain characters and are not approved runtime backgrounds. Do not invent horizons, windows, furniture layouts or new character interactions.

Use independent `jlpt-background-preferences-v1` storage. Background/theme must not alter vocabulary, individual character visibility, pause, beta or pair state. Opaque text surfaces, static scenes, native controls and explicit decode failure fallback are mandatory. Character images retain their original colors and proportions. Mobile keeps its current dock rather than forcing a room panorama behind all characters.

## Stage exit / remaining inputs

Research/design complete. Source-code files unchanged in this research stage; no image generation, implementation, browser global changes or deployment performed. Acceptance tests are specifications, not passing run results.

Before implementation: re-inspect then-current app/engine, finish character and pair verification, obtain a suitable authorized artwork path, review candidate crops/contact anchors, and approve exact scene assets. Source availability is not reuse permission. A verified authentic scene and a UI-authored composition must remain separately labelled.
