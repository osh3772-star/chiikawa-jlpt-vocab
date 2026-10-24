"""Design fixture: eligible-idle opportunity fairness, no runtime or asset imports."""
import hashlib
import json
import math
import random
import statistics
from pathlib import Path

ROOT=Path(__file__).parent
CONFIG=json.loads((ROOT/'behavior-probability-proposal.json').read_text())
IDS=list(CONFIG['characters'])
DT=.5
HOURS=6
SEEDS=range(20)


def run(seed,policy,interruptions=False,approved=True):
    states=[]
    for i,who in enumerate(IDS):
        rng=random.Random(seed*100+i)
        states.append(dict(id=who,rng=rng,choice=random.Random(100000+seed*100+i),
                           wait=rng.uniform(8,16),cooldown=0,resume_guard=0,last_end=-1e9,last='idle',remaining=0,
                           opportunity_age=0,action_age=0,eligible=0,starts=0,draws=0,
                           walk_time=0,max_opportunity_age=0,max_action_age=0,
                           contention=0,accelerated_draws=0,repeat_resets=0))
    actor=None; cursor=seed%6; visible=0; previous_external=False
    interrupted=0; invariant_checks=0
    for step in range(int(HOURS*3600/DT)):
        t=step*DT; phase=t%600
        hidden=interruptions and t>=600 and phase<60
        pause=interruptions and t>=600 and 80<=phase<110
        reduced=interruptions and t>=600 and 130<=phase<160
        study=interruptions and 300<=phase<307 # 20 Hz burst 5s plus ~2s protection
        drag=interruptions and 420<=phase<423
        external=hidden or pause or reduced or study or drag
        clock_active=not(hidden or pause or reduced)
        if not hidden:visible+=DT
        for s in states:
            if clock_active:s['cooldown']=max(0,s['cooldown']-DT)
            if not external:
                s['wait']=max(0,s['wait']-DT)
                s['resume_guard']=max(0,s['resume_guard']-DT)
        if external and actor is not None:
            s=states[actor];s['remaining']=0;s['cooldown']=20;s['wait']=2;s['last_end']=t
            actor=None;interrupted+=1
        if previous_external and not external:
            for s in states:
                s['resume_guard']=s['rng'].uniform(8,16)
                s['wait']=max(s['wait'],s['resume_guard'])
        previous_external=external
        if actor is not None:
            s=states[actor]
            assert not external
            s['remaining']-=DT;s['walk_time']+=DT
            if s['remaining']<=0:
                s['cooldown']=20;s['wait']=2;s['last_end']=t;actor=None
        for i,s in enumerate(states):
            if i==actor:continue
            eligible=approved and not external and s['resume_guard']==0 and s['cooldown']==0 and s['last']!='walk'
            if not eligible:continue
            s['eligible']+=DT;s['opportunity_age']+=DT;s['action_age']+=DT
            s['max_opportunity_age']=max(s['max_opportunity_age'],s['opportunity_age'])
            s['max_action_age']=max(s['max_action_age'],s['action_age'])
            if actor is not None:s['contention']+=DT
        if external:continue
        # Rotating cursor; blocked actors accumulate eligible wait, never get fake draws.
        for offset in range(6):
            i=(cursor+offset)%6;s=states[i]
            cap=12 if policy=='cap12' else 4 if policy=='age120_cap4' and s['action_age']>=120 else float('inf')
            due=s['wait']==0 or s['opportunity_age']>=cap
            if not due or actor is not None or s['resume_guard']>0:continue
            if s['last']=='walk' or s['cooldown']>0 or not approved:
                s['last']='idle';s['wait']=s['rng'].uniform(8,16);s['repeat_resets']+=1
                continue
            assert s['cooldown']==0 and s['last']!='walk' and not external
            invariant_checks+=1;s['draws']+=1
            if cap<float('inf') and s['wait']>0:s['accelerated_draws']+=1
            s['opportunity_age']=0
            p=CONFIG['characters'][s['id']]['walk']/100
            if s['choice'].random()<p:
                assert actor is None and t-s['last_end']>=20
                actor=i;s['starts']+=1;s['last']='walk';s['action_age']=0
                s['remaining']=s['rng'].uniform(1.6,3.2)
                # Timestep fixture ends on next lattice point; no real animation implied.
                cursor=(i+1)%6
                break
            s['last']='idle';s['wait']=s['rng'].uniform(8,16)
        else:cursor=(cursor+1)%6
    rows={}
    for s in states:
        rows[s['id']]={k:s[k] for k in ('starts','draws','eligible','max_opportunity_age','max_action_age','contention','accelerated_draws','repeat_resets')}
        rows[s['id']].update(walk_occupancy=s['walk_time']/visible,
                            actual_walk_probability=s['starts']/s['draws'] if s['draws'] else 0)
    assert sum(s['walk_time'] for s in states)<=visible+DT
    if not approved:assert all(s['starts']==0 and s['draws']==0 for s in states)
    return {'seed':seed,'characters':rows,'interrupted_actions':interrupted,'start_eligibility_checks':invariant_checks,
            'pair_starts':0,'input_or_gate_violation':0,'repeat_or_cooldown_violation':0,'slot_overlap':0}


def main():
    scenarios={}
    for policy in ('baseline','cap12','age120_cap4'):
        for disturbances in (False,True):
            name=policy+('_interruptions' if disturbances else '')
            runs=[run(seed,policy,disturbances) for seed in SEEDS]
            summary={}
            for who in IDS:
                rows=[r['characters'][who] for r in runs]
                summary[who]={
                    'mean_starts_per_6h':statistics.mean(r['starts'] for r in rows),
                    'mean_walk_occupancy':statistics.mean(r['walk_occupancy'] for r in rows),
                    'total_draws':sum(r['draws'] for r in rows),
                    'pooled_walk_probability':sum(r['starts'] for r in rows)/sum(r['draws'] for r in rows),
                    'max_eligible_opportunity_gap_seconds':max(r['max_opportunity_age'] for r in rows),
                    'max_eligible_action_absence_seconds':max(r['max_action_age'] for r in rows),
                    'mean_contention_seconds':statistics.mean(r['contention'] for r in rows),
                    'mean_eligible_seconds':statistics.mean(r['eligible'] for r in rows),
                    'accelerated_draws':sum(r['accelerated_draws'] for r in rows)}
            for who,r in summary.items():
                p=CONFIG['characters'][who]['walk']/100
                assert abs(r['pooled_walk_probability']-p)<=max(.005,5*math.sqrt(p*(1-p)/r['total_draws']))
            scenarios[name]={'summary':summary,'runs':runs}
    current=[run(seed,'age120_cap4',True,False) for seed in SEEDS]
    out={'status':'DESIGN_ONLY_AUTHORED_UX_HYPOTHESES','step_seconds':DT,'hours_per_run':HOURS,'seeds':len(SEEDS),
         'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
         'eligible_clock':'Approved action available; visible, unpaused, not reduced, no study protection or drag or resume guard, own cooldown finished and repeat-history reset. Shared-slot contention counts as eligible waiting.',
         'scenarios':scenarios,'current_zero_approved_runs':current,
         'limitations':['0.5s time lattice; not production timing','Future pair code not modeled; off only',
                        'Opportunity caps do not force action or guarantee action wait bound',
                        'No asset, browser, visual naturalness, or exact original-engine equivalence validation']}
    (ROOT/'opportunity-fairness-results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    for name,s in scenarios.items():
        print(name)
        for who,r in s['summary'].items():print(who,json.dumps(r))
    print('PASS: current-zero approval remains idle only; start gates/repeat/cooldown/slot asserts')

if __name__=='__main__':main()
