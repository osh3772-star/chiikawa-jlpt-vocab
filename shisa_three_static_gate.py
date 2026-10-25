"""Stdlib-only, fail-closed gate for locally authorized Diagonal→Open→Closed static UI testing."""
import hashlib
import json
import struct
from pathlib import Path

ASSET_PATH = 'chiikawa-pets/limited-previews/assets/shisa-ep264/shisa-pour-v2.png'
CONFIG_PATH = 'chiikawa-pets/limited-previews/shisa-three-static.json'
CLOSED_PATH = 'chiikawa-pets/limited-previews/assets/shisa-ep264/shisa-pour-closed-v2.png'
CLOSED_SHA256 = 'd847580c9e075774ddedf9be2865e742f4ec523330fc2154480505a12bcb4010'
APPROVED_SHA256 = '7b0d66ff4cfdd5d8a107799debaf428a02d4f18c4c64e7d572cf1d568ea64866'
EXPECTED_CONFIG = {'schemaVersion': 1, 'characterId': 'shisa', 'testingAuthorized': True, 'enabledByDefault': False, 'productionEnabled': False, 'reviewScope': 'LIMITED_DIAGONAL_OPEN_CLOSED_UI_ADAPTATION_LOCAL_TESTING', 'bodyPoseCount': 3, 'assets': {'open': {'path': 'chiikawa-pets/limited-previews/assets/shisa-ep264/shisa-pour-v2.png', 'sha256': '7b0d66ff4cfdd5d8a107799debaf428a02d4f18c4c64e7d572cf1d568ea64866'}, 'closed': {'path': 'chiikawa-pets/limited-previews/assets/shisa-ep264/shisa-pour-closed-v2.png', 'sha256': 'd847580c9e075774ddedf9be2865e742f4ec523330fc2154480505a12bcb4010'}, 'diagonal': {'path': 'chiikawa-pets/limited-previews/assets/shisa-ep264/shisa-diagonal-v2.png', 'sha256': 'fac5c3eae638d9403facc5b67b2806473aded29b0cfff4a57bdd8f0943485f2f'}}, 'poseOrder': ['diagonal', 'open', 'closed'], 'timingOrigin': 'AUTHORED_UI_POSE_RHYTHM', 'afterClosed': 'STATIC_HOLD_UNTIL_CANCEL', 'reducedOrPaused': 'DIAGONAL_STATIC_ONLY', 'interpolation': False, 'motionActivation': False, 'assetSize': [1536, 1024], 'sourceRepresentation': 'THREE_DERIVED_STATIC_POSES_WITH_AUTHORED_UI_RECEIVER', 'originalPixels': False, 'sourceTimingClaim': False, 'pairRelationshipReproduced': False, 'poseAnimation': False, 'streamAnimation': False, 'liquidLevelAnimation': False, 'loop': False, 'trigger': 'EXPLICIT_ONLY', 'exclusiveActorLeaseRequired': True, 'receiver': {'type': 'NEUTRAL_STATIONARY_CODE_NATIVE_UI_CONTAINER', 'canonicalPropClaim': False, 'coordinateSystem': 'SINGLE_SVG_SHARED_WITH_BODY', 'viewBox': [243, 35, 1076, 927], 'rimCenter': [1214, 790], 'rimWidth': 150, 'baseY': 942, 'minHostSize': [104, 192], 'maxSvgWidth': 129, 'independentTransforms': False}, 'mandatoryLabel': 'UI 재배치 · 고정 컵 추가 · 원작에서는 쿠리만쥬가 잔을 듦', 'sourceContext': 'The source glass is held by Kurimanju. This separate UI container does not reproduce or replace that relationship.', 'holdMs': 650}


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def load_shisa_three_sources(root, data_uri):
    """Return all three data URIs only for exact locally reviewed inputs.

    Missing, changed, escaped or out-of-scope metadata/assets fail closed.
    This authorizes limited UI testing only, not motion activation or publication.
    """
    try:
        root = Path(root).resolve()
        config_path = (root / CONFIG_PATH).resolve()
        if not config_path.is_relative_to(root) or config_path.stat().st_size > 16384:
            return None
        config = json.loads(config_path.read_text(encoding='utf-8'))
        if _canonical(config) != _canonical(EXPECTED_CONFIG):
            return None
        checked = {}
        for pose, item in EXPECTED_CONFIG['assets'].items():
            path = (root / item['path']).resolve()
            if not path.is_relative_to(root) or path.stat().st_size > 2 * 1024 * 1024:
                return None
            raw = path.read_bytes()
            if len(raw) < 33 or raw[:8] != b'\x89PNG\r\n\x1a\n' or raw[8:16] != b'\x00\x00\x00\rIHDR':
                return None
            if list(struct.unpack('>II', raw[16:24])) != [1536, 1024] or hashlib.sha256(raw).hexdigest() != item['sha256']:
                return None
            checked[pose] = path
        result = {pose: data_uri(path) for pose, path in checked.items()}
        return result if all(isinstance(uri, str) and uri.startswith('data:image/png;base64,') for uri in result.values()) else None
    except (OSError, ValueError, TypeError, struct.error):
        return None
