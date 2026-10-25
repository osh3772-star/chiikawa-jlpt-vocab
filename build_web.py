"""Optional local WEB package; offline HTML remains the default and is built first.
No upload/deployment, recompression, resizing, or runtime behavior changes.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from externalize_assets import package


def destination_for(root, output):
    root = Path(root).resolve()
    dist = root / 'dist'
    if dist.is_symlink():
        raise ValueError('dist must not be a symlink')
    candidate = Path(output)
    destination = (candidate if candidate.is_absolute() else root / candidate).resolve()
    if not destination.is_relative_to(dist):
        raise ValueError('WEB output must be a new directory under project dist/')
    if destination.exists():
        raise ValueError('Output already exists; choose a new dist/ subdirectory')
    return destination


def build_web(root, output='dist/web', run=subprocess.run):
    root = Path(root).resolve()
    destination = destination_for(root, output)
    # Always execute the normal exact-asset/evidence-gated builder; no ungated source flag.
    run([sys.executable, str(root / 'build_html.py')], cwd=root, check=True)
    return package(root / '단어장.html', destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='dist/web', help='Fresh directory below dist/ (never docs/)')
    args = parser.parse_args()
    report = build_web(Path(__file__).resolve().parent, args.output)
    print(json.dumps({k: v for k, v in report.items() if k != 'occurrences'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
