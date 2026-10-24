# Background selector acceptance tests

DESIGN REQUIREMENTS ONLY — not yet implemented or executed. Run against the final built single-file app and, only when authorized, the hosted build. Log exact revision, asset hashes, browser/version, viewport, theme and actual result. A source-only assertion is not visual QA.

## Test fixtures / matrix

- Sizes in CSS px: 280×653, 320×568, 390×844, 639×800, 640×800, 900×800, 901×800, 1366×768, 1920×1080, 844×390. Also 200% and 400% browser zoom at 1280×800; device pixel ratios 1 and 2.
- Every eligible scene plus default/none × light/dark/system; source contains both visually busy and light/dark image regions if applicable. No fake production scene added to satisfy testing.
- Desktop Chromium + Firefox; Safari/iOS supported-target run required before claiming support. Android Chrome touch run. If unavailable, mark unrun, not passed.
- Home with empty review list, home with populated/scrolling list, ordinary study, last word, in-progress unknown-only review and completed review.
- Pet presets: all hidden; each individually shown; all six; paused; reduced motion; approved beta off/on where still supported; active pair/preview only if separately approved.
- Before each destructive storage fixture, back up test-only keys. Do not run storage tests in the user's active QA tabs or alter their browser globals.

## Exact acceptance cases

### A. Data and storage isolation

A01 Fresh test profile: open app. Default meadow selected, background details closed; correct word total 7,180, N5=300/N4=780/N3=1100/N2=2100/N1=2900. No unverified scene offered. No background network request or decode blocks study.

A02 Seed study progress and answers across N5 and N1, pet visibility mixed, paused=true, mobile group original, beta preference known. Snapshot raw values for all four existing storage keys. Change every background and theme, reset background settings, reload. Existing raw values remain byte-for-byte unchanged except when an intentional study/pet action is separately performed. No new `vocab:*` event from scene changes.

A03 Select a scene and dark mode. Reload same origin. Selection and theme return. Home↔study, level changes and review preserve appearance. Existing file-vs-hosted storage separation remains; no claim of sync.

A04 Background key malformed JSON, null, array, `{}`, wrong version, nonstring ID, arbitrary URL, script-like ID and unknown enum: app starts without exception, resolves defaults, uses no injected URL/style/HTML; vocab remains functional. Unknown obsolete scene ID gives nonblocking note and default. No broad storage deletion.

A05 Deny reads and writes separately; simulate quota-full writes. Selection still works for this session, one truthful save warning, vocab/pets continue. Background retry does not rewrite study keys.

A06 Open two same-origin test tabs. Update background key in A: B updates only appearance or follows the documented sync contract. Malformed/removal storage event does not crash. Close/reopen and bfcache restore: exactly one handler effect per change, no duplicate control or pet layer.

### B. Keyboard and accessibility

B01 Tab to disclosure, Enter/Space opens; all controls have Korean accessible names, native values and visible focus. Select scene using arrows/Enter. Study position and rating counts stay unchanged. Repeat arrows on other appearance descendants: still no rating. Tab away to neutral study region: left/right/up/down continue intended study behavior.

B02 Collapse disclosure while focus is inside via supported UI; focus ends at a visible logical control. No focus jumps on decode success/error. Escape does not trigger background/pet actions. No custom keyboard trap or unwanted modal semantics.

B03 Screen reader reads one group name, selected label, controls and a concise status. Decorative images/sun/clouds do not enter accessibility tree. Source links have meaningful names; no unsupported “official asset licensed” language. Source disclosure remains keyboard accessible.

B04 In every fixture, measure normal text ≥4.5:1, large text ≥3:1, meaningful border/focus/control ≥3:1. Include header, storage/status notes, counts, reading, meanings, examples, translations, review table, native select, selected/hover/active states in both themes. Inspect original character pixels separately: UI theme must not recolor them.

B05 Forced-colors mode: scenery removed, text/controls/focus/selected state readable using system colors. 200/400% zoom: no clipped study text/control, no decorative horizontal page scroll, focus remains in view.

### C. Rendering and safety

C01 For every size/scene/theme capture home and study screenshots; card is opaque, long Japanese/Korean text wraps, all navigation controls reachable. Main/control coordinates before vs after a scene swap are identical (≤1 CSS px rounding). Scene change causes CLS=0. Details opening may intentionally reflow; asset decode must not.

C02 None removes meadow, sun, clouds and hills, leaving solid canvas. It does NOT hide any selected character, alter pause state, clear beta state or change word selection. Default restores original app-made scenery labelled as such.

C03 Compare each scene crop against approved source/crop sheet: no stretch, unapproved mirror, invented objects, missing essential landmark, watermarks removed, or contradictory room geometry. Mobile uses reviewed vignette/crop, not arbitrary cover. If geometry is unsuitable, neutral ground + separate vignette is used and labelled UI layout.

