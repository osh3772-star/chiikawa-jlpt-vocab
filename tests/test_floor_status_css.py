"""Static accessibility/ownership contract; actual font layout is a browser QA gate."""
import re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class FloorStatusCSS(unittest.TestCase):
 def setUp(self):
  self.css=(ROOT/'continuous-walk/ui.css').read_text()
  body=re.search(r'#continuous-walk-status\{([^}]+)\}',self.css).group(1)
  self.rule=dict((k.strip(),v.strip()) for k,v in (d.split(':',1) for d in body.split(';') if ':' in d))
 def test_dedicated_status_row_and_three_line_minimum(self):
  self.assertEqual(self.rule['flex'],'0 0 100%');self.assertEqual(self.rule['min-inline-size'],'0')
  self.assertEqual(self.rule['min-block-size'],'4.2em');self.assertAlmostEqual(float(self.rule['min-block-size'][:-2])/float(self.rule['line-height']),3)
 def test_long_text_can_grow_and_wrap_without_clipping(self):
  self.assertEqual(self.rule['overflow-wrap'],'anywhere')
  for key in ['height','block-size','max-height','max-block-size','overflow','overflow-y','white-space','line-clamp','-webkit-line-clamp']:
   self.assertNotIn(key,self.rule)
  self.assertNotIn('overflow:hidden',self.css);self.assertNotIn('text-overflow',self.css);self.assertNotIn('container-type',self.css)
 def test_existing_buttons_and_full_status_strings_remain(self):
  self.assertIn('display:flex;align-items:center;gap:8px;flex-wrap:wrap',self.css)
  self.assertIn('transform:none!important',self.css);self.assertIn('min-height:44px',self.css)
  js=(ROOT/'continuous-walk/ui.js').read_text()
  for text in ['걷기 준비 중…','바닥에서 걷는 중 · 잡거나 정지할 수 있어요.','걷기 자동 정지 · 멈춘 이유: ','바닥에서 걸을 공간이 부족해요. 다른 캐릭터를 옮긴 뒤 다시 눌러 주세요.']:
   self.assertIn(text,js)
if __name__=='__main__':unittest.main()
