"""Optional exact-byte WEB packaging of an already gated offline HTML artifact.
No image libraries, network, runtime changes, or source-tree writes.
"""
import base64
import hashlib
import json
from pathlib import Path
import re

IMAGE = re.compile(rb'data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})')
EXT = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
       'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif'}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def package(source, destination):
    source, destination = Path(source), Path(destination)
    original = source.read_bytes()
    # Fresh output is mandatory; never overwrite an existing deployment/source.
    if destination.exists():
        raise ValueError('Output must be a new directory')
    assets, occurrences, replacements = {}, [], []
    for match in IMAGE.finditer(original):
        mime = match[1].decode('ascii')
        if mime not in EXT:
            raise ValueError(f'Unsupported image MIME: {mime}')
        raw = base64.b64decode(match[2], validate=True)
        if not raw or base64.b64encode(raw) != match[2]:
            raise ValueError('Empty or noncanonical base64 image')
        digest = sha(raw)
        url = f'assets/{digest}.{EXT[mime]}'
        if url in assets and assets[url] != raw:
            raise ValueError('Hash collision')
        assets[url] = raw
        occurrences.append({'offset': match.start(), 'inlineBytes': len(match[0]),
                            'url': url, 'sha256': digest, 'bytes': len(raw), 'mime': mime})
        replacements.append((match.start(), match.end(), url.encode('ascii'), match[0]))
    # Fail closed on image URI forms not explicitly supported; never silently leave some inline.
    if original.count(b'data:image/') != len(occurrences):
        raise ValueError('Unsupported data:image URI syntax')
    chunks, cursor = [], 0
    for start, end, url, _ in replacements:
        chunks.extend((original[cursor:start], url)); cursor = end
    chunks.append(original[cursor:]); output = b''.join(chunks)
    # Positional inverse is unambiguous even if original HTML contains matching URL text.
    restored, cursor, delta = [], 0, 0
    for start, end, url, uri in replacements:
        new_start = start + delta
        if output[new_start:new_start+len(url)] != url:
            raise ValueError('Replacement offset mismatch')
        restored.extend((output[cursor:new_start], uri))
        cursor = new_start + len(url); delta += len(url) - (end-start)
    restored.append(output[cursor:])
    if b''.join(restored) != original:
        raise ValueError('Non-image bytes changed')
    uri_set = {x[3] for x in replacements}
    report = {'schemaVersion': 1, 'source': source.name, 'sourceSha256': sha(original),
              'htmlBytesBefore': len(original), 'htmlBytesAfter': len(output),
              'webHtmlSha256': sha(output), 'embeddedImageOccurrences': len(occurrences),
              'uniqueDataUris': len(uri_set), 'uniqueExactByteImages': len({x['sha256'] for x in occurrences}),
              'assetFileCount': len(assets), 'embeddedUriBytes': sum(x['inlineBytes'] for x in occurrences),
              'duplicateUriBytes': sum(x['inlineBytes'] for x in occurrences)-sum(map(len,uri_set)),
              'exactAssetBytes': sum(map(len,assets.values())),
              'htmlPlusAssetBytes': len(output)+sum(map(len,assets.values())),
              'nonImageBytesRoundTripExact': True, 'occurrences': occurrences}
    destination.mkdir(parents=True)
    (destination / 'assets').mkdir()
    for url, raw in assets.items():
        target = destination / url
        target.write_bytes(raw)
        if target.read_bytes() != raw:
            raise ValueError('Written asset differs from original bytes')
    (destination / 'index.html').write_bytes(output)
    (destination / 'asset-manifest.json').write_text(json.dumps(report, indent=2)+'\n')
    if source.read_bytes() != original:
        raise ValueError('Source changed during packaging')
    return report

# Public build entry point: build_web.py (runs the normal gates first).
