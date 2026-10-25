"""Load byte-identical user provisional Kani assets; no imported bundled code."""
import hashlib,json,struct
from pathlib import Path

def load_kani_static_art(root,data_uri):
    manifest=json.loads((root/'chiikawa-pets/kani-assets.json').read_text())
    expected={'idle':6,'read':8,'walk':8,'grabbed':6}
    if manifest.get('id')!='kani' or manifest.get('approval')!='USER_PROVISIONAL_KNOWN_SEAMS' or set(manifest['states'])!=set(expected):raise ValueError('Invalid Kani manifest')
    for state,count in expected.items():
        frames=manifest['states'][state]['frames']
        if len(frames)!=count:raise ValueError('Invalid Kani frame count')
        for frame in frames:
            rel=Path(frame['source'])
            if rel.is_absolute() or '..' in rel.parts or rel.parts[:2]!=('assets','kani-provisional'):raise ValueError('Invalid Kani asset path')
            p=root/'chiikawa-pets'/rel;b=p.read_bytes()
            if hashlib.sha256(b).hexdigest()!=frame['sha256'] or b[:8]!=b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',b[16:24])!=(512,512):raise ValueError('Kani asset identity changed')
            frame['source']=data_uri(p)
            frame.pop('originalSource',None)
    return manifest
