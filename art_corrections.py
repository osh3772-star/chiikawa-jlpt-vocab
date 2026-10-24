"""Explicitly reviewed static identity repair. Never authorizes action probability."""
import hashlib,json,struct
from pathlib import Path
from evidence_registry import require,safe_relative
USAGI_SHA='2d699edad7185d7217f1b1feb704b0aec7951176155302dcf6c5a2da1bd7c0d3'
CHIIKAWA_SHA='a0afa4a9be0708789a454efa286adc996b554d55ba5aad96336094fbfcf0f1e6'
def load_usagi_prop_correction(root,data_uri):
    return _load(root,data_uri,'usagi-rod.json',USAGI_SHA,'STATIC_PROP_IDENTITY_REPAIR_VISUAL_PASS')
def load_chiikawa_prop_correction(root,data_uri):
    return _load(root,data_uri,'chiikawa-pink-sasumata.json',CHIIKAWA_SHA,'PASS_STATIC_PROP_COLOR_CORRECTION')
def _load(root,data_uri,name,expected_sha,scope):
    root=Path(root).resolve();manifest=root/'chiikawa-pets/art-corrections'/name
    if not manifest.exists():return None
    c=json.loads(manifest.read_text())
    require(c.get('schemaVersion')==1 and c.get('characterId')==name.split('-')[0],'Wrong static repair character/schema')
    require(c.get('reviewScope')==scope and c.get('runtimeStaticRepairAuthorized') is True and c.get('autonomousActivation') is False and c.get('motionActivation') is False,'Static repair cannot authorize new actions')
    require(c.get('legacyFrameKey')=='sasumata' and c.get('assetSha256')==expected_sha and c.get('assetSize')==[1086,1448],'Unreviewed prop correction')
    p=(root/safe_relative(c['assetPath'])).resolve();require(p.is_relative_to(root),'Correction outside project')
    raw=p.read_bytes();require(raw[:8]==b'\x89PNG\r\n\x1a\n' and hashlib.sha256(raw).hexdigest()==expected_sha and list(struct.unpack('>II',raw[16:24]))==[1086,1448],'Correction pixels differ from reviewed asset')
    return {'source':data_uri(p),'assetPath':c['assetPath'],'assetSha256':expected_sha}
def apply_usagi_prop_correction(correction,sprites,profiles):
    return _apply(correction,sprites,profiles,'usagi','legacy key; corrected yellow straight subjugation staff, not sasumata')
def apply_chiikawa_prop_correction(correction,sprites,profiles):
    return _apply(correction,sprites,profiles,'chiikawa','reviewed pink default-character sasumata; static color repair only')
def _apply(correction,sprites,profiles,who,meaning):
    if not correction:return
    profile=profiles[who]
    require(profile.get('behavior',{}).get('sasumata',0)==0,'Static correction must not restore autonomous selection')
    sprites[who]['sasumata']=correction['source']
    profile.setdefault('frames',{})['sasumata']=correction['assetPath']
    profile.setdefault('poseAliases',{}).pop('sasumata',None)
    profile.setdefault('staticArtCorrections',{})['sasumata']={'assetSha256':correction['assetSha256'],'meaning':meaning,'scope':'STATIC_PROP_IDENTITY_REPAIR_ONLY','autonomousActivation':False}
    # Original defect record remains, now explicitly linked to its static repair.
    profile['quarantinedArt']['sasumata']['fallback']='reviewed-static-correction'
