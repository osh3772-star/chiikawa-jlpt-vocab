"""Design-only, standard-library virtual scheduler. Never imports runtime or assets."""
import hashlib
import heapq
import bisect
import json
import math
import random
import statistics
from pathlib import Path

HERE = Path(__file__).parent
CONFIG = json.loads((HERE / 'behavior-probability-proposal.json').read_text())
IDS = list(CONFIG['characters'])
SEEDS = range(20)
HORIZON = 86400
WARMUP = 600


def sampler_checks():
    rows = []
    for index, who in enumerate(IDS):
        p = CONFIG['characters'][who]['walk'] / 100
        rng = random.Random(1000 + index)
        n = 100000
        hits = sum(rng.random() < p for _ in range(n))
        tolerance = max(.005, 5 * math.sqrt(p * (1-p) / n))
        assert abs(hits/n - p) <= tolerance
        # Independent fixed-set renewal benchmark: history and global slot disabled.
        rng = random.Random(2000 + index)
        move = total = 0
        for _ in range(n):
            if rng.random() < p:
                duration = rng.uniform(1.6, 3.2)
                move += duration
                total += duration + 2
            else:
                total += rng.uniform(8, 16)
        expected = p*2.4 / ((1-p)*12+p*4.4)
        assert abs(move/total-expected) <= .005
        rows.append({'character':who,'draws':n,'walk_probability':p,'observed':hits/n,
                     'baseline_occupancy_expected':expected,'baseline_occupancy_observed':move/total})
    return rows


def simulate(seed, approved_walk, count=6, disturbances=False, equal_weights=False):
    ids = IDS[:count]
    rngs = [random.Random(seed*100+i) for i in range(count)]
    # Time in foreground seconds; hidden/pause/reduced intervals do not advance
    # eligibility cooldown clocks, but remain in wall-time queue for cancellation tests.
    blocks = [(t,t+60,'hidden') for t in range(600, HORIZON, 600)] if disturbances else []
    blocks += [(t+80,t+110,'pause') for t in range(600,HORIZON-110,600)] if disturbances else []
    blocks += [(t+130,t+160,'reduced') for t in range(600,HORIZON-160,600)] if disturbances else []
    blocks.sort()
    block_starts=[a for a,b,k in blocks]
    prefix=[0]
    for a,b,k in blocks:prefix.append(prefix[-1]+b-a)
    def blocked(t):
        j=bisect.bisect_right(block_starts,t)-1
        return j>=0 and t<blocks[j][1]
    def active_clock(t):
        j=bisect.bisect_right(block_starts,t)-1
        return t if j<0 else t-prefix[j]-min(t-blocks[j][0],blocks[j][1]-blocks[j][0])
    events=[]; serial=0
    def enqueue(t,kind,i=-1):
        nonlocal serial
        serial+=1
        # external cancellations before end/start at same instant
        priority=0 if kind in ('gate','input','drag','failure') else 1 if kind=='end' else 2
        heapq.heappush(events,(t,priority,serial,kind,i))
    for i in range(count): enqueue(rngs[i].uniform(8,16),'due',i)
    if disturbances:
        for a,b,k in blocks:
            enqueue(a,'gate'); enqueue(b,'resume')
        for t in range(300,HORIZON,600):
            for j in range(100): enqueue(t+j*.05,'input')
        for t in range(420,HORIZON,600): enqueue(t,'drag')
        enqueue(HORIZON/2,'failure',0)
    state=[{'last':'idle','last_end':-1e9,'starts':[],'walk':0,'decisions':0,'history_rejections':0,'cooldown_rejections':0} for _ in ids]
    actor=None; started=0; generation=0; protect_until=0; drag_until=0; unavailable=set()
    resume_ready=[0]*count
    checks={'overlapping_autonomous':0,'pair_starts':0,'disabled_starts':0,'repeat_violation':0,'cooldown_violation':0,'protected_starts':0,'cancellations':0,'inputs':0}
    def end(t,cancel=False):
        nonlocal actor,generation
        if actor is None:return
        s=state[actor]
        s['walk']+=max(0,min(t,HORIZON)-max(started,WARMUP))
        s['last_end']=active_clock(t)
        if cancel:checks['cancellations']+=1
        old=actor; actor=None; generation+=1
        enqueue(t+2,'due',old)
    while events:
        t,_,_,kind,i=heapq.heappop(events)
        if t>=HORIZON:break
        if kind in ('gate','input','drag','failure'):
            if kind=='input':protect_until=max(protect_until,t+2);checks['inputs']+=1
            if kind=='drag':drag_until=t+3
            if kind=='failure':unavailable.add(i)
            end(t,True)
            assert actor is None
            continue
        if kind=='resume':
            resume_ready=[t+rng.uniform(8,16) for rng in rngs]
            continue # no replay or immediate catch-up
        if kind=='end':
            if i==generation:end(t)
            continue
        s=state[i]; rng=rngs[i]
        if blocked(t):enqueue(t+rng.uniform(8,16),'due',i);continue
        if t<resume_ready[i]:enqueue(resume_ready[i],'due',i);continue
        if t<protect_until or t<drag_until or actor is not None:
            enqueue(t+rng.uniform(.5,1.5),'due',i);continue
        eligible=approved_walk and i not in unavailable
        if s['last']=='walk':eligible=False;s['history_rejections']+=1
        if active_clock(t)-s['last_end']<20:eligible=False;s['cooldown_rejections']+=1
        p=.25 if equal_weights else CONFIG['characters'][ids[i]]['walk']/100
        walk=eligible and rng.random()<p
        s['decisions']+=1
        if not walk:
            s['last']='idle';enqueue(t+rng.uniform(8,16),'due',i);continue
        assert approved_walk and not blocked(t) and i not in unavailable
        assert actor is None and s['last']!='walk' and active_clock(t)-s['last_end']>=20
        assert t>=protect_until and t>=drag_until
        s['last']='walk';s['starts'].append(t);actor=i;started=t;generation+=1
        enqueue(t+rng.uniform(1.6,3.2),'end',generation)
    end(HORIZON)
    visible_denominator=(HORIZON-WARMUP)-sum(max(0,min(HORIZON,b)-max(WARMUP,a)) for a,b,kind in blocks if kind=='hidden')
    result={}
    for who,s in zip(ids,state):
        starts=[x for x in s['starts'] if x>=WARMUP]
        gaps=[b-a for a,b in zip(starts,starts[1:])]
        # Including start/end censored gaps makes absence explicit.
        boundary_gaps=[b-a for a,b in zip([WARMUP]+starts,[*starts,HORIZON])]
        result[who]={'starts':len(starts),'walk_occupancy':s['walk']/visible_denominator,
                     'idle_occupancy':1-s['walk']/visible_denominator,
                     'max_inter_start_seconds':max(gaps,default=None),'max_gap_including_boundaries':max(boundary_gaps),
                     'decisions':s['decisions'],'history_rejections':s['history_rejections'],'cooldown_rejections':s['cooldown_rejections']}
    if not approved_walk: assert all(s['starts']==0 and s['walk_occupancy']==0 for s in result.values())
    assert sum(s['walk_occupancy'] for s in result.values()) <= 1+1e-12
    return {'seed':seed,'characters':result,'checks':checks}


