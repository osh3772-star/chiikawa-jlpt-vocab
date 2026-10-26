"""Static/build gates for the three-entry package; no browser ownership required."""
import base64, hashlib, json, re, tempfile, unittest
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from build_pages import build, BASE_SHA

class SeparatePageBuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.site=Path(cls.temp.name);build(cls.site)
    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()
    def test_three_actual_entries_and_initializer_ownership(self):
        for name,page in [('index','home'),('character-settings','settings'),('study','study')]:
            text=(self.site/(name+'.html')).read_text()
            self.assertIn('data-page="'+page+'"',text)
            self.assertEqual('id="home"' in text,page=='home')
            self.assertEqual('id="study"' in text,page=='study')
            self.assertEqual('id="study-backup"' in text,page=='home')
            self.assertEqual('id="background-choice"' in text,page=='settings')
            self.assertEqual('src="study-runtime.js"' in text,page!='settings')
            self.assertEqual('src="pet-runtime.js"' in text,page!='home')
            self.assertLess(len(text.encode()),10000)
            self.assertNotRegex(text,r'href="#[^"]*"')
    def test_vocabulary_and_original_public_images(self):
        report=json.loads((self.site/'manifest.json').read_text())
        self.assertEqual(report['legacySha256'],BASE_SHA)
        self.assertEqual(report['wordCount'],7180);self.assertEqual(report['publicPNGCount'],13)
        for path,item in report['files'].items():
            b=(self.site/path).read_bytes();self.assertEqual(len(b),item['bytes']);self.assertEqual(hashlib.sha256(b).hexdigest(),item['sha256'])
            if path.startswith('assets/'):
                self.assertEqual(Path(path).stem,item['sha256']);self.assertTrue(b.startswith(b'\x89PNG\r\n\x1a\n'))
        source=(ROOT/'legacy-self-contained.html').read_text()
        baseline=json.loads(re.search(r'<script id="vocabulary" type="application/json">(.*?)</script>',source,re.S)[1])
        built=json.loads((self.site/'vocabulary.js').read_text().split('=',1)[1].rstrip(';\n'))
        self.assertEqual(built,baseline)
    def test_rebuild_is_byte_deterministic(self):
        before={str(p.relative_to(self.site)):p.read_bytes() for p in self.site.rglob('*') if p.is_file()}
        build(self.site)
        self.assertEqual(before,{str(p.relative_to(self.site)):p.read_bytes() for p in self.site.rglob('*') if p.is_file()})
