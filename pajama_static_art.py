"""Exact user-provided composite; no bundled JavaScript or animation adoption."""
import hashlib,struct
EXPECTED='179a54041b740f6fa8a485228763b2250f0998ab11e28fdfe7034a1e3c59a68f'
def load_pajama_static_art(root,data_uri):
 p=root/'chiikawa-pets/extra-static/pajama-parties-idle.png';b=p.read_bytes()
 if hashlib.sha256(b).hexdigest()!=EXPECTED or b[:8]!=b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',b[16:24])!=(900,460):raise ValueError('Unreviewed Pajama idle composite')
 return {'id':'pajama-parties','label':'파자마 파티즈 · 네 명 함께','source':data_uri(p),'sha256':EXPECTED,'nativeSize':[900,460],'displayWidth':240,'sourceApproved':True,'artApproved':True,'staticDisplay':True,'defaultVisible':False,'scope':'USER_PROVIDED_FOUR_MEMBER_STATIC_COMPOSITE','drag':False,'directResponse':False,'autonomous':False,'studyReaction':False}
