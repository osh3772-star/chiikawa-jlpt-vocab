# Animation engine / local implementation

## What is enabled

The six existing image packs are **static illustrations, not approved continuous
animation**. CSS shaking, squash/stretch and whole-image facing flips have been
removed. Missing walk cycles contribute their probability to idle; they do not
slide a stationary pose across the floor. Individual existing static poses can
still appear briefly, with `data-asset-mode="static-fallback"`. This is an honest
fallback, not a claim that the official look or natural movement is completed.

Public mount/react/pause/resume/destroy/getState/setMobileCharacters APIs,
`vocab:*` events, the six probability tables, single-file offline packaging, all
7,180 words, study localStorage and mobile preference keys remain intact. The
vocabulary template and published `docs/index.html` are not modified.

## Optional approved sequence contract

Add `chiikawa-pets/action-manifests/<characterId>.json`. Example structure only
(the two paths below must be replaced with genuinely reviewed drawings):

```json
{
  "characterId": "chiikawa",
  "modelVersion": "reviewed-model-version",
  "approvalStatus": "draft",
  "actions": {
    "walk": {
      "views": {
        "right": {
          "loop": true,
          "rootDistance": 0.4,
          "totalDurationMs": 200,
          "frames": [
            {"frameId":"contact","assetPath":"frames/right/contact.png","durationMs":100,"pivot":[0.5,1],"contactFlags":{"L":true,"R":false}},
            {"frameId":"passing","assetPath":"frames/right/passing.png","durationMs":100,"pivot":[0.5,1],"contactFlags":{"L":false,"R":true}}
          ]
        }
      }
    }
  }
}
```

- `draft` and `reviewed` are not enabled. `approved` is a human/art-review gate,
  never something inferred from a valid JSON file. No production cycles ship yet.
- `assetPath` is repository-relative PNG. Each frame has positive `durationMs`,
  stable `frameId`, normalized pivot `[x,y]` inside its image/cell.
- Optional `sourceRect:[x,y,width,height]` displays one rectangle from a shared
  sheet without altering raster pixels. Builder reads PNG dimensions and embeds
  each unique file only once in `manifest.assets`; runtime crops with CSS and
  uses uniform scale. Rectangles must not contain a neighboring character.
- Root is container bottom center; pivot aligns the drawn cell to that project maintainer.
  `rootDistance` is **rendered container-width per cycle** in this implementation.
  Calibrate it from artwork/foot contacts; it is not a measured anime stride or
  automatically inferred body width. Root displacement and frame phase share
  the same clamped clock. Per-foot inverse kinematics/contact locking is not
  implemented. `contactFlags` are validated metadata, not proof of foot planting.
- Views: `left`, `right`, `front`, `back`. Walk requires a real left/right view.
  Other actions may use front fallback. No mirrored views, even for the trio;
  Rakko asymmetry must never be flipped. A one-direction cycle stops at a wall.
- `walk`, `grab-onset`, `hold`, `release`, `fall`, `landing`, `recover`,
  `start`, `correct`, `wrong`, `complete`, or a configured named action are used
  by the state machine. Use looping hold/fall and non-looping bridge/reaction
  actions. Missing actions show a still; legacy compressed landing art is not
  used to simulate weight. Entry/exit bridge art must itself be reviewed.
- Build rejects escaped/missing paths, invalid PNGs/rectangles/timings, absent
  foot flags, duration mismatch and identical repeated full images masquerading
  as a cycle. Those checks do not establish anatomy, identity or loop quality.

## Safety and arbitration

Mouse captures immediately. Touch captures after a 220ms hold only if movement
is within 8px; `touch-action:pan-y` preserves scroll intent. Browser pointercancel
is always a safe reset, never a throw. Pointer capture is released on resize,
hide, pause, reduced-motion changes, mobile regroup, page lifecycle and destroy.
Normal release goes onset → hold → release → fall → landing → recover; physical
movement is bounded. Idle artwork stays unwarped while real frames are absent.
Enter/Space gives the equivalent simple greeting; Escape safely puts down.
Learning arrow keys remain untouched.

