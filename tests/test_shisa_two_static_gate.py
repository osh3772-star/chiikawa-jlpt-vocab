import copy,json,shutil,tempfile,unittest
from pathlib import Path
from shisa_two_static_gate import ASSET_PATH,CLOSED_PATH,CONFIG_PATH,EXPECTED_CONFIG,load_shisa_two_sources
HERE=Path(__file__).resolve().parent
class GateTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(dir=HERE);self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);self.calls=[]
  for rel,source in [(ASSET_PATH,'shisa-pour-v2.png'),(CLOSED_PATH,'supplement-gapA/shisa-pour-closed-v2.png')]:
   target=self.root/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(HERE.parent/rel,target)
  self.write(EXPECTED_CONFIG)
 def write(self,c): (self.root/CONFIG_PATH).write_text(json.dumps(c),encoding='utf-8')
 def uri(self,p): self.calls.append(p);return 'data:image/png;base64,'+p.name
 def test_exact_pair_only(self):
  result=load_shisa_two_sources(self.root,self.uri);self.assertEqual(set(result),{'open','closed'});self.assertEqual(len(self.calls),2)
 def test_either_asset_corruption_or_missing_rejects_before_encoding(self):
  for rel in [ASSET_PATH,CLOSED_PATH]:
   path=self.root/rel;raw=path.read_bytes()
   for bad in [b'bad',raw[:16]+(1535).to_bytes(4,'big')+raw[20:],raw[:-1]+bytes([raw[-1]^1])]:
    path.write_bytes(bad);self.assertIsNone(load_shisa_two_sources(self.root,self.uri))
   path.unlink();self.assertIsNone(load_shisa_two_sources(self.root,self.uri));path.write_bytes(raw)
  self.assertEqual(self.calls,[])
 def test_scope_order_timing_receiver_and_escape_rejected(self):
  cases=[]
  for k,v in [('enabledByDefault',True),('productionEnabled',True),('motionActivation',True),('poseOrder',['closed','open']),('holdBeforeClosedMs',100),('bodyPoseCount',3),('reviewScope','FULL_ANIMATION'),('streamAnimation',True),('pairRelationshipReproduced',True)]:
   c=copy.deepcopy(EXPECTED_CONFIG);c[k]=v;cases.append(c)
  c=copy.deepcopy(EXPECTED_CONFIG);c['receiver']['rimCenter']=[1200,790];cases.append(c)
  c=copy.deepcopy(EXPECTED_CONFIG);c['assets']['closed']['path']='../closed.png';cases.append(c)
  for c in cases:self.write(c);self.assertIsNone(load_shisa_two_sources(self.root,self.uri))
  self.write(EXPECTED_CONFIG);path=self.root/CLOSED_PATH;path.unlink();path.symlink_to(HERE.parent/CLOSED_PATH);self.assertIsNone(load_shisa_two_sources(self.root,self.uri));self.assertEqual(self.calls,[])
if __name__=='__main__':unittest.main()
