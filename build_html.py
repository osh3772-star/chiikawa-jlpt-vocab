import json
import base64
import mimetypes
from pathlib import Path

root = Path(__file__).resolve().parent
words = json.loads((root / '전체_단어장.json').read_text(encoding='utf-8'))
levels = {}
for n in range(5, 0, -1):
    sections = json.loads((root / '원본데이터' / f'section{n}.json').read_text(encoding='utf-8'))['section']
    start = min(int(s['start']) for s in sections)
    end = max(int(s['end']) for s in sections)
    levels[f'N{n}'] = words[start:end]
payload = json.dumps(levels, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
html = (root / '단어장.template.html').read_text(encoding='utf-8')
pack = root / 'chiikawa_vocab_codex_pack'
config = json.loads((pack / 'animation-config.json').read_text(encoding='utf-8'))
def data_uri(path):
    mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode('ascii')
sprites = {who: {frame: data_uri(pack / path) for frame, path in character['frames'].items()}
           for who, character in config['characters'].items()}
new_pack = root / 'chiikawa_three_pet_integration'
new_config = json.loads((new_pack / 'animation-config.json').read_text(encoding='utf-8'))
profiles = {**config['characters'], **new_config['characters']}
for who, character in new_config['characters'].items():
    sprites[who] = {frame: data_uri(new_pack / path) for frame, path in character['frames'].items()}
# Keep the existing Usagi reaction and use the new pack's documented Rakko start.
profiles['usagi']['vocab']['wrong'] = 'landing'
profiles['rakko']['vocab']['start'] = 'blink'

# Refresh the original trio from the new static-pose artwork. Missing physical
# frames are explicit pose aliases, never invented sequential walk frames.
refresh_pack = root / 'chiikawa_hachiware_usagi_assets'
pose_aliases = {
    'chiikawa': {'blink': 'idle', 'walk-a': 'idle', 'walk-b': 'idle', 'grabbed': 'reaction', 'landing': 'idle'},
    'hachiware': {'blink': 'idle', 'walk-a': 'idle', 'walk-b': 'idle', 'grabbed': 'reaction', 'landing': 'idle'},
    'usagi': {'blink': 'idle', 'walk-a': 'run', 'walk-b': 'run', 'grabbed': 'jump', 'landing': 'idle'},
}
events = {
    'chiikawa': {'start': 'wave', 'correct': 'happy', 'wrong': 'cry', 'complete': 'encourage'},
    'hachiware': {'start': 'wave', 'correct': 'happy', 'wrong': 'reaction', 'complete': 'guitar'},
    'usagi': {'start': 'wave', 'correct': 'happy', 'wrong': 'idle', 'complete': 'cheer'},
}
for who, aliases in pose_aliases.items():
    directory = refresh_pack / who
    pose_config = json.loads((directory / f'{who}-config.json').read_text(encoding='utf-8'))
    frames = ({p['pose']: p['file'] for p in pose_config['poses']}
              if 'poses' in pose_config else dict(pose_config['frames']))
    for name, original in aliases.items():
        frames[name] = frames[original]
    sprites[who] = {name: data_uri(directory / path) for name, path in frames.items()}
    profiles[who]['frames'] = frames
    profiles[who]['poseAliases'] = aliases
    profiles[who]['assetType'] = 'static-poses-with-css-motion'
    profiles[who]['motion'] = {'walkPose': 'run' if who == 'usagi' else 'idle', 'blinkPose': 'idle'}
    profiles[who]['vocab'] = events[who]
theme = (root / 'theme.css').read_text(encoding='utf-8')
theme = theme.replace('__MEADOW_IMAGE__', data_uri(pack / config['background']))
theme = theme.replace('__FLOWER_IMAGE__', data_uri(pack / 'assets/ui/flower.svg'))
theme = theme.replace('__STAR_IMAGE__', data_uri(pack / 'assets/ui/star.svg'))
engine = (root / 'chiikawa-pets/pet-engine.js').read_text(encoding='utf-8').replace('export function mountChiikawaPets', 'function mountChiikawaPets', 1)
integration = (root / 'chiikawa-pets/integration.js').read_text(encoding='utf-8').replace('__PET_ENGINE__', engine)
html = html.replace('__THEME_CSS__', theme)
html = html.replace('__STAR_IMAGE__', data_uri(pack / 'assets/ui/star.svg'))
html = html.replace('__PET_CSS__', (root / 'chiikawa-pets/chiikawa-pets.css').read_text(encoding='utf-8'))
html = html.replace('__PET_SPRITES__', json.dumps(sprites, ensure_ascii=False, separators=(',', ':')))
html = html.replace('__PET_PROFILES__', json.dumps(profiles, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
html = html.replace('__PET_INTEGRATION__', integration)
(root / '단어장.html').write_text(html.replace('__DATA__', payload), encoding='utf-8')
assert sum(map(len, levels.values())) == 7180
print('HTML 생성 완료: 7,180개, N5~N1, 데이터 내장')
