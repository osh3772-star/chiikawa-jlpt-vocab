# 실제 치이카와 배경 선택 — 구현 전 설계

Status: DESIGN ONLY. No app code, art, browser settings, or deployment changed.
Prepared 2026-10-24 UTC. Source inspection baseline HEAD: `8801a392d64b3aa1c0b766c0e438752a6da0ebf8`; working tree is active and must be re-inspected before implementation.

## 1. Decision / user promise

Vocabulary comes first. Give the user a quiet, persistent choice of setting, not a second character engine. Keep the current app-made meadow as the default and add a genuinely plain option. Add canonical settings only when the *particular image*, not merely the location's existence, passes provenance, art, readability and anchor review. No random cycling, unlocks, animated backgrounds, automatic time-of-day changes, or background-triggered character behaviors.

The requested order is binding: finish/verify character work, then pair interactions, then implement backgrounds. This document is not permission to implement or publish now.

**Terminology:** “원작 배경 참고 · 웹용 재구성” means scene-inspired UI artwork; “공식 영상 장면” requires a verified actual source frame and an authorized use path. Do not label reconstructed art an authentic extracted frame. “공식” describes provenance, not affiliation or permission.

## 2. What the current source actually does

- 기존 앱 HTML 템플릿 contains home/review/study, 7,180-word payload, Korean text, and keyboard arrows. Study writes only `jlpt-local-vocabulary-v1`.
- `theme.css` has a light-only palette; fixed `.scenery` at z-index 0, `__MEADOW_IMAGE__` at opacity .42 plus CSS sun/cloud/hills. Header and main are z-index 1. Paper cards are opaque, but header, counts, keyboard hints and status text currently sit directly over the backdrop.
- `build_html.py` embeds the meadow and character images into a self-contained HTML. Reviewed generated HTML was approximately 21.7 MB decimal on disk; do not multiply this with unbounded full-size scene images.
- 기존 앱의 `integration.js` owns independent visibility/pause (`jlpt-pet-visibility-v1`), mobile group (`jlpt-pet-mobile-group-v1`), beta (`jlpt-pet-chiikawa-beta-v1`), mobile dock, evidence panel and limited preview. Respect all of them.
- `pet-engine.js`: desktop ground is viewport bottom minus `floorOffset` (8 px); mobile is each dock slot's bottom; experimental beta has its own stage. Images have transparent margins; element-bottom is not necessarily the visible foot baseline.
- Current obstacle yielding uses opacity .16 and disables pointer events for unheld pets; it is not a guarantee of zero visual overlap. Background work must not silently claim to fix that engine behavior.
- Existing pet layer z-index is 90. Background control must join `avoidSelector`; selector visibility must not require remounting pets.

## 3. Catalogue / eligibility

| Stable proposed ID | Korean option label | Classification | Eligibility now |
|---|---|---|---|
| `default` | 기본 들판 · 앱 배경 | Existing app-designed meadow, not claimed canonical | Existing default only; no new claim about its rights |
| `none` | 배경 없음 | Solid theme canvas, no sun/cloud/hill/meadow | Design ready; characters remain independently selected |
| `open-field-ep06` | 풀밭 | Official ep6 still inspected during research; overhead ground | NOT eligible until authorized art/crop/anchor review |
| `cave-meal-ep05` | 동굴에서 식사 | Ep5 sampled meal; official ep2 wall motif only | NOT eligible until meal view and authorized art review |
| `sleepover-ep24` | 치이카와 집의 잠자리 | Official ep24 bedding still; room-wide layout NOT verified | NOT eligible until authorized art/crop/anchor review |

Authoritative evidence: [CANONICAL-SCENE-RESEARCH.txt](CANONICAL-SCENE-RESEARCH.txt) and [reference-manifest.json](reference-manifest.json). Latest findings supersede the early shortlist: direct official site stills verify ep6 field texture and ep24 bedding composition; ep2 directly verifies the cave wall motif, but **not** the ep5 table. Official ep5 still is outdoors and must not be cited as cave evidence. Source index: https://www.anime-chiikawa.jp/json/episodeHistories.json; official still URLs are recorded in that research report/manifest.

Observed field details: cream/light yellow-green ground, soft green patches, sparse short dark grass strokes, overhead composition. **No sky, horizon, trees, mountains or path are verified in ep6.** Observed sleepover details: gray-lavender night floor, two white scalloped futons and orange bear. **No window or room-wide layout is verified.** Cave meal is inherited sampled ep5 evidence (UI 00:25); cave walls independently corroborated in ep2. Do not splice these shots and claim the resulting camera view is canonical. All available official stills contain characters: none is a cleared empty background.

