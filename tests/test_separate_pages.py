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
            self.assertEqual('src="study-runtime.js?v=' in text,page!='settings')
            self.assertEqual('src="pet-runtime.js?v=' in text,page!='home')
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
    def test_parent_styles_exclude_iframe_srcdoc_and_keep_scoped_settings_scroll(self):
        css=(self.site/'app.css').read_text()
        self.assertNotIn("'+inputCss+'",css)
        self.assertNotIn('html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}',css)
        self.assertIn('body.cv-study-overlay{height:auto;min-height:100dvh;overflow-y:auto;',css)
        self.assertIn('body.cv-reserved-lane-candidate{padding:0!important;height:100dvh;overflow:hidden;',css)
        self.assertIn('body.cv-character-only{padding:0!important;min-height:100dvh;height:100dvh;overflow:auto!important;',css)
        runtime=(self.site/'pet-runtime.js').read_text()
        self.assertIn("html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}",runtime)
    def test_entry_asset_versions_equal_content_hash_and_remain_relative(self):
        from urllib.parse import urlsplit, parse_qs
        for name in ['index.html','character-settings.html','study.html']:
            html=(self.site/name).read_text()
            refs=re.findall(r'<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"',html)
            self.assertTrue(refs)
            for ref in refs:
                url=urlsplit(ref)
                self.assertFalse(url.scheme);self.assertFalse(url.netloc)
                self.assertNotIn('/',url.path);self.assertFalse(url.fragment)
                self.assertEqual(parse_qs(url.query),{'v':[hashlib.sha256((self.site/url.path).read_bytes()).hexdigest()[:12]]})
    def test_frozen_overlay_release_has_exact_manifest_and_file_set(self):
        manifest=(self.site/'manifest.json').read_bytes()
        self.assertEqual(hashlib.sha256(manifest).hexdigest(),'0b5bbfbfef25a4908a9d80fab330f42096c6e62f32284efae663c47b5ace847d')
        expected=set(json.loads(manifest)['files'])|{'manifest.json'}
        actual={str(p.relative_to(self.site)) for p in self.site.rglob('*') if p.is_file()}
        self.assertEqual(actual,expected);self.assertEqual(len(actual),24)
    def test_rebuild_is_byte_deterministic(self):
        before={str(p.relative_to(self.site)):p.read_bytes() for p in self.site.rglob('*') if p.is_file()}
        build(self.site)
        self.assertEqual(before,{str(p.relative_to(self.site)):p.read_bytes() for p in self.site.rglob('*') if p.is_file()})