def aggregate(runs):
    out={}
    for who in runs[0]['characters']:
        vals=[r['characters'][who] for r in runs]
        out[who]={'mean_starts_per_day':statistics.mean(x['starts'] for x in vals),
                  'mean_walk_occupancy':statistics.mean(x['walk_occupancy'] for x in vals),
                  'seed_min_walk_occupancy':min(x['walk_occupancy'] for x in vals),
                  'seed_max_walk_occupancy':max(x['walk_occupancy'] for x in vals),
                  'max_gap_including_boundaries_seconds':max(x['max_gap_including_boundaries'] for x in vals),
                  'total_decisions':sum(x['decisions'] for x in vals)}
    return out


def main():
    scenarios={}
    for name,allowed,count,dist,equal in [
        ('current_zero_approved',False,6,False,False),
        ('current_zero_approved_interruptions',False,6,True,False),
        ('hypothetical_approved_walk_1',True,1,False,False),
        ('hypothetical_approved_walk_3',True,3,False,False),
        ('hypothetical_approved_walk_6',True,6,False,False),
        ('hypothetical_interruptions_6',True,6,True,False),
        ('equal_weight_fairness_fixture',True,6,False,True)]:
        runs=[simulate(seed,allowed,count,dist,equal) for seed in SEEDS]
        scenarios[name]={'summary':aggregate(runs),'runs':runs}
    fair=scenarios['equal_weight_fairness_fixture']['summary']
    total=sum(v['mean_starts_per_day'] for v in fair.values())
    assert all(abs(v['mean_starts_per_day']/total-1/6)<=.02 for v in fair.values())
    # Finite-run observation, not a guarantee: no continuously eligible actor starved a full hour.
    normal=scenarios['hypothetical_approved_walk_6']['summary']
    assert all(v['max_gap_including_boundaries_seconds']<3600 for v in normal.values())
    output={'status':'DESIGN_SIMULATION_ONLY_NOT_RUNTIME_QA','seed_count':20,'wall_seconds_per_run':HORIZON,
            'warmup_seconds':WARMUP,'simulator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sampler_checks':sampler_checks(),'scenarios':scenarios,
            'limitations':['No assets activated or runtime imported','No naturalness or browser performance validation',
                          'Pairs intentionally disabled: structural zero only, future pair reservation not simulated',
                          'No deterministic starvation bound: stochastic waiting is unbounded',
                          'Scheduler uses randomized due-time heap, not production round-robin implementation',
                          'Walk duration is uniform fixture, not approved frame-boundary timing',
                          'Occupancy denominator excludes hidden only; pause/reduced-motion visible still time is idle',
                          'No input device capture or physical drag coordinates modeled']}
    (HERE/'simulation-results.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    for key,data in scenarios.items():print(key, json.dumps(data['summary']))
    print('PASS: sampler, occupancy benchmark, safety assertions, fairness, finite-run starvation observation')

if __name__=='__main__':main()
