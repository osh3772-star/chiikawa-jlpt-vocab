"""Exact reviewed PNG gates for limited Hachiware/Usagi fragments."""
import hashlib,json,struct
from pathlib import Path
from evidence_registry import require,safe_relative
REVIEWED={
 'hachiware':[
  ('A','f6a144ee522c65f8d5f39d848808db98ba3cc9d9407da082dcb54eeb129e7849',[1536,1024]),
  ('B','1421a8f741624ceabafb23817d62af90332b44af23cc43b2b09fcf7a6ea3dadc',[1536,1024])],
 'usagi':[
  ('A','e99a8394a5f3a197fa33d5a7545e4b6c6be070606b97ef042a9e99619371c76b',[1295,1214]),
  ('B','f758443800258cf493fcf6d489ca446b1afc0d9cc01c16887294bc1d42d39125',[1254,1254]),
  ('C','34bdc56336774d67d68717c3fc89efd8555f9f2bd0164061589120ac7445ae63',[1254,1254])]}
SCOPES={'hachiware':'LIMITED_TWO_STATIC_CAMEOS_VISUAL_PASS','usagi':'LIMITED_EP6_REGISTERED_FRAGMENT'}
def load_fragment_sources(root,data_uri):
 root=Path(root).resolve();path=root/'chiikawa-pets/limited-previews/fragment-assets.json'
 if not path.exists():return {}
 c=json.loads(path.read_text());require(c.get('schemaVersion')==1 and c.get('testingAuthorized') is True and c.get('enabledByDefault') is False and c.get('productionEnabled') is False,'Limited fragments must remain opt-in testing')
 require(set(c['characters'])==set(REVIEWED),'Unexpected fragment characters');result={}
 for who,expected in REVIEWED.items():
  entry=c['characters'][who];require(entry.get('scope')==SCOPES[who] and entry.get('timingOrigin')=='AUTHORED_WEB_UX','Unreviewed fragment scope/timing')
  require(len(entry['frames'])==len(expected),'Unexpected frame count');sources=[]
  for frame,(pose,sha,size) in zip(entry['frames'],expected):
   require(frame.get('poseId')==pose and frame.get('assetSha256')==sha and frame.get('assetSize')==size,'Unreviewed/reordered fragment frame')
   p=(root/safe_relative(frame['assetPath'])).resolve();require(p.is_relative_to(root),'Fragment asset outside project');raw=p.read_bytes()
   require(hashlib.sha256(raw).hexdigest()==sha and raw[:8]==b'\x89PNG\r\n\x1a\n' and list(struct.unpack('>II',raw[16:24]))==size,'Fragment pixels/geometry differ from reviewed PNG')
   sources.append(data_uri(p))
  result[who]=sources
 return result