C04 Record pet contact anchors at 639/640 widths, landscape rotation, 200% zoom and dock scroll: every visible pet uses approved current floor/slot/contact metadata, not an imagined table/platform. No foot through props or midair illusion caused by new art. Hidden pets remain hidden. A background may not create or expand a pair interaction.

C05 Exercise word navigation, grading, scrolling, focus, dock swipe and drag around text/controls during scene change. No new occlusion or intercepted click; all main study content and focus halos remain safe. Existing yielding cannot be counted as a zero-overlap pass. If safe geometry cannot be achieved, fail scene-aware motion and retain neutral stages until engine work is approved.

C06 Swap while approved pair/limited preview runs, while pet is dragged, and while manually paused. Apply only explicit cancellation/geometry contract; no orphaned pointer capture, duplicate sprite, resurrection of hidden character, uncontrolled fall, spontaneous motion or pet remount. Verify pause setting before/after identical. These tests depend on the current verified engine, not assumptions from this document.

C07 Resize/open-close disclosures/change view while scene decodes and while pets are present: cached exclusion rects refresh after layout; dock clip follows scroll; stage remains bounded. Character art's actual image colors/transform contract unchanged—no whole-body filter or new scale/mirror.

C08 Enable OS reduced motion before load and toggle live during a selection. No crossfade, parallax, background animation or new pet movement. Existing user pause preference is preserved when reduced motion is disabled. In normal mode background remains static.

### D. Decode and failure handling

D01 Throttle decoder, choose A→B→none rapidly; release A/B completion in both orders. None stays final, no stale success/error overwrites it, no spurious status. Repeat 20 changes: no accumulating scene nodes/listeners, no continuous background RAF/timer.

D02 Missing asset, corrupt bytes, unsupported format, zero dimensions and >8-second stalled decode: readable current scene while pending, then default; default failure reaches solid canvas. Status names fallback honestly; requested eligible ID retained for retry. Retry succeeds when fixture repaired. No alert dialog, reload, auto retry loop or study interruption.

D03 Disconnect network and reopen single-file app. All shipped eligible scenes, thumbnails and vocab work offline; external credit links may be unavailable without affecting app. No hotlinked reference images or required fonts/scripts. CSP/sandbox failures report fallback without exceptions escaping controller.

D04 Page hide/show, back/forward cache restore, tab visibility changes and changing system theme mid-decode leave latest selection/theme applied, without duplicate work or restarting an inactive presentation.

### E. Performance and provenance build gates

E01 Manifest validator rejects each independently: unapproved art, missing source, unknown verification status, missing approval reviewer, missing rights/use decision, hash mismatch, dimensions over budget, unreviewed crop, missing fallback, non-whitelisted ID. Candidate entry must not leak into generated HTML/selector.

E02 Count all embedded background bytes including base64: incremental ≤1.5 MiB, max 3 scenes, desktop ≤250 KiB compressed/1600×900, mobile ≤120 KiB/720×960, thumbnail ≤8 KiB/160×90. If thresholds fail, reduce count or obtain explicit new budget; do not call an over-budget build accepted.

E03 Record startup and 20-swap performance traces on declared reference mobile/desktop hardware. No new scene-caused task >50 ms, input feedback ≤100 ms, zero scene-induced CLS; selected-only decode with maximum current+pending scenes; no scene RAF while idle. If attribution is ambiguous, inspect trace before claiming pass.

E04 Verify source ledger/image hash/crop manifest link for each published asset. Label canonical observation vs reconstruction vs web framing accurately. Source online/credit present is not reuse clearance. All credits preserved as required by chosen authorized asset path; no assets copied directly from research folder by build glob.

### F. Vocabulary and release regression

F01 Run existing `node --test tests/*.test.mjs`, rebuild with `python build_html.py`, and `python -m unittest discover -s tests -p 'test_*.py' -v` against final candidate. Add focused background tests; existing suites alone do not test the new feature.

F02 Start each JLPT level; navigate both boundaries; mark known/unknown; reload and verify same saved location/counts. Filter unknown list by level; open review by row and start button; remove a known item, reach review completion, return home. Scene changes during each flow never alter computed outcome.

F03 All six show/hide controls, all show/hide buttons, mobile dock, pause/resume, reduced-motion override and existing approved previews retain behavior. Compare to separately verified character/pair baseline. Do not reclassify an unverified prior feature as passed just because backgrounds work.

F04 Review final screenshots plus keyboard/touch results and source approvals. Confirm no changes/deployment in research stage. Later implementation completion and publication are separate approvals; do not write/publish `docs/index.html` or push simply because local tests pass.

## Completion record template

For each case: `ID | revision | asset hash set | browser/device/size | setup | observed result | PASS/FAIL/BLOCKED/NOT RUN | screenshot/trace/log path | reviewer/time`.

Required overall result: all applicable cases pass; unavailable browser/asset/rights/pair prerequisites are explicitly blocked, not silently waived. No production background selected by default until that background's own evidence and runtime tests pass.
