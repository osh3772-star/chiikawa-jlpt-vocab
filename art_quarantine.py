"""Preserve audited originals; replace damaged or misidentified runtime art safely."""
QUARANTINED_MOMONGA = {
    'hang': 'M01: body missing', 'sleep': 'M01: body missing',
    'pout': 'M02: straight face clipping', 'fake-cry': 'M02: straight face clipping',
    'grabbed': 'M03: diagonal body clipping', 'jump': 'M03: diagonal body clipping',
}
QUARANTINED_USAGI = {'sasumata': 'U-PROP-01: wrong prop identity; Usagi uses a subjugation staff, not the blue Y-shaped sasumata depicted here'}

QUARANTINED_CHIIKAWA = {'sasumata': 'C-PROP-01: blue fork conflicts with the reviewed pink default-character prop model'}

def apply_art_quarantine(sprites, profiles):
    """Idle aliases plus removed autonomous selections, never replacement motion."""
    for who,quarantine in [('momonga',QUARANTINED_MOMONGA),('usagi',QUARANTINED_USAGI),('chiikawa',QUARANTINED_CHIIKAWA)]:
        frames=sprites.get(who,{})
        if not frames:continue
        if not frames.get('idle'):raise ValueError(f'Audited safe {who} idle fallback is required')
        profile=profiles[who];profile.setdefault('quarantinedArt',{})
        for frame,reason in quarantine.items():
            if frame not in frames:continue
            frames[frame]=frames['idle']
            if profile.get('frames',{}).get('idle'):profile['frames'][frame]=profile['frames']['idle']
            profile['quarantinedArt'][frame]={'fallback':'idle','reason':reason,'audit':'docs/design/usagi-prop-quarantine.ko.md' if who in ('usagi','chiikawa') else 'docs/design/art_audit.ko.json'}
            weights=profile.get('behavior')
            if weights and frame in weights:weights['idle']=weights.get('idle',0)+weights.pop(frame)
        profile.setdefault('poseAliases',{}).update({frame:'idle' for frame in profile['quarantinedArt']})
