"""Builder contracts; fixture PNGs are copied unchanged, never generated/warped."""
import copy
import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from animation_manifest import load_manifests


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        directory = self.root / 'chiikawa-pets/action-manifests'
        directory.mkdir(parents=True)
        self.path = directory / 'chiikawa.json'
        source = ROOT / 'chiikawa_hachiware_usagi_assets/chiikawa/assets/characters/chiikawa'
        for name in ('idle', 'happy'):
            shutil.copyfile(source / f'{name}.png', self.root / f'{name}.png')
        self.manifest = {'characterId': 'chiikawa', 'modelVersion': 'test-only-not-art-approval', 'approvalStatus': 'approved', 'actions': {'walk': {'views': {'right': {'loop': True, 'rootDistance': .4, 'totalDurationMs': 200, 'frames': [
            {'frameId': name, 'assetPath': f'{name}.png', 'durationMs': 100, 'pivot': [.5, 1], 'contactFlags': {'L': True, 'R': False}} for name in ('idle', 'happy')
        ]}}}}}

    def tearDown(self):
        self.temp.cleanup()

    def load(self):
        self.path.write_text(json.dumps(self.manifest))
        return load_manifests(self.root, {'chiikawa': {}}, lambda p: 'data:test,' + p.name)

    def view(self):
        return self.manifest['actions']['walk']['views']['right']

    def test_manifest_packages_each_asset_once(self):
        manifest = self.load()['chiikawa']
        self.assertEqual(len(manifest['assets']), 2)
        self.assertNotIn('source', manifest['actions']['walk']['views']['right']['frames'][0])

    def test_unapproved_art_is_not_enabled(self):
        self.manifest['approvalStatus'] = 'reviewed'
        self.assertEqual(self.load(), {})

    def test_invalid_timing_contact_rectangle_and_path_rejected(self):
        original = copy.deepcopy(self.manifest)
        mutations = [
            lambda v: v['frames'][0].update(durationMs=0),
            lambda v: v['frames'][0].update(contactFlags={}),
            lambda v: v['frames'][0].update(sourceRect=[0, 0, 999999, 999999]),
            lambda v: v['frames'][0].update(assetPath='../outside.png'),
            lambda v: v.update(totalDurationMs=999),
            lambda v: v.update(mirror=True),
        ]
        for mutate in mutations:
            self.manifest = copy.deepcopy(original)
            mutate(self.view())
            with self.assertRaises(AssertionError):
                self.load()

    def test_repeated_still_is_not_a_cycle(self):
        self.view()['frames'][1]['assetPath'] = 'idle.png'
        with self.assertRaisesRegex(AssertionError, 'not a cycle'):
            self.load()

    def test_sheet_rectangles_share_one_embedded_asset(self):
        for index, frame in enumerate(self.view()['frames']):
            frame.update(assetPath='idle.png', sourceRect=[index * 10, 0, 10, 10])
        self.assertEqual(len(self.load()['chiikawa']['assets']), 1)


class BuiltHTMLTests(unittest.TestCase):
    def test_offline_payload_and_learning_contract(self):
        html = (ROOT / '단어장.html').read_text()
        def payload(name):
            return json.loads(re.search(rf'<script id="{name}" type="application/json">(.*?)</script>', html, re.S)[1])
        self.assertEqual(sum(map(len, payload('vocabulary').values())), 7180)
        self.assertEqual(len(payload('pet-profiles')), 6)
        self.assertTrue(all(src.startswith('data:') for poses in payload('pet-sprites').values() for src in poses.values()))
        self.assertIn('jlpt-local-vocabulary-v1', html)
        self.assertIn('jlpt-pet-mobile-group-v1', html)
        self.assertNotRegex(html, r'__(?:DATA|PET_\w+|THEME_CSS)__')
        self.assertNotIn('cv-pet-squash', html)
        self.assertNotRegex(html, r'<script[^>]+src=')


class DraftPreviewTests(unittest.TestCase):
    def test_lab_remains_isolated_and_draft(self):
        config = json.loads((ROOT / 'chiikawa-pets/draft-preview/config.json').read_text())
        self.assertEqual(config['approvalStatus'], 'draft')
        self.assertEqual(len(config['frames']), 4)
        production = ROOT / 'chiikawa-pets/action-manifests/chiikawa.json'
        if production.exists():
            self.assertNotIn('draft-preview/assets', production.read_text())
        for frame in config['frames']:
            x, y, w, h = frame['sourceRect']
            self.assertLessEqual(x + w, config['assetSize'][0])
            self.assertLessEqual(y + h, config['assetSize'][1])
            self.assertTrue(all(0 <= v <= 1 for v in frame['pivot']))
        html = (ROOT / '치이카와_동작_초안.html').read_text()
        self.assertIn('DRAFT', html)
        self.assertNotIn('localStorage', html.split('<script>')[1])
        self.assertNotIn('mountChiikawaPets', html)


class BetaManifestTests(unittest.TestCase):
    def test_real_app_beta_is_explicitly_draft_and_uses_independent_assets(self):
        from beta_manifest import load_chiikawa_beta
        manifest = load_chiikawa_beta(ROOT, lambda p: 'fixture:' + p.name)
        self.assertEqual(manifest['approvalStatus'], 'draft')
        self.assertTrue(manifest['experimental'])
        self.assertIn('hold', manifest['actions'])
        self.assertIn('landing', manifest['actions'])
        self.assertEqual(len(manifest['actions']['hold']['views']['front']['frames']), 3)
        self.assertEqual(len(manifest['actions']['landing']['views']['front']['frames']), 4)
        # Sheet-normalized scaling stays consistent when crop cell widths differ.
        walk_frame = manifest['actions']['idle']['views']['front']['frames'][0]
        held_frame = manifest['actions']['hold']['views']['front']['frames'][0]
        self.assertAlmostEqual(held_frame['renderScale'] / held_frame['sourceRect'][2],
                               1 / 600 * 1.08)


if __name__ == '__main__':
    unittest.main()