The table IDs have been reconciled with the research ledger. Canonical existence, exact view verification, permission to reuse, approved art and approved web layout are five separate checks. No candidate is a ready background file today. Labels may be refined to research names “동굴에서 식사” and “치이카와 집의 잠자리”; do not label an inferred house owner as verified for the cave.

First implementation candidate should be the verified field *texture in a bounded decorative area*, because its sparse visual detail best supports quiet study UI. Its overhead view does NOT establish a horizon or a side-on character ground. A neutral existing pet stage must remain visually separate unless later reviewed art resolves this mismatch. Cave and bedding scenes likewise require bounded framing. This priority is a UI inference, not a canonical claim. If no asset qualifies, release nothing new rather than inventing an “actual” background.

## 4. Selector UX

Placement: a compact native `<details>` labelled **배경 설정 · 기본 들판** beside/below the character settings, outside the word card; initially closed. This is a nonmodal disclosure, not an overlay or floating button. Maintain the selected scene in its summary. New control receives a minimum 44×44 px tap area; wrapped layout at 280 px.

Inside:
1. Native `<label>배경</label><select>` with `기본 들판 · 앱 배경`, `배경 없음`, then *eligible* scenes only.
2. Small decorative static thumbnail of the selected scene, not a carousel. `alt=""`; text supplies the option name and provenance category. No unapproved candidate art in production, even as a disabled thumbnail.
3. Native `<select>` labelled `화면 색상`: `시스템 설정`, `밝게`, `어둡게`. Default `시스템 설정` only once complete dark tokens are verified; do not partially enable dark mode during staged work.
4. Short explanation: `배경을 바꿔도 학습 기록과 캐릭터 설정은 그대로예요.`
5. `출처·배경 안내` disclosure containing episode, title, observation time range, source link, art type, credit and adaptation note; no misleading licensing badge.
6. `기본값으로` resets only background ID to default and color mode to system; not study/pet data. Its accessible name is `배경 설정만 기본값으로`.

Changes apply immediately after successful decode; no Apply button. Opening/closing the disclosure does not commit a new value. Native select handles arrows; existing study hotkey guard already excludes `select`, but the whole appearance-settings region should be guarded so arrow keys on its other descendants cannot rate a word. Tab order is natural, focus stays on the initiating control. Escape must not invoke character actions from this region. Summary collapse retains focus on summary when needed. No forced scroll or focus jump on load, success, failure or theme switch.

Status text in a dedicated polite status region, never the vocabulary `#message`: `배경 불러오는 중…`, `풀밭 적용됨`, or `배경을 불러오지 못해 기본 배경을 표시합니다. 다시 시도`. Loading is not announced repeatedly on every resize. Preference-save failure is separate: `이 창에서는 적용되지만 설정을 저장하지 못했어요.`

## 5. State and isolation contract

Proposed key: `jlpt-background-preferences-v1`.
Proposed value (not executable implementation): `{schemaVersion:1, selectedId:"default", colorMode:"system"}`.
Only whitelisted IDs/enums are accepted. Null, arrays, malformed JSON, unknown versions or wrong types recover to defaults without throwing. No URLs, raw CSS or markup may come from localStorage. Read/write in try/catch; denied or quota-full storage leaves session controls functional. Never call localStorage.clear().

Keep `requestedId` (user preference), `effectiveId` (successfully displayed), `loadState`, `requestToken` and resolved theme as ephemeral separate values. An eligible selected scene failing temporarily preserves its requested ID for next visit, displays fallback and a retry button; an obsolete/unrecognized ID resolves to default with one explanatory note, without touching other settings. Do not mutate the selection silently while still displaying a different status.

Rapid A→B→none: increment the token on every choice; discard stale success/error completions; none becomes immediate. At most the latest successful scene is shown; failed B may retain A temporarily during decode, then resolves to default with status. Do not write assets or status strings into storage. Persist only an explicit user choice/reset, not environmental fallback or resize. A same-origin `storage` event may update background only; malformed events are ignored. No cross-origin synchronization promise (file and hosted site differ).

Scene swaps must not reload page, rebuild vocab DOM, change view/level/index, save a word rating, dispatch `vocab:*`, remount the pet engine, reset visibility, resume motion or enable beta/preview.

## 6. Layout, contrast and color

Layer plan: solid canvas → decorative backdrop (aria-hidden, pointer-events none, no tab stops) → optional backdrop-only wash → opaque reading surfaces and controls → existing character presentation. Do not place a tint/filter on body, pet layer, or any ancestor shared by character artwork. No sprite hue, brightness, opacity, scale, warp or mirror changes for theme matching. Pet art keeps original pixels; an independent neutral ground shadow/plate may support contrast only after review.

