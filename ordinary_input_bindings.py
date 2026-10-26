"""Assemble preserved reaction manifests for ordinary actor input, without editing art.

Original manifest approval/provenance fields remain unchanged. This output is a
local production assembly; operating deployment is a separate owner action.
"""
import copy
import hashlib
import json
import struct
from pathlib import Path


def assemble_input_bindings(root, source_for):
    root=Path(root).resolve()
    folder=root/'chiikawa-pets/limited-previews'
    fragments=json.loads((folder/'observed-fragments.json').read_text())
    hachi=json.loads((folder/'hachi-fullbody.json').read_text())
    selected={'hachiware':hachi,'chiikawa':fragments['chiikawa-carry-step'],
              'usagi':fragments['usagi-lowering'],'rakko':fragments['rakko-expression'],
              'momonga':fragments['momonga-rear-turn']}
    out={}
    def asset(path,expected,size):
        file=(root/path).resolve()
        if not file.is_relative_to(root):raise ValueError('Input asset outside source')
        raw=file.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=expected or raw[:8]!=b'\x89PNG\r\n\x1a\n' or list(struct.unpack('>II',raw[16:24]))!=size:
            raise ValueError('Input asset identity changed: '+path)
        return source_for(file,expected,raw)
    for actor,manifest in selected.items():
        width,height=manifest['windowSize'];frames=[]
        for f in manifest['frames']:
            sw,sh=f['assetSize'];x1,y1,x2,y2=f['sourceRect'];scale=f['scale']
            frames.append({'frameId':f['poseId'],'source':asset(f['assetPath'],f['assetSha256'],f['assetSize']),
                           'assetSize':f['assetSize'],'sha256':f['assetSha256'],
                           'durationMs':f.get('durationMs',manifest.get('holdMs',650)),
                           'drawingOrigin':f.get('drawingOrigin','SOURCE_DERIVED_SPARSE_POSE'),
                           'paint':{'referenceWidth':width,'left':f['left'],'top':width*4/3-height+f['top'],
                                    'width':sw*scale,'height':sh*scale,
                                    'clipInset':[y1*scale,(sw-x2)*scale,(sh-y2)*scale,x1*scale]}})
        out[actor]={'enabled':True,'actions':{'tap':{'actionId':manifest['fragmentId'],'verifiedAssets':True,
            'timingOrigin':manifest['timingOrigin'],'loop':False,'frames':frames,
            'sourceFlags':{k:copy.deepcopy(manifest[k]) for k in ['testingAuthorized','enabledByDefault','productionEnabled','motionActivation','limitations','sourceUrl','loop','interpolation'] if k in manifest}}}}
    # Shisa remains three static scene drawings, not a continuous body-motion claim.
    scene=json.loads((folder/'shisa-three-static.json').read_text());frames=[]
    x,y,width,height=scene['receiver']['viewBox'];sw,sh=scene['assetSize']
    for pose in scene['poseOrder']:
        f=scene['assets'][pose]
        frames.append({'frameId':pose,'source':asset(f['path'],f['sha256'],scene['assetSize']),
            'assetSize':scene['assetSize'],'sha256':f['sha256'],'durationMs':scene['holdMs'],
            'drawingOrigin':'THREE_DERIVED_STATIC_SCENE_POSES',
            'paint':{'referenceWidth':width,'left':-x,'top':width*4/3-height-y,'width':sw,'height':sh,
                     'clipInset':[y,max(0,sw-x-width),max(0,sh-y-height),x]}})
    out['shisa']={'enabled':True,'actions':{'tap':{'actionId':'shisa-three-static','verifiedAssets':True,
        'timingOrigin':scene['timingOrigin'],'loop':False,'frames':frames,'representation':'three-static-scene',
        'sourceFlags':{k:scene[k] for k in ['testingAuthorized','enabledByDefault','productionEnabled','motionActivation','poseAnimation','streamAnimation','liquidLevelAnimation','mandatoryLabel','sourceContext']}}}}
    return out


def inject_input_bindings(integration,bindings):
    marker="  const characterProfiles = JSON.parse(document.getElementById('pet-profiles').textContent);"
    if integration.count(marker)!=1:raise ValueError('Ordinary input profile binding target mismatch')
    payload=json.dumps(bindings,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    return integration.replace(marker,marker+'\n  for(const [id,inputSequences] of Object.entries('+payload+')){if(characterProfiles[id])characterProfiles[id].inputSequences=inputSequences;}',1)
