"""Validate reviewed cameo poses; source timestamps never become authored timing."""
import hashlib
import json
import struct
from pathlib import Path
from evidence_registry import require, safe_relative
REVIEWED = {
 'A': ('5c9a928e461ffb63263820743967af4b29b5b478ee41c4eabb6989a2f1d25039',[245,99,972,915],120),
 'A1': ('871eb59aadbb940b1d16c430e3c109bf896e60900ebea69b8d019829079b0879',[343,151,812,807],114),
 'B': ('1a0a801f163034ade003f00d90595e3e1b55cc8dfcae38dc0a7d2332fc358eef',[316,116,817,852],114),
 'C': ('ba9b9fce7675b6301e358dc937076e926ffa9888c39f7ab2deb6e58f419f6844',[263,120,963,902],120),
}
def load_static_cameo(root,data_uri):
 root=Path(root).resolve();path=root/'chiikawa-pets/limited-previews/chiikawa-ep2-a.json'
 if not path.exists():return None
 c=json.loads(path.read_text())
 require(c.get('schemaVersion')==2 and c.get('previewId')=='chiikawa.ep2.four-keypose-cameo' and c.get('characterId')=='chiikawa','Unexpected cameo identity')
 require(c.get('testingAuthorized') is True and c.get('enabledByDefault') is False and c.get('productionEnabled') is False,'Cameo must remain opt-in limited testing')
 require(c.get('reviewScope')=='LIMITED_FOUR_KEYPOSE_PREVIEW' and c.get('reviewId')=='CHIIKAWA_EP2_FOUR_KEYPOSE_COMPOSITION_20261024','Wrong composition scope')
 require(c.get('bodyPoseCount')==4 and c.get('sourceRepresentation')=='DERIVED_UPPERBODY_CAMEO','Exactly four reviewed upperbody poses required')
 require(c.get('timingOrigin')=='AUTHORED_WEB_UX' and c.get('loop') is False and c.get('interpolation') is False and c.get('reducedMotionPose')=='A' and c.get('completion')=='C_STATIC_UNTIL_CLOSE','No inferred timing, loop or interpolated poses')
 require(c.get('windowSize')==[140,124],'Manual fixed cameo viewport requires visual review')
 require([f.get('poseId') for f in c.get('frames',[])]==list(REVIEWED),'Only reviewed A A1 B C order is allowed')
 for f,duration in zip(c['frames'],[420,320,450,600]):
  sha,rect,width=REVIEWED[f['poseId']]
  require(f.get('reviewScope')=='LIMITED_STATIC_CAMEO_VISUAL_PASS' and f.get('assetSha256')==sha,'Unreviewed pose pixels/scope')
  p=(root/safe_relative(f['assetPath'])).resolve();require(p.is_relative_to(root),'Asset escapes root');raw=p.read_bytes()
  require(hashlib.sha256(raw).hexdigest()==sha,'Cameo pixels differ from review')
  require(raw[:8]==b'\x89PNG\r\n\x1a\n' and list(struct.unpack('>II',raw[16:24]))==f.get('assetSize')==[1448,1086],'Pose geometry mismatch')
  require(f.get('sourceRect')==rect and f.get('displayWidth')==width,'Manual isotropic crop requires renewed visual QA')
  require(f.get('durationMs')==duration,'Authored timing change requires review; never infer source timing')
  f['source']=data_uri(p)
 return c