One autonomous large action is allowed at a time. Learning uses one rotating
representative; completion can reserve one partner responding 300ms later,
cleaned up within 1.5s. Grab/cancel/reset releases both roles. These are web-app
choreography proposals, not claims of observed official scenes. Events have a
one-slot latest queue, 45ms coalescing window and 1s expiry; supplied `eventId`
is deduplicated within a bounded 128-entry/5s window. `correct`/`wrong` mean
known/unknown, never grading. Wrong uses encouragement or neutral, not crying.

Reduced motion cannot be bypassed by resume. Manual pause survives media-query
changes and back/forward cache remount. In paused/reduced modes only still
reaction swaps occur, no autonomous movement. Hidden tabs reset safely.

## Checks and remaining verification

```sh
node --test tests/*.test.mjs
python build_html.py
python -m unittest discover -s tests -p 'test_*.py' -v
```

Local implementation checks: deterministic probability sampling; explicit
views; variable timing; release bounds; lifecycle/capture cleanup; touch intent;
coalescing, expiry and deduplication; partner cleanup; reduced-motion policy;
shared-sheet packing and validation; offline payload and 7,180-word count.
Mock DOM tests do not replace browser gesture or visual QA. PNGs used in builder
tests are copied unchanged purely as parser fixtures, not approved cycles.

Measured before optional art: local HTML 14,351,547 bytes (about 13.69MiB).
Rebuild after final edits for exact size. No package installation, server,
push, public generation, or deployment is part of this implementation.

Browser QA should cover desktop mouse release/cancel, touch scroll/long press,
mobile group changes, reduced-motion toggles while captured, hidden tab and
back/forward restoration, repeated known/unknown input, progress persistence,
missing-image fallback, and zero console exceptions. Approved art additionally
needs identity, direction/asymmetry, cell boundaries, baseline/pivot, support
foot sliding, entry/exit and loop seam inspection at actual display size.

## Explicit real-app Chiikawa beta (2026-10-24 update)

The vocabulary app now has an OFF-by-default **치이카와 동작 베타** checkbox.
Its persisted opt-in activates `betaManifest` for Chiikawa only, in a reserved
header lane so study buttons remain unobstructed. `approvalStatus` stays `draft`
and `experimental:true` is accepted only through the explicit runtime opt-in;
normal approved-manifest loading remains unchanged. Other five characters keep
their existing safe/static behavior. The action button previews movement.

Current beta art: separate left/right sheets with four keyposes each, held
three-pose loop plus release pose, four landing keyposes. Start/stop currently
hold an endpoint pose; they are not newly completed transition drawings. Frame
cropping and uniform sheet scaling preserve original pixels. Conservative project maintainer
translation is phase-coupled, but anatomical support-foot identity and true foot
locking are NOT validated; no contact-lock solver ships in this version. The beta
builder rejects contactLock:true rather than silently claiming a lock. Some
sliding/coarseness remains. The literal back-grip
view and smooth 12-frame walking are unfinished. Beta is not official art approval.

The isolated `build_preview.py` laboratory remains the earlier frontal-pose demo;
the actual directional integration is in `단어장.html`. See
[코드 안내](코드_안내.md) for the Korean file map and editing instructions.

### Audited legacy-art quarantine (2026-10-24)
`art_quarantine.py` substitutes intact Momonga `idle` pixels for six defective
legacy static poses (`hang`, `sleep`, `pout`, `fake-cry`, `grabbed`, `jump`).
Audit M01–M03 records missing bodies and clipped face/body outlines. Originals
remain untouched; profile `quarantinedArt` and `poseAliases` identify the honest
static fallback. The separate reviewed R3 limited preview is unaffected.
This does not claim any replacement animation, flight, or back-grab artwork.
