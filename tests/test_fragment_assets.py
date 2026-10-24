import unittest,json,tempfile,shutil
from pathlib import Path
from fragment_assets import load_fragment_sources
from evidence_registry import EvidenceContractError
ROOT=Path(__file__).resolve().parents[1]
class FragmentAssetsTests(unittest.TestCase):
    def test_reviewed_assets_exact_scope_and_count(self):
        sources=load_fragment_sources(ROOT,lambda p:p.name)
        self.assertEqual(len(sources['hachiware']),2);self.assertEqual(len(sources['usagi']),3)
        self.assertIn('usagi-ep6-B-v2.png',sources['usagi']);self.assertNotIn('usagi-ep6-B-v1.png',sources['usagi'])
    def test_metadata_edits_cannot_promote_wrong_pixels_or_timing(self):
        for mode in ('scope','timing','hash','count','enabled'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as folder:
                root=Path(folder);dest=root/'chiikawa-pets/limited-previews';shutil.copytree(ROOT/'chiikawa-pets/limited-previews',dest)
                path=dest/'fragment-assets.json';c=json.loads(path.read_text());entry=c['characters']['usagi']
                if mode=='scope':entry['scope']='FULL_CONTINUOUS_JUMP'
                elif mode=='timing':entry['timingOrigin']='VIDEO_EXACT'
                elif mode=='hash':entry['frames'][1]['assetSha256']='unreviewed'
                elif mode=='count':entry['frames'].append(entry['frames'][0])
                else:c['enabledByDefault']=True
                path.write_text(json.dumps(c))
                with self.assertRaises(EvidenceContractError):load_fragment_sources(root,lambda p:p.name)
