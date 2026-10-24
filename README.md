# Chiikawa JLPT Vocabulary

A browser-based JLPT vocabulary app with 7,180 entries and six interactive character companions. Built with HTML, CSS, vanilla JavaScript and a Python standard-library build script.

## Features

- N5–N1 vocabulary with readings, Korean meanings, examples and translations.
- Arrow keys: left/right to navigate, up for known, down for unknown.
- Review only unknown words, with filters by JLPT level.
- Progress and ratings saved in the current browser's local storage.
- Six companions with individual poses, autonomous actions, dragging, falling and learning reactions.
- Responsive desktop and mobile layouts; mobile character group selection.

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

Raw APK files, local verification backups and screenshot outputs are excluded from Git.