Preserve current readable widths: home max 1160 px, study max 860 px, existing one-column break at 900 px. Backdrop never determines content width/height. All text-bearing areas, including header storage note, progress/counts/keyboard hint, statuses and selector, must have opaque surfaces; a translucent wash alone is insufficient over arbitrary scene details. No background through the word/reading/meaning/example/translation card.

Suggested UI token bases (to be contrast-measured in final implementation):
- Light canvas `#F3F5EF`, surface `#FFFDF7`, text `#302D2A`, secondary `#5F5952`, focus `#245F83`.
- Dark canvas `#151B20`, surface `#20282F`, text `#F5F1E8`, secondary `#C7C9C7`, focus `#9FD8FF`.
- Scene-specific hue may affect outer canvas, decorative dividers and small chips only; known/unknown semantics remain stable and use labels, not color alone.

Verify at least 4.5:1 for normal text, 3:1 large text, 3:1 meaningful controls/borders/focus against adjacent colors, including selected, hover and active states. Disabled controls remain understandable. Audit existing hard-coded text colors, panels, tables, status blocks, focus, progress and native selects before dark mode is called supported. Respect forced-colors: remove decorative images, use system surfaces/colors, maintain focus and selected indicators.

Do not reinterpret a daytime canonical scene as a “real night scene.” Dark mode changes UI surfaces; scene keeps its colors or receives a documented backdrop-only veil. If veil harms recognizable scenery, show a smaller unmodified scene vignette inside the decoration area and use neutral dark margins. This composition is labelled web layout, not source reproduction.

Desktop: use aspect-preserving scene art behind margins/outer stage, avoid stretching. Each asset gets reviewed focal point/crop limits. A full-viewport `cover` crop is prohibited when it cuts canonical landmarks or moves the ground out of alignment. Prefer `contain` with solid neutral fill or an approved separate crop. No generative outpainting or invented furniture.

Mobile (<640 px): retain current horizontal character dock and slot grounding; background may be a quiet header/margin vignette with solid fill below, not a tall distorted crop. No additional large dedicated scene panel pushing the next-word controls farther down. Honor safe-area insets, portrait/landscape, 280 px minimum and 200/400% zoom. On short landscape screens prioritize the card and allow scenery to be largely hidden. No decorative horizontal scroll.

## 7. Ground, obstacles and motion-safe zones

**V1 deliberately does not create scene physics.** A pictured table is decoration, not a platform. No automatic sitting at table, entering cave, climbing furniture, touching props or pair interaction solely because a scene was selected. Each would need separate observed action evidence, art and behavior approval.

Authoring metadata should keep two coordinate systems explicit:
- Source art: intrinsic width/height; normalized focal point; approved crop window; observed horizon/ground segments and prop rectangles. Entries may remain unknown; do not guess feet/surface geometry from prose.
- Web layout: actual rendered image rectangle/scale/offset; desktop stage floor or mobile slot floor; allowed movement regions and exclusion rectangles in viewport CSS px.

Mapping for uniformly scaled art: `screenX = imageLeft + sourceX * scale`, `screenY = imageTop + sourceY * scale`. Account for crop offsets; never use image dimensions as CSS pixel anchors directly. Aspect-preserving scale only. Ground must use each approved pose's visible contact-point metadata; do not assume alpha-bounds bottom equals feet.

Default and none retain existing engine floor; candidate art must not visually suggest pets stand on the wrong surface. If a source view cannot be composed around the existing safe floor, display it as a separated decorative vignette, leave the pet floor neutral, and call that UI-authored layout. Do not move the engine floor speculatively in this stage. Mobile ground belongs to each slot, not to a stretched room panorama across all six slots.

Hard no-motion/no-occlusion zones: all of `main` while studying, headings/count/status text, selector and character controls, focused elements plus 12 px focus halo, keyboard hints, and the dedicated limited-preview rail. Source prop obstacles are optional stricter exclusions, not replacements for DOM exclusions. Motion stays in already approved stage regions; if no safe region exists, hold a static approved pose in the stage rather than crossing text. Never use background change to revive a hidden character.

Existing opacity-yield behavior alone does not meet zero text overlap. Before scene-aware motion ships, require an engine contract that excludes full text surfaces and handles drag overlap safely; otherwise retain neutral existing stages and no added movement. Pair/preview controllers retain ownership; background may not race them. A swap requiring geometry invalidation should cancel any affected presentation via its explicit cancellation API, preserve pause/visibility, release pointer capture safely and settle in an approved static pose—not destroy/mount the engine. Future implementation must reconcile this with the then-current verified pair engine.

