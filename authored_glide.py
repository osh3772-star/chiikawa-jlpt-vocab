"""Separate local authored-translation policy; never unlocks original motion."""
import json
from pathlib import Path
from evidence_registry import require

def load_authored_glide(root, reviewed_body):
    p=Path(root)/'chiikawa-pets/limited-previews/authored-glide.json'
    if not p.exists():
        return None
    c=json.loads(p.read_text())
    expected={'schemaVersion':1,'type':'AUTHORED_UI_GLIDE','characterId':'momonga','localTestingAuthorized':True,'enabledByDefault':False,'autonomous':False,'originalFullMotionActivation':False,'width':96,'assetSha256':'2b6068c38fdab9f0bc6ca54366729df0a2b25ab93524a68a12616b32cefbf580','assetSize':[1627,967],'durationMs':1800,'timingOrigin':'AUTHORED_WEB_UX','minimumDelta':{'left':24,'up':48,'distance':64},'margin':6,'minimumViewportWidth':640,'loop':False,'rotation':False,'mirror':False,'scaleDuringTravel':False,'sourceScope':'LIMITED_PREVIEW_BODY_ONLY','restore':'EXPLICIT_UI_CUT_NOT_LANDING'}
    require(json.dumps(c,sort_keys=True)==json.dumps(expected,sort_keys=True),'Authored glide policy differs from bounded local review')
    require(reviewed_body and reviewed_body.get('assetSha256')==c['assetSha256'] and reviewed_body.get('source'),'Reviewed R3 build gate required')
    return {**c,'source':reviewed_body['source']}
