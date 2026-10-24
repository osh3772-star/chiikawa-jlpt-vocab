import unittest,tempfile,json
from pathlib import Path
from observed_fragments import load_observed_fragments,EXPECTED
class ObservedGateTests(unittest.TestCase):
 def test_reviewed_pngs_and_geometry(self):
  result=load_observed_fragments(Path(__file__).resolve().parents[1],str)
  self.assertEqual([f['poseId'] for f in result['usagi-lowering']['frames']],['D','E','C'])
  self.assertEqual([f['poseId'] for f in result['rakko-expression']['frames']],['open','closed'])
 def test_scope_timing_and_registration_mutation_rejected(self):
  for field,value in [('motionActivation',True),('holdMs',300),('loop',True),('windowSize',[200,100])]:
   with self.subTest(field=field),tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);p=root/'chiikawa-pets/limited-previews/observed-fragments.json';p.parent.mkdir(parents=True)
    c=json.loads(json.dumps(EXPECTED));c['usagi-lowering'][field]=value;p.write_text(json.dumps(c))
    with self.assertRaises(ValueError):load_observed_fragments(root,str)