Resize, orientation, zoom, font load, disclosure open/close and home↔study must recompute image placement and invalidate cached DOM exclusion rects. Coalesce reads after layout; do not measure layout every animation frame. Scrolling a dock keeps its clips/anchors. Scenery is static: no parallax, pans, zooms, particles, clouds or character-triggered lighting. Reduced-motion uses instantaneous scene swaps, honors existing paused characters and disables any crossfade; normal mode also defaults to an instantaneous decoded swap for predictability.

## 8. Loading, offline and performance budget

Retain self-contained local HTML as the primary compatibility target. No runtime hotlinks to official video stills/CDNs. Research references are not runtime assets. Browser must render vocab and solid default canvas without waiting for any scene decode. Fixed backdrop dimensions mean zero scene-induced layout shift.

Proposed launch budget (incremental, not a claim the existing 21.7 MB app is small):
- Maximum 3 approved scenes; desktop rendition up to 1600×900, mobile up to 720×960 only if a separate crop is necessary and reviewed.
- Target ≤180 KiB compressed per desktop, ≤90 KiB per mobile; hard cap 250 KiB / 120 KiB. Prefer WebP or AVIF only after target-browser/offline decode tests; unsupported format gets explicit fallback.
- Thumbnail ≤160×90, ≤8 KiB; all three ≤24 KiB. No separate thumb required if there is no valid licensed thumbnail.
- Full new embedded payload ≤1.5 MiB including base64 overhead (raw bytes ×4/3); enforce during build. If quality cannot meet it, ship fewer scenes or revisit bundle delivery explicitly, never silently inflate.
- At most one current scene plus one pending decode; release old element/object references after swap. Largest 1600×900 RGBA scene is ~5.5 MiB decoded; two ~11 MiB, excluding browser overhead. Never decode every scene at startup merely because it is embedded.
- Background controller should contribute no continuous requestAnimationFrame loop. No scene-induced task >50 ms in measured interaction traces; selection feedback within 100 ms; decode may finish later with study still interactive.
- Background JavaScript/CSS target ≤15 KiB minified combined; no framework, image library, remote font, analytics or extra timers.

Decode into an off-DOM image, validate natural size, then atomically commit if token is current. Timeout after 8 seconds to recover visually (not a claim that network is involved offline); stale decode result is ignored. Missing, corrupt, zero-size or unsupported image uses default meadow; if default fails use the solid theme canvas. Retry is explicit; no retry loop. Background exceptions are isolated from vocab and pets. Hidden tab doesn't start unnecessary work; restore doesn't duplicate listeners.

## 9. Provenance and approval metadata

Future manifest should record: stable scene ID; Korean label; source series/episode/title; official source URL; optional secondary source URL; exact observed timestamp range; verification method; local reference filename and SHA-256; frame crop coordinates; observed features vs inferred features; whether character-free; rights holder/credit as actually stated; reuse authorization status; art origin (`official-frame`, `licensed-asset`, `reference-derived`); artist/source asset ID; derivative/edit history; intrinsic dimensions; desktop/mobile crop review; bytes; approval reviewer/date/evidence; palette and ground/obstacle metadata.

Do not remove watermarks, captions or characters from a screenshot and call it an original background. No download/reuse permission is inferred from online availability, official-channel publication, attribution, or private research access. Research frames stay outside runtime assets. A source link/credit is not clearance. These are conservative project gates, not a legal conclusion. Ask the owner to choose an authorized source/use path before asset production or publication if none is established; do not give legal assurance.

Keep evidence and render eligibility separate. A build-time validator rejects missing provenance, unknown approval state, hash mismatch, excessive size, unreviewed crop or missing fallback. Never allow `approved:true` without review record links. UI must not expose an unavailable candidate as if ready.

## 10. Future implementation seams (not work performed)

- A small standalone background-preference normalizer/controller + manifest; unit test independently of study state.
- Template: appearance disclosure, background-only container and scoped status; preserve semantic study DOM.
- Theme: reusable light/dark surfaces and contrast-complete tokens, scoped decoration removal for none; no sprite selectors.
- Build: validated approved scene manifest and budget accounting, existing single-file replacement convention. No change to the public deployment HTML without separate publication authority.
- Pet integration: add appearance region to obstacle/readability exclusions and explicit geometry invalidation/cancellation hook only after current character/pair changes are verified. Never infer a new approved animation from a background entry.

## 11. Acceptance gates

See `acceptance-tests.md`. All checks are future requirements, not executed QA claims. No rollout until the exact asset/crop, current pet integration, both themes, storage isolation and vocabulary regressions pass. Default + none can be tested without canonical assets; authentic scene release is independently blocked by asset evidence and authorization.
