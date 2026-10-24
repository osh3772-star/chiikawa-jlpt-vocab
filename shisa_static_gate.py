"""Stdlib-only, fail-closed gate for a single approved static UI adaptation."""
import hashlib
import json
import struct
from pathlib import Path

ASSET_PATH = 'chiikawa-pets/limited-previews/assets/shisa-ep264/shisa-pour-v2.png'
CONFIG_PATH = 'chiikawa-pets/limited-previews/shisa-static.json'
APPROVED_SHA256 = '7b0d66ff4cfdd5d8a107799debaf428a02d4f18c4c64e7d572cf1d568ea64866'
EXPECTED_CONFIG = {
    'schemaVersion': 1,
    'characterId': 'shisa',
    'testingAuthorized': True,
    'enabledByDefault': False,
    'productionEnabled': False,
    'reviewScope': 'LIMITED_STATIC_UI_RECEIVER_ADAPTATION',
    'bodyPoseCount': 1,
    'assetPath': ASSET_PATH,
    'assetSha256': APPROVED_SHA256,
    'assetSize': [1536, 1024],
    'sourceRepresentation': 'DERIVED_STATIC_POSE_WITH_AUTHORED_UI_RECEIVER',
    'originalPixels': False,
    'sourceTimingClaim': False,
    'pairRelationshipReproduced': False,
    'poseAnimation': False,
    'streamAnimation': False,
    'liquidLevelAnimation': False,
    'loop': False,
    'trigger': 'EXPLICIT_ONLY',
    'exclusiveActorLeaseRequired': True,
    'receiver': {
        'type': 'NEUTRAL_STATIONARY_CODE_NATIVE_UI_CONTAINER',
        'canonicalPropClaim': False,
        'coordinateSystem': 'SINGLE_SVG_SHARED_WITH_BODY',
        'viewBox': [243, 35, 1076, 927],
        'rimCenter': [1214, 790],
        'rimWidth': 150,
        'baseY': 942,
        'minHostSize': [104, 192],
        'maxSvgWidth': 129,
        'independentTransforms': False,
    },
    'mandatoryLabel': 'UI 재배치 · 고정 컵 추가 · 원작에서는 쿠리만쥬가 잔을 듦',
    'sourceContext': 'The source glass is held by Kurimanju. This separate UI container does not reproduce or replace that relationship.',
}


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def load_shisa_source(root, data_uri):
    """Return data URI only for exact reviewed bytes and fixed metadata, else None.

    No files are written. Missing, escaped, modified or out-of-scope inputs fail
    closed. The caller still owns the explicit trigger and integrated runtime QA.
    """
    try:
        root = Path(root).resolve()
        config_path = (root / CONFIG_PATH).resolve()
        asset_path = (root / ASSET_PATH).resolve()
        if not config_path.is_relative_to(root) or not asset_path.is_relative_to(root):
            return None
        if config_path.stat().st_size > 16384 or asset_path.stat().st_size > 2 * 1024 * 1024:
            return None
        config = json.loads(config_path.read_text(encoding='utf-8'))
        if _canonical(config) != _canonical(EXPECTED_CONFIG):
            return None
        raw = asset_path.read_bytes()
        if len(raw) < 33 or raw[:8] != b'\x89PNG\r\n\x1a\n' or raw[8:16] != b'\x00\x00\x00\rIHDR':
            return None
        if list(struct.unpack('>II', raw[16:24])) != [1536, 1024]:
            return None
        if hashlib.sha256(raw).hexdigest() != APPROVED_SHA256:
            return None
        result = data_uri(asset_path)
        return result if isinstance(result, str) and result.startswith('data:image/png;base64,') else None
    except (OSError, ValueError, TypeError, struct.error):
        return None
