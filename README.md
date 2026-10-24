# Chiikawa JLPT Vocabulary

A browser-based JLPT vocabulary app with 7,180 entries and six interactive character companions. Built with HTML, CSS, vanilla JavaScript and a Python standard-library build script.

## Features

- N5–N1 vocabulary with readings, Korean meanings, examples and translations.
- Arrow keys: left/right to navigate, up for known, down for unknown.
- Review only unknown words, with filters by JLPT level.
- Progress and ratings saved in the current browser's local storage.
- Six companions with individual poses, autonomous actions, dragging, falling and learning reactions.
- Responsive desktop and mobile layouts; individually selected characters stay accessible in a horizontal mobile dock.

## Run locally

```sh
python build_html.py
```

Open `단어장.html` in a browser. It contains the vocabulary, styles, scripts and character images and does not require a server.

## Publish with GitHub Pages

The `main` branch's `/docs` directory contains the static site. To update it after rebuilding:

```sh
python build_html.py
python -c "from pathlib import Path; Path('docs/index.html').write_bytes(Path('단어장.html').read_bytes())"
```

Keep `docs/.nojekyll` in place. The public site does not upload or synchronize study progress. Progress from a local file remains in that browser storage and is separate from the hosted site's storage.

## Source layout

- `단어장.template.html`: vocabulary UI and study logic.
- `theme.css`: page layout and theme.
- `chiikawa-pets/`: character engine, scoped styles and integration.
- `전체_단어장.json`, `원본데이터/section*.json`: vocabulary and level ranges.
- Asset folders: supplied character images and pose configurations.
- `build_html.py`: creates the self-contained local application.
- `docs/index.html`: generated public application.

## Autonomous action probabilities

The table below is the legacy decision-weight baseline, not a promise that every action is playable: unavailable directional sequences and quarantined artwork use explicit idle/static fallbacks.

Edit `chiikawa-pets/behavior-config.json`, then rebuild. Each character's table sums to 100 and is sampled once whenever the character chooses its next autonomous action. Percentages describe decisions, not time spent in each pose. Movement direction and durations are randomized separately. Dragging, physics and vocabulary-event reactions retain priority.

| Character | Rest | Move | Character actions |
| --- | ---: | ---: | ---: |
| Chiikawa | 25% | 30% | 45% |
| Hachiware | 20% | 30% | 50% |
| Usagi | 10% | 35% | 55% |
| Shisa | 25% | 25% | 50% |
| Momonga | 15% | 30% | 55% |
| Rakko | 30% | 20% | 50% |

Run the distribution and validation checks with `node --test tests/behavior.test.mjs`.

Raw APK files, local verification backups and screenshot outputs are excluded from Git.

## Sequence engine (local implementation)

The engine now supports explicitly approved directional frame sequences and
sheet rectangles. Existing artwork remains a static fallback: it is not warped,
shaken or mirrored to simulate animation. Missing walk assets rest instead.
See [animation contract and verification](chiikawa-pets/README-animation.md).
Run `node --test tests/*.test.mjs`, rebuild, then
`python -m unittest discover -s tests -p 'test_*.py' -v` for local checks.

The local vocabulary app also includes an explicit **치이카와 동작 베타** opt-in:
separate left/right four-keypose walking, held reactions and landing in a safe
header lane. It is off by default and clearly unapproved/coarse beta artwork,
not a completed 12-frame cycle. Other characters and study storage are preserved.
See [Korean code guide](chiikawa-pets/코드_안내.md).
