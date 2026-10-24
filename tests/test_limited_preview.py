import json
from pathlib import Path
import shutil
import tempfile
import unittest
from limited_preview import load_momonga_preview
from evidence_registry import EvidenceContractError, load_motion_registry
ROOT=Path(__file__).resolve().parents[1]
class LimitedPreviewTests(unittest.TestCase):
    def test_reviewed_body_is_one_derived_opt_in_pose_linked_to_registry(self):
        asset=load_momonga_preview(ROOT,lambda p:'data:test')
        self.assertFalse(asset['productionEnabled']);self.assertFalse(asset['enabledByDefault'])
        self.assertEqual(asset['bodyPoseCount'],1);self.assertFalse(asset['originalPixels'])
        mapping=next(m for m in load_motion_registry(ROOT)['mappings'] if m['mappingId']==asset['mappingId'])
        self.assertTrue(mapping['previewTestingAuthorized']);self.assertEqual(mapping['previewReviewId'],asset['reviewId']);self.assertFalse(mapping['enabled']);self.assertEqual(mapping['previewAssetSha256'],asset['assetSha256'])
    def test_changed_image_review_or_default_cannot_bypass_gate(self):
        for change in ('image','review','default','duration'):
            with self.subTest(change=change),tempfile.TemporaryDirectory() as folder:
                root=Path(folder);base=root/'chiikawa-pets/limited-previews'
                shutil.copytree(ROOT/'chiikawa-pets/limited-previews',base)
                path=base/'momonga.json';c=json.loads(path.read_text())
                if change=='image':
                    with (root/c['assetPath']).open('ab') as f:f.write(b'changed')
                elif change=='review':
                    (root/c['reviews']['art']['path']).write_text('{}')
                else:
                    c['enabledByDefault' if change=='default' else 'durationMs']=True if change=='default' else 999
                    path.write_text(json.dumps(c))
                with self.assertRaises(EvidenceContractError):load_momonga_preview(root,lambda p:'data:test')
