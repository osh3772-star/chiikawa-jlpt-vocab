"""Exact-scope regression for normal Kani frame routing, not visual approval."""
import json,re,hashlib,unittest
from pathlib import Path
from interaction_sequences import adapt_kani_interactions
ROOT=Path(__file__).resolve().parents[1]

class KaniInteractionBuildTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.original=(ROOT/'legacy-self-contained.html').read_text()
  cls.before=re.findall(r'<script([^>]*)>(.*?)</script>',cls.original,re.S)[3][1]
  cls.after=adapt_kani_interactions(cls.before,ROOT)
 def engine(self,text):
  marker='const inputEngine=';start=text.index(marker)+len(marker)
  value,size=json.JSONDecoder().raw_decode(text[start:]);return start,size,value
 def test_only_input_engine_and_existing_normal_tap_bridge_change(self):
  a,n,_=self.engine(self.before);b,m,value=self.engine(self.after)
  self.assertEqual(a,b);self.assertEqual(value,(ROOT/'chiikawa-pets/kani-input-engine.js').read_text())
  normalized=self.after[:b]+self.before[a:a+n]+self.after[b+m:]
  normalized=normalized.replace('onDeliberateInteraction:()=>{p.playKaniPreview("read");return true;}','onDeliberateInteraction:()=>true')
  self.assertEqual(normalized,self.before)
 def test_existing_production_kani_image_payload_and_original_sources_are_preserved(self):
  before=re.findall(r'data:image/[^\s"\x27<>`\\]+',self.before)
  after=re.findall(r'data:image/[^\s"\x27<>`\\]+',self.after)
  self.assertEqual(before,after)
  coverage=json.loads((ROOT/'docs/design/interaction-sequence-coverage.json').read_text())
  for entry in coverage['kani']['states'].values():
   self.assertEqual(entry['count'],entry['uniqueProductionRasters'])
   for frame in entry['frames']:
    self.assertEqual(hashlib.sha256((ROOT/frame['sourcePath']).read_bytes()).hexdigest(),frame['sourcePNG'])
 def test_no_autonomous_walk_or_absent_physical_art_approval_is_added(self):
  _,_,engine=self.engine(self.after)
  self.assertIn("key:'idle',loop:true",engine)
  self.assertIn("key:'grabbed',loop:true",engine)
  self.assertIn("missing-sequence:${c.mode||'physical'}",engine)
  coverage=json.loads((ROOT/'docs/design/interaction-sequence-coverage.json').read_text())
  self.assertFalse(coverage['kani']['naturalWalkingApproved'])
  self.assertNotIn('walk',[k for k,v in coverage['kani']['states'].items()if v['enabledInOrdinaryInput']])
 def test_unexpected_duplicate_or_missing_frozen_targets_fail_before_mutation(self):
  for changed in [self.before.replace('const inputEngine=','const otherInput='),self.before+self.before,self.before.replace('onDeliberateInteraction:()=>true','onDeliberateInteraction:()=>false')]:
   with self.assertRaises(ValueError):adapt_kani_interactions(changed,ROOT)
