"""Exact reviewed RGB-only derived sprites. Hash-bound audited alpha, no new decoder/dependency."""
import hashlib, json, struct
from pathlib import Path
EXPECTED = {'idle': ('3ea207a29b523dad2c3433e6ad730c545a7834880980827fb100ec7c0b661940',
          'cdc09c0e396f3797a7c798c85befeb1f3c1449f07b626f2e8f6e9a6bf6ffdb9a',
          '505ab66664f396e5145466fe6a89fd0407db15253605f240ae6d01de772d530d',
          [48, 43, 342, 476]),
 'wave': ('7a9b5d6d068ddd00e7743402507b57e6ac3d608e4473a76688d54b7c1117b578',
          'ec3f3a4d3891b1092a054d1b911e6c50a3f2251d0b7eaf4d315c67b6878e63e2',
          '6ebd421b6dac6452526b236ca7d64851e2bb72a6d1bd58516c7d4fdf01120912',
          [20, 43, 369, 477]),
 'happy': ('c4246fcf2cdc3c14573302cdcbe05c7ecd7a3bf14b5526045f59ad78f6ba48f9',
           '95a1b00c796318c861e7fd7d48ced652f412c08b41c956df2a2d1618bb52bf22',
           '91e5ef6330e1ca5e7c458a71e38a1a633f6e68e3303c422c1a0848710584a973',
           [18, 51, 372, 469]),
 'cheer': ('ff84bbde188e9f2c21b3c7e5092d3377d4500ffd95b7aa001f5651924dce7fda',
           'd1636cfdac9009a60c8e490b06e775c03681cf25b492cdf22ee9bc24fc94c5cd',
           'bb38c0dca527382cd6cf9eeb095de16828f6f64d81278f92c68afac290a0917d',
           [25, 42, 364, 478]),
 'jump': ('e947ef4f9b9811160d036b9d5d2013d2fa13aa1fef8f1b2bbf8144c050e5d8b8',
          '6d01ea62d0b79d335d1a138d59b7a0cba881424107d127a46f657c9a3d1fda68',
          '95334853bbfce9d0d2563c840cebf2bff732a5af214679ac90772a2e6cced300',
          [22, 55, 368, 465]),
 'onigiri': ('41a19e3949afdf2de8897d0f4fb9ad302441f6a777ab788250bcfd7b570c75a5',
             'a3ba5398a94df7f7a8396563b459cf318cc85fe87bdc94990d7a90a3280660db',
             'db54717bf9f3b20ace83607f6c3d2157267e224b38c0fe6ef69903a1065e2d84',
             [52, 56, 337, 464])}
ALIASES = {'blink':'idle','landing':'idle','grabbed':'jump'}
MANIFEST = 'chiikawa-pets/art-corrections/usagi-linecolor/manifest.json'
def load_usagi_linecolor(root,data_uri):
    root=Path(root);p=root/MANIFEST
    if not p.exists(): return None
    m=json.loads(p.read_text())
    if m.get('enabled') is False:return None
    if not (m.get('enabled') is True and m.get('schemaVersion')==1 and m.get('characterId')=='usagi' and m.get('reviewScope')=='SIX_STATIC_POSES_CODE_ONLY_LINECOLOR' and m.get('runtimeStaticRepairAuthorized') is True and m.get('autonomousActivation') is False and m.get('motionActivation') is False and m.get('originalsPreserved') is True):
        raise ValueError('Unapproved Usagi linecolor scope')
    rows=m.get('assets',[])
    if len(rows)!=6 or {x.get('state') for x in rows}!=set(EXPECTED):raise ValueError('Wrong linecolor family')
    result={}
    for x in rows:
        state=x['state'];orig,derived,alpha,bounds=EXPECTED[state]
        op=f'chiikawa_hachiware_usagi_assets/usagi/assets/characters/usagi/{state}.png'
        dp=f'chiikawa-pets/art-corrections/usagi-linecolor/{state}.png'
        if not (x.get('originalPath')==op and x.get('assetPath')==dp and x.get('originalSha256')==orig and x.get('assetSha256')==derived and x.get('canvas')==[390,520] and x.get('originalAlphaSha256')==alpha and x.get('derivedAlphaSha256')==alpha and x.get('alphaChanged')==0 and x.get('originalPaintBounds')==bounds and x.get('derivedPaintBounds')==bounds):
            raise ValueError('Unreviewed linecolor identity/invariant: '+state)
        for file,sha in [(op,orig),(dp,derived)]:
            raw=(root/file).read_bytes()
            if hashlib.sha256(raw).hexdigest()!=sha or raw[:8]!=b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',raw[16:24])!=(390,520):raise ValueError('Linecolor pixels differ: '+state)
        result[state]={**x,'source':data_uri(root/dp),'originalSource':data_uri(root/op)}
    return result

def apply_usagi_linecolor(correction,sprites,profiles):
    if not correction:return
    frames=profiles['usagi']['frames']
    for name,state in {**{s:s for s in EXPECTED},**ALIASES}.items():
        c=correction[state]
        if sprites['usagi'].get(name)!=c['originalSource']:raise ValueError('Unexpected original/alias source: '+name)
        sprites['usagi'][name]=c['source'];frames[name]=c['assetPath']
    profiles['usagi']['lineColorCorrection']={'scope':'SIX_STATIC_POSES_RGB_ONLY','states':list(EXPECTED),'aliases':dict(ALIASES),'excludedStates':['run','walk-a','walk-b','sasumata'],'originalsPreserved':True,'rollbackManifest':MANIFEST,'alphaGeometryUnchanged':True}
