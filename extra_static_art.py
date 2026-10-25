"""One reviewed opt-in static rail image. Never adds an engine actor/action."""
import hashlib,struct
EXPECTED='baee1b3a1c72013f825d5534bffba94d499604f412431b14c46173f6e17209d3'
def load_extra_static_art(root,data_uri):
 p=root/'chiikawa-pets/extra-static/kurimanju.png';b=p.read_bytes()
 if hashlib.sha256(b).hexdigest()!=EXPECTED or b[:8]!=b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',b[16:24])!=(1222,1287):raise ValueError('Unreviewed Kurimanju static art')
 return {'id':'kurimanju','label':'쿠리만쥬','source':data_uri(p),'sha256':EXPECTED,'nativeSize':[1222,1287],'displayWidth':120,'sourceApproved':True,'artApproved':True,'staticDisplay':True,'defaultVisible':False,'scope':'STATIC_RAIL_CUP_HELD_POSE_ONLY','drag':False,'directResponse':False,'autonomous':False,'studyReaction':False,'pair':False}
