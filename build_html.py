import json
import base64
import mimetypes
from pathlib import Path
from stream_text import StreamText

root = Path(__file__).resolve().parent
words = json.loads((root / '전체_단어장.json').read_text(encoding='utf-8'))
levels = {}
for n in range(5, 0, -1):
    sections = json.loads((root / '원본데이터' / f'section{n}.json').read_text(encoding='utf-8'))['section']
    start = min(int(s['start']) for s in sections)
    end = max(int(s['end']) for s in sections)
    levels[f'N{n}'] = words[start:end]
payload = json.dumps(levels, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
html = StreamText((root / '단어장.template.html').read_text(encoding='utf-8'))
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
# Audited damaged Momonga originals are preserved on disk, but runtime receives
# only an explicit intact idle alias; no invented replacement motion.
from art_quarantine import apply_art_quarantine
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
    profiles[who]['assetType'] = 'static-poses'
    profiles[who]['motion'] = {'walkPose': 'run' if who == 'usagi' else 'idle', 'blinkPose': 'idle'}
    profiles[who]['vocab'] = events[who]

from usagi_linecolor import load_usagi_linecolor, apply_usagi_linecolor
apply_usagi_linecolor(load_usagi_linecolor(root,data_uri),sprites,profiles)

behaviors = json.loads((root / 'chiikawa-pets/behavior-config.json').read_text(encoding='utf-8'))['characters']
assert set(behaviors) == set(profiles), 'Behavior tables must cover all six characters'
for who, weights in behaviors.items():
    assert weights and all(isinstance(w, (int, float)) and not isinstance(w, bool) and w >= 0 for w in weights.values()), who
    assert abs(sum(weights.values()) - 100) < 1e-6, f'{who}: probabilities must sum to 100'
    assert all(action in ('idle', 'walk') or action in sprites[who] for action in weights), who
    profiles[who]['behavior'] = dict(weights)
# Quarantine after all refreshed art and behavior maps have been selected.
apply_art_quarantine(sprites, profiles)
from art_corrections import load_usagi_prop_correction, apply_usagi_prop_correction, load_chiikawa_prop_correction, apply_chiikawa_prop_correction
apply_usagi_prop_correction(load_usagi_prop_correction(root, data_uri), sprites, profiles)
apply_chiikawa_prop_correction(load_chiikawa_prop_correction(root, data_uri), sprites, profiles)
# Optional reviewed cycles override no old poses. Missing files/manifests keep
# explicit static fallback; unapproved candidates are never embedded as animation.
from animation_manifest import load_manifests
for who, manifest in load_manifests(root, profiles, data_uri).items():
    profiles[who]['animationManifest'] = manifest

# Separate opt-in beta assets are NEVER promoted to an approved manifest.
from beta_manifest import load_chiikawa_beta
beta = load_chiikawa_beta(root, data_uri)
if beta:
    profiles['chiikawa']['betaManifest'] = beta

theme = (root / 'theme.css').read_text(encoding='utf-8')
theme = theme.replace('__MEADOW_IMAGE__', data_uri(pack / config['background']))
theme = theme.replace('__FLOWER_IMAGE__', data_uri(pack / 'assets/ui/flower.svg'))
theme = theme.replace('__STAR_IMAGE__', data_uri(pack / 'assets/ui/star.svg'))
from evidence_registry import load_motion_registry
motion_evidence = load_motion_registry(root)
evidence_helpers = (root / 'chiikawa-pets/evidence-registry.js').read_text(encoding='utf-8').replace('export function ', 'function ')
visibility_helpers = (root / 'chiikawa-pets/visibility-preferences.js').read_text(encoding='utf-8').replace('export function ', 'function ')
display_scale_helpers = (root / 'chiikawa-pets/display-scale.js').read_text(encoding='utf-8').replace('export function ', 'function ')
from limited_preview import load_momonga_preview
momonga_preview = load_momonga_preview(root, data_uri)
if momonga_preview:
    from evidence_registry import require
    match = next((m for m in (motion_evidence or {}).get('mappings', []) if m['mappingId'] == momonga_preview['mappingId']), {})
    require(match.get('previewTestingAuthorized') is True and match.get('previewReviewId') == momonga_preview['reviewId'] and
            match.get('bodyActionRef') == momonga_preview['bodyActionRef'] and
            match.get('previewAssetSha256') == momonga_preview['assetSha256'], 'Limited preview is not linked to current reviewed registry')
from static_cameo import load_static_cameo
cameo_asset = load_static_cameo(root, data_uri)
cameo_helpers = (root / 'chiikawa-pets/static-cameo.js').read_text(encoding='utf-8').replace('export function ', 'function ')
preview_helpers = (root / 'chiikawa-pets/momonga-preview.js').read_text(encoding='utf-8').replace('export function ', 'function ')

from fragment_assets import load_fragment_sources
fragment_sources = load_fragment_sources(root, data_uri)
def inline_module(filename, exports):
    code = (root / 'chiikawa-pets' / filename).read_text(encoding='utf-8').replace('export async function ', 'async function ').replace('export function ', 'function ').replace('export const ', 'const ')
    code = code.replace("import {createShisaStaticController,createShisaView,decodeShisaImage,SHISA_GEOMETRY} from './shisa-static-controller.mjs';", "const {createShisaStaticController,createShisaView,decodeShisaImage,SHISA_GEOMETRY}=ShisaModule;")
    code = code.replace("import {registeredPoseGeometry,decodeObservedPoses} from './observed-pose-fragment.mjs';", "const {registeredPoseGeometry,decodeObservedPoses}=ObservedModule;")
    code = code.replace("import {R3,createGlide,checkCorridor} from './safe-glide.mjs';", "const {R3,createGlide,checkCorridor}=SafeGlideModule;")
    return '(() => {\n' + code + '\nreturn {' + ','.join(exports) + '};\n})()'
hachiware_module = inline_module('hachiware-two-pose.mjs', ['hachiwareTwoPoseAsset', 'createHachiwareTwoPoseController'])
usagi_module = inline_module('usagi-fragment.mjs', ['usagiFragmentAsset', 'createUsagiFragmentController'])

from shisa_static_gate import load_shisa_source
shisa_source = load_shisa_source(root, data_uri)
shisa_module = inline_module('shisa-static-controller.mjs', ['createShisaStaticController','createShisaView','decodeShisaImage','SHISA_GEOMETRY'])
from shisa_two_static_gate import load_shisa_two_sources
shisa_two_sources = load_shisa_two_sources(root, data_uri)
from shisa_three_static_gate import load_shisa_three_sources
shisa_three_sources = load_shisa_three_sources(root, data_uri)
shisa_pair_module = inline_module('shisa-three-static-controller.mjs', ['createShisaThreeStaticController'])
from observed_fragments import load_observed_fragments
observed_fragments = load_observed_fragments(root, data_uri)
from smooth_carry import load_smooth_carry
smooth_carry = load_smooth_carry(root, data_uri)
if smooth_carry: observed_fragments[smooth_carry["fragmentId"]] = smooth_carry
from carry_cycle import load_carry_cycle
carry_cycle = load_carry_cycle(root, data_uri)
if carry_cycle:
    # Keep the tested seven-drawing policy/source gate, but do not duplicate its inactive data URIs.
    observed_fragments.pop("chiikawa-carry-smooth", None)
    observed_fragments[carry_cycle["fragmentId"]] = carry_cycle
from hachi_fullbody import load_hachi_fullbody
hachi_fullbody = load_hachi_fullbody(root,data_uri)
if hachi_fullbody: observed_fragments[hachi_fullbody['fragmentId']] = hachi_fullbody
observed_module = inline_module('observed-pose-fragment.mjs', ['createObservedPoseFragment','registeredPoseGeometry','decodeObservedPoses'])
hachi_full_module = inline_module('hachi-fullbody-response.mjs',['createHachiFullbodyResponse'])
from direct_response_layouts import load_direct_response_layouts
direct_layouts = load_direct_response_layouts(root)
direct_module = inline_module('direct-interaction.mjs', ['directCarryRegistration','createDirectInteractionAdapter','directResponseProfiles'])

from authored_glide import load_authored_glide
authored_glide = load_authored_glide(root,momonga_preview)
safe_glide_module = inline_module('safe-glide.mjs',['R3','createGlide','checkCorridor'])
web_glide_module = inline_module('momonga-web-glide.mjs',['authoredGlidePath','createMomongaWebGlide','recoveryGeometry','glideMainRegions','glidePaintRect'])

engine = (root / 'chiikawa-pets/pet-engine.js').read_text(encoding='utf-8').replace('export function ', 'function ')
# v30: exact capture source bytes and runtime registration; no new art synthesis.
import hashlib
_capture_line = next(line for line in engine.splitlines() if line.startswith('const CAPTURE_ASSET='))
_capture = json.loads(_capture_line[len('const CAPTURE_ASSET='):-1])
_capture_uri = _capture.pop('source')
if hashlib.sha256(json.dumps(_capture, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest() != '04b2f08c86e187758e60651554ba706647d20db3258d771eef118e21d3ae0546':
    raise ValueError('capture registration changed')
_capture_bytes = base64.b64decode(_capture_uri.split(',', 1)[1], validate=True)
_capture_original = root / 'chiikawa-pets/draft-preview/assets/chiikawa-grab-keyposes.png'
if hashlib.sha256(_capture_bytes).hexdigest() != 'd38ead18705743d3bcb44f0ab666db962940c7a9e49a8b356e6d4dc21caaee02' or _capture_original.read_bytes() != _capture_bytes:
    raise ValueError('capture art identity changed')

integration = StreamText((root / 'chiikawa-pets/integration.js').read_text(encoding='utf-8')).replace('__PET_ENGINE__', engine)
from kani_static_art import load_kani_static_art
kani_static_art=load_kani_static_art(root,data_uri)
integration=integration.replace('__KANI_INPUT_HOST_MODULE__',inline_module('kani-input-host.mjs',['createKaniInputHost'])).replace('__KANI_INPUT_ENGINE__',json.dumps((root/'chiikawa-pets/kani-input-engine.js').read_text(),ensure_ascii=False).replace('<','\\u003c')).replace('__KANI_INPUT_CSS__',json.dumps((root/'chiikawa-pets/chiikawa-pets.css').read_text(),ensure_ascii=False).replace('<','\\u003c'))
integration=integration.replace('__KANI_RAIL_MODULE__',inline_module('kani-rail-controller.mjs',['createKaniRailController'])).replace('__KANI_RAIL_ART__',json.dumps(kani_static_art,ensure_ascii=False,separators=(',', ':')).replace('<','\\u003c'))
integration = integration.replace('__OWNED_VIEWPORT_MODULE__', inline_module('owned-viewport.mjs',['clipOwnedPaint','fullStageEligible','stagePresentation']))
integration = integration.replace('__AUTHORED_GLIDE_CONFIG__',json.dumps(authored_glide,ensure_ascii=False,separators=(',', ':')).replace('<', '\\u003c'))
from extra_static_art import load_extra_static_art
extra_static_art=load_extra_static_art(root,data_uri)
from pajama_static_art import load_pajama_static_art
pajama_static_art=load_pajama_static_art(root,data_uri)
pajama_preference_module=inline_module('pajama-group-preference.mjs',['createPajamaGroupPreference'])
integration=integration.replace('__PAJAMA_PREFERENCE_MODULE__',pajama_preference_module).replace('__PAJAMA_STATIC_ART__',json.dumps(pajama_static_art,ensure_ascii=False,separators=(',', ':')).replace('<','\\u003c'))
extra_visibility_module=inline_module('extra-visibility-store.mjs',['createExtraVisibilityStore'])
extra_static_module=inline_module('extra-static-controller.mjs',['createStaticExtraController','decodeStaticExtraImage'])
integration=integration.replace('__EXTRA_VISIBILITY_MODULE__',extra_visibility_module).replace('__EXTRA_STATIC_MODULE__',extra_static_module).replace('__EXTRA_STATIC_ART__',json.dumps(extra_static_art,ensure_ascii=False,separators=(',', ':')).replace('<','\\u003c'))
from background_art import load_background_art
background_art=load_background_art(root,data_uri)
background_module=inline_module('background-controller.mjs',['createBackgroundController'])
background_dom=inline_module('background-dom.mjs',['createBackgroundDomAdapter'])
integration=integration.replace('__BACKGROUND_MODULE__',background_module).replace('__BACKGROUND_DOM__',background_dom).replace('__BACKGROUND_ASSET__',json.dumps(background_art,ensure_ascii=False,separators=(',', ':')).replace('<','\\u003c'))
from pair_card_art import load_pair_card_art
pair_card_art=load_pair_card_art(root,data_uri)
pair_card_module=inline_module('pair-card-static.mjs',['validPairCardArt','createPairCardStatic'])
integration=integration.replace('__PAIR_CARD_MODULE__',pair_card_module).replace('__PAIR_CARD_ASSET__',json.dumps(pair_card_art,ensure_ascii=False,separators=(',', ':')).replace('<','\\u003c'))
integration = integration.replace('__SAFE_GLIDE_MODULE__',safe_glide_module).replace('__WEB_GLIDE_MODULE__',web_glide_module)
integration = integration.replace('__SHISA_PAIR_MODULE__', shisa_pair_module).replace('__SHISA_CLOSED_SOURCE__', json.dumps(shisa_two_sources['closed'] if shisa_two_sources else None)).replace('__OBSERVED_MODULE__', observed_module).replace('__OBSERVED_FRAGMENTS__', json.dumps(observed_fragments,ensure_ascii=False,separators=(',', ':')))
integration = integration.replace('__HACHI_FULL_MODULE__',hachi_full_module)
integration = integration.replace('__DISPLAY_SCALE_HELPERS__', display_scale_helpers)
integration = integration.replace('__DIRECT_MODULE__', direct_module).replace('__DIRECT_LAYOUTS__',json.dumps(direct_layouts,ensure_ascii=False,separators=(',', ':')))
integration = integration.replace('__SHISA_DIAGONAL_SOURCE__', json.dumps(shisa_three_sources['diagonal'] if shisa_three_sources else None))
integration = integration.replace('__SHISA_MODULE__', shisa_module).replace('__SHISA_SOURCE__', json.dumps(shisa_source))
integration = integration.replace('__HACHIWARE_MODULE__', hachiware_module).replace('__USAGI_MODULE__', usagi_module).replace('__FRAGMENT_SOURCES__', json.dumps(fragment_sources, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
integration = integration.replace('__STATIC_CAMEO_HELPERS__', cameo_helpers).replace('__STATIC_CAMEO_CONFIG__', json.dumps(cameo_asset, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
integration = integration.replace('__MOMONGA_PREVIEW_HELPERS__', preview_helpers).replace('__MOMONGA_PREVIEW_CONFIG__', json.dumps(momonga_preview, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')).replace('__VISIBILITY_HELPERS__', visibility_helpers).replace('__EVIDENCE_HELPERS__', evidence_helpers).replace('__MOTION_EVIDENCE__', json.dumps(motion_evidence, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
html = html.replace('__THEME_CSS__', theme)
html = html.replace('__STAR_IMAGE__', data_uri(pack / 'assets/ui/star.svg'))
html = html.replace('__PET_CSS__', (root / 'chiikawa-pets/chiikawa-pets.css').read_text(encoding='utf-8'))
html = html.replace('__PET_SPRITES__', json.dumps(sprites, ensure_ascii=False, separators=(',', ':')))
html = html.replace('__PET_PROFILES__', json.dumps(profiles, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
html = html.replace('__PET_INTEGRATION__', integration)
html = html.replace('__STUDY_STATE_HELPERS__', (root / 'chiikawa-pets/study-state.mjs').read_text(encoding='utf-8').replace('export function ', 'function '))
html.replace('__DATA__', payload).write_utf8(root / '단어장.html')
assert sum(map(len, levels.values())) == 7180
print('HTML 생성 완료: 7,180개, N5~N1, 데이터 내장')
