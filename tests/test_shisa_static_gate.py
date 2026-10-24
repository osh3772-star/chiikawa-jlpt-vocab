import copy
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from shisa_static_gate import ASSET_PATH, CONFIG_PATH, EXPECTED_CONFIG, load_shisa_source

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / ASSET_PATH

class GateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=HERE)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.asset = self.root / ASSET_PATH
        self.asset.parent.mkdir(parents=True)
        shutil.copyfile(SOURCE, self.asset)
        self.config = self.root / CONFIG_PATH
        self.write(EXPECTED_CONFIG)
        self.calls = []
    def write(self, value):
        self.config.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    def uri(self, path):
        self.calls.append(path)
        return 'data:image/png;base64,approved-test'
    def test_exact_review_passes(self):
        self.assertEqual(load_shisa_source(self.root, self.uri), 'data:image/png;base64,approved-test')
        self.assertEqual(self.calls, [self.asset.resolve()])
    def test_missing_corrupt_dimensions_or_bytes_fail_before_encoding(self):
        raw = self.asset.read_bytes()
        for bad in [b'not png', raw[:16] + (1535).to_bytes(4, 'big') + raw[20:], raw[:-1] + bytes([raw[-1] ^ 1])]:
            with self.subTest(size=len(bad)):
                self.asset.write_bytes(bad)
                self.assertIsNone(load_shisa_source(self.root, self.uri))
        self.asset.unlink()
        self.assertIsNone(load_shisa_source(self.root, self.uri))
        self.assertEqual(self.calls, [])
    def test_scope_defaultoff_receiver_and_path_fail_closed(self):
        variants = []
        for key, value in [('enabledByDefault', True), ('productionEnabled', True), ('enabledByDefault', 0), ('bodyPoseCount', 2), ('reviewScope', 'FULL_ANIMATION'), ('assetPath', '../escaped.png'), ('streamAnimation', True), ('pairRelationshipReproduced', True)]:
            config = copy.deepcopy(EXPECTED_CONFIG)
            config[key] = value
            variants.append(config)
        config = copy.deepcopy(EXPECTED_CONFIG)
        config['receiver']['rimCenter'] = [1200, 790]
        variants.append(config)
        config = copy.deepcopy(EXPECTED_CONFIG)
        config['receiver']['independentTransforms'] = True
        variants.append(config)
        for config in variants:
            self.write(config)
            self.assertIsNone(load_shisa_source(self.root, self.uri))
        self.write(EXPECTED_CONFIG)
        outside = self.root / 'outside.json'
        outside.write_text('{}')
        self.config.unlink()
        self.config.symlink_to(HERE / 'shisa-static.json')
        self.assertIsNone(load_shisa_source(self.root, self.uri))
        self.assertEqual(self.calls, [])

if __name__ == '__main__':
    unittest.main()
