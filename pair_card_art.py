"""One exact reviewed pair-vignette asset; not official model/pixel identity."""
import json,hashlib,struct
EXPECTED='7b2770c6efa74d769ad369fc77a4805026071638be9e5eeaccd5951d5316b4f5'
def load_pair_card_art(root,data_uri):
 a=json.loads((root/'chiikawa-pets/limited-previews/pair-card-static.json').read_text())
 if not (a.get('reviewApproved') is True and a.get('testingAuthorized') is True):return a
 p=root/'chiikawa-pets/limited-previews/pair-card-static.png';b=p.read_bytes()
 if hashlib.sha256(b).hexdigest()!=EXPECTED or a.get('sha256')!=EXPECTED:raise ValueError('Unreviewed pair art bytes')
 if b[:8]!=b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',b[16:24])!=(1536,1024) or a.get('nativeSize')!=[1536,1024] or a.get('displaySize')!=[240,160]:raise ValueError('Pair art geometry differs from approved full canvas')
 if a.get('enabledByDefault') is not False or a.get('autoStart') is not False or a.get('motionActivation') is not False:raise ValueError('Pair static gate widened')
 a['source']=data_uri(p);return a
