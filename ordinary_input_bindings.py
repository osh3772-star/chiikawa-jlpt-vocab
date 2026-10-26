"""Assemble preserved reaction manifests for ordinary actor input, without editing art.

Original manifest approval/provenance fields remain unchanged. This output is a
local production assembly; operating deployment is a separate owner action.
"""
import copy
import hashlib
import json
import struct
import math
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
    # Preserve the existing 12 authored Chi foot exposures and registration.
    foot=json.loads((root/'chiikawa-pets/reviewed-foot-assets/manifest.json').read_text());frames=[]
    scale=328/785
    for f in foot['frames']:
        relative='chiikawa-pets/reviewed-foot-assets/'+f['file']
        size=[f['width'],f['height']]
        frames.append({'frameId':f['poseId'],'source':asset(relative,f['sha256'],size),'assetSize':size,
            'sha256':f['sha256'],'durationMs':120,'drawingOrigin':'AUTHORED_REVIEW_NOT_VIDEO',
            'paint':{'referenceWidth':390,'left':195-607*scale,'top':442-1065*scale,'width':1254*scale,'height':1254*scale}})
    out['chiikawa']['actions']['walk']={'actionId':'chi-foot-v4-expanded-review','verifiedAssets':True,
        'timingOrigin':'AUTHORED_REVIEW_NOT_VIDEO','loop':False,'frames':frames,
        'sourceFlags':{k:foot[k] for k in ['reviewCandidate','productionApproved','enabledByDefault','autonomous','rootTravel','loop']}}
    # Replacement physical art is data, not another engine or a generated pose.
    # Each supplied frame needs an existing exact asset and explicit registration.
    physical_file=root/'chiikawa-pets/candidate-sequences/physical-bindings.json'
    physical=json.loads(physical_file.read_text())
    if physical.get('schemaVersion')!=1:raise ValueError('Unsupported physical binding schema')
    states={'press','grab','held','release','fall','landing','recover'}
    for actor,actions in physical.get('characters',{}).items():
        if actor not in out:raise ValueError('Unknown physical actor')
        for state,entry in actions.items():
            if state not in states or not entry.get('frames') or not isinstance(entry.get('timingOrigin'),str):raise ValueError('Invalid physical sequence')
            if entry.get('loop',False) and state not in {'held','fall'}:raise ValueError('Finite physical state cannot loop')
            frames=[]
            for f in entry['frames']:
                paint=copy.deepcopy(f['paint']);size=f['assetSize']
                if any(not isinstance(paint.get(k),(int,float)) or not math.isfinite(paint[k]) for k in ['referenceWidth','left','top','width','height']) or min(paint['width'],paint['height'],paint['referenceWidth'])<=0:raise ValueError('Invalid physical registration')
                if not math.isclose(paint['width']/size[0],paint['height']/size[1],rel_tol=1e-9):raise ValueError('Physical art must keep its original aspect')
                if not isinstance(f.get('durationMs'),(int,float)) or not math.isfinite(f['durationMs']) or f['durationMs']<=0:raise ValueError('Invalid physical exposure')
                frames.append({'frameId':f['frameId'],'source':asset(f['assetPath'],f['assetSha256'],size),
                    'assetSize':size,'sha256':f['assetSha256'],'durationMs':f['durationMs'],
                    'drawingOrigin':f.get('drawingOrigin','AUTHORED_INTERACTION_CANDIDATE'),'paint':paint})
            out[actor]['actions'][state]={'actionId':entry['actionId'],'timingOrigin':entry['timingOrigin'],
                'verifiedAssets':True,'loop':entry.get('loop',False),'frames':frames,'sourceFlags':copy.deepcopy(entry.get('sourceFlags',{}))}
    # The other four walk drawings use the exact native presenter source, not this compiler.
    for actor,registry in out.items():
        available=set(registry['actions'])
        if actor=='chiikawa':available.update(['grab','held']) # Existing three-key capture channel.
        if actor in ['hachiware','usagi','shisa','rakko']:available.add('walk')
        registry['missingStates']=[state for state in ['press','tap','grab','held','release','fall','landing','recover','walk'] if state not in available]
    return out


def inject_input_bindings(integration,bindings):
    marker="  const characterProfiles = JSON.parse(document.getElementById('pet-profiles').textContent);"
    if integration.count(marker)!=1:raise ValueError('Ordinary input profile binding target mismatch')
    payload=json.dumps(bindings,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    return integration.replace(marker,marker+"\n  document.body.dataset.interactionAssembly='true';"+'\n  for(const [id,inputSequences] of Object.entries('+payload+')){if(characterProfiles[id])characterProfiles[id].inputSequences=inputSequences;}',1)


def copy_existing_walk_candidates(root,output):
    """Keep already-published candidate PNG bytes; absent artwork does not block assembly."""
    root=Path(root);output=Path(output)
    text=(root/'chiikawa-pets/candidate-sequences/candidate-registry.mjs').read_text()
    registry=json.loads(text.split('export const CANDIDATE_REGISTRY = freeze(',1)[1].rsplit(');',1)[0])
    copied=0;missing=[]
    for entry in registry.values():
        for frame in entry['frames']:
            source=root/frame['repositoryPath']
            if not source.is_file():missing.append(frame['repositoryPath']);continue
            raw=source.read_bytes()
            if len(raw)!=frame['bytes'] or hashlib.sha256(raw).hexdigest()!=frame['sha256'] or list(struct.unpack('>II',raw[16:24]))!=[1254,1254]:raise ValueError('Existing walk asset identity changed')
            dest=output/'animation-candidates-20261027'/frame['assetPath'];dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw);copied+=1
    return {'copiedPNGCount':copied,'missingAssetPaths':missing}
