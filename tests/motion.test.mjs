import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePetSequence, samplePetSequence, availablePetWeights, petReleaseVelocity, mountChiikawaPets } from '../chiikawa-pets/pet-engine.js';

const sequence = { loop: true, rootDistance: .4, frames: [
  { frameId: 'contact', source: 'fixture-a', durationMs: 100 },
  { frameId: 'passing', source: 'fixture-b', durationMs: 200 },
] };
const profile = { frames: { idle: 'idle', happy: 'happy' }, animationManifest: {
  approvalStatus: 'approved', actions: { walk: { views: { right: sequence } } },
} };
test('direction views are explicit and draft manifests never animate', () => {
  assert.equal(resolvePetSequence(profile, 'walk', 'right'), sequence);
  assert.equal(resolvePetSequence(profile, 'walk', 'left'), null);
  assert.equal(resolvePetSequence({ ...profile, animationManifest: { ...profile.animationManifest, approvalStatus: 'reviewed' } }, 'walk', 'right'), null);
});
test('variable frame timing, wrapping and one-shot completion', () => {
  assert.equal(samplePetSequence(sequence, 99).index, 0);
  assert.equal(samplePetSequence(sequence, 100).index, 1);
  assert.equal(samplePetSequence(sequence, 300).index, 0);
  assert.equal(samplePetSequence(sequence, 600).phase, 0);
  const final = samplePetSequence({ ...sequence, loop: false }, 1000);
  assert.equal(final.index, 1); assert.equal(final.done, true);
});
test('unavailable walk weight returns to idle, not fake frame animation', () => {
  assert.deepEqual(availablePetWeights({ idle: 20, walk: 60, happy: 20 }, { frames: { happy: 'happy' } }), { idle: 80, happy: 20 });
  assert.deepEqual(availablePetWeights({ idle: 20, walk: 60, happy: 20 }, profile), { idle: 20, walk: 60, happy: 20 });
});
test('cancel/reduced release never throws; normal release is bounded', () => {
  assert.deepEqual(petReleaseVelocity(99999, -99999), { vx: 165, vy: -350 });
  assert.deepEqual(petReleaseVelocity(999, 999, true), { vx: 0, vy: 0 });
  assert.deepEqual(petReleaseVelocity(999, 999, false, true), { vx: 0, vy: 0 });
});

class Element extends EventTarget {
  constructor() { super(); this.dataset = {}; this.style = { setProperty(k,v) { this[k] = v; } }; this.hidden = false; this.children = []; this.capture = null;
    this.classList = { toggle() {}, remove() {} }; }
  setAttribute() {} appendChild(el) { this.children.push(el); } remove() {}
  querySelector(sel) { return sel === '.cv-pet__image' ? this.image ??= new Element() : new Element(); }
  setPointerCapture(id) { this.capture = id; } hasPointerCapture(id) { return this.capture === id; } releasePointerCapture() { this.capture = null; }
}
function environment(reduced = false) {
  let callback, now = 0, pendingFrame = false;
  const doc = new Element(); doc.body = new Element(); doc.hidden = false; doc.createElement = () => new Element(); doc.querySelectorAll = () => []; doc.querySelector = () => null;
  const media = new Element(); media.matches = reduced;
  const win = new Element(); win.innerWidth = 1200; win.innerHeight = 800; win.matchMedia = () => media;
  const saved = Object.fromEntries(['document', 'window', 'Image', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis,k)]));
  Object.assign(globalThis, { document: doc, window: win, Image: class {}, requestAnimationFrame: fn => (callback = fn, pendingFrame = true, 1), cancelAnimationFrame() { pendingFrame = false; } });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  return { doc, win, media, hasScheduledFrame: () => pendingFrame, step(ms) { for (let t = 0; t < ms; t += 20) { now += 20; if (pendingFrame) { pendingFrame = false; callback(now); } } },
    close() { for (const [key, descriptor] of Object.entries(saved)) if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key]; } };
}
function emit(el, type, props = {}) { const e = new Event(type, { cancelable: true }); Object.assign(e, props); el.dispatchEvent(e); }
function setup(reduced = false) {
  const env = environment(reduced);
  const profiles = Object.fromEntries(['chiikawa','hachiware','usagi'].map(id => [id, { frames: { idle:'idle', grabbed:'grab', happy:'happy', wave:'wave' }, behavior: { idle: 100 } }]));
  const api = mountChiikawaPets({ enabledCharacters: Object.keys(profiles), characterProfiles: profiles });
  return { ...env, api, el: env.doc.body.children[0].children[0], finish() { api.destroy(); env.close(); } };
}
test('grab/hold/release/landing chain and pointer cancellation', () => {
  const e = setup(); try {
    emit(e.el, 'pointerdown', { button: 0, pointerId: 1, clientX: 150, clientY: 650 }); e.step(200);
    assert.equal(e.api.getState()[0].mode, 'hold');
    emit(e.el, 'pointermove', { pointerId: 1, clientX: 240, clientY: 200 });
    emit(e.el, 'pointercancel', { pointerId: 1 });
    assert.equal(e.api.getState()[0].mode, 'idle'); assert.equal(e.api.getState()[0].airborne, false); assert.equal(e.api.getState()[0].captured, false);
    emit(e.el, 'pointerdown', { button: 0, pointerId: 2, clientX: 240, clientY: 650 });
    emit(e.el, 'pointermove', { pointerId: 2, clientX: 250, clientY: 300 });
    emit(e.el, 'pointerup', { pointerId: 2 });
    assert.equal(e.api.getState()[0].mode, 'release'); e.step(140); assert.equal(e.api.getState()[0].mode, 'fall');
    e.step(2000); assert.equal(e.api.getState()[0].mode, 'idle');
  } finally { e.finish(); }
});
test('events coalesce to one complete pair; grab cancels partner reservation', () => {
  const e = setup(); try {
    e.api.react('correct'); e.api.react('complete'); e.step(80);
    assert.equal(e.api.getState().filter(p => p.mode === 'complete').length, 1);
    assert.equal(e.api.getState().filter(p => p.pairRole).length, 2);
    emit(e.el, 'pointerdown', { button: 0, pointerId: 3, clientX: 150, clientY: 650 });
    assert.equal(e.api.getState().filter(p => p.pairRole).length, 0);
    assert.equal(e.api.getState().filter(p => p.mode === 'complete').length, 0);
  } finally { e.finish(); }
});
test('visibility, resize, pause and destroy release capture safely', () => {
  const e = setup(); try {
    for (const event of ['visibilitychange', 'resize', 'pause']) {
      emit(e.el, 'pointerdown', { button: 0, pointerId: 1, clientX: 150, clientY: 650 });
      if (event === 'pause') e.api.pause(); else emit(event === 'resize' ? e.win : e.doc, event);
      assert.equal(e.api.getState()[0].captured, false); assert.equal(e.api.getState()[0].mode, 'idle');
    }
    e.api.resume(); emit(e.el, 'pointerdown', { button: 0, pointerId: 1, clientX: 150, clientY: 650 });
    e.api.destroy(); assert.equal(e.el.capture, null); e.api.destroy();
  } finally { e.finish(); }
});
test('reduced motion cannot be overridden by resume and preserves manual pause', () => {
  const e = setup(true); try {
    e.api.resume(); assert.equal(e.api.isPaused(), true);
    e.api.pause(); emit(e.media, 'change', { matches: false }); assert.equal(e.api.isPaused(), true);
    e.api.resume(); assert.equal(e.api.isPaused(), false);
  } finally { e.finish(); }
});
test('touch scroll intent cancels before capture; long press can capture', () => {
  const e = setup(); try {
    emit(e.el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 1, clientX: 150, clientY: 650 });
    emit(e.el, 'pointermove', { pointerId: 1, clientX: 150, clientY: 670 }); e.step(300);
    assert.equal(e.api.getState()[0].captured, false);
    emit(e.el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 2, clientX: 150, clientY: 650 }); e.step(300);
    assert.equal(e.api.getState()[0].captured, true);
  } finally { e.finish(); }
});
test('event expires during physical interaction and duplicate event id is ignored', () => {
  const e = setup(); try {
    emit(e.el, 'pointerdown', { button: 0, pointerId: 1, clientX: 150, clientY: 650 });
    e.api.react('correct', 'chiikawa', { eventId: 'once' }); e.step(1200);
    emit(e.el, 'pointercancel', { pointerId: 1 }); e.api.react('correct', 'chiikawa', { eventId: 'once' }); e.step(100);
    assert.equal(e.api.getState()[0].mode, 'idle');
  } finally { e.finish(); }
});
test('walk displacement and frame phase share a clamped timeline without mirrored art', () => {
  const e = environment(); const random = Math.random; Math.random = () => 0;
  let api;
  try {
    api = mountChiikawaPets({ enabledCharacters: ['chiikawa'], characterProfiles: { chiikawa: { ...profile, behavior: { walk: 100 } } } });
    e.step(1800); const before = api.getState()[0];
    assert.equal(before.mode, 'walk'); assert.equal(before.dir, 1); // unavailable left is not mirrored
    e.step(100); const after = api.getState()[0];
    assert.ok(Math.abs(after.x - before.x - (.4 * before.width / .3) * .1) < .00001);
    assert.equal(after.assetMode, 'sequence');
  } finally { api?.destroy(); Math.random = random; e.close(); }
});
test('draft experimental art requires explicit opt-in, never implicit approval', () => {
  const beta = { ...profile, animationManifest: { ...profile.animationManifest, approvalStatus: 'draft', experimental: true } };
  assert.equal(resolvePetSequence(beta, 'walk', 'right'), null);
  assert.equal(resolvePetSequence(beta, 'walk', 'right', { allowDraft: true }), sequence);
  beta.animationManifest.experimental = false;
  assert.equal(resolvePetSequence(beta, 'walk', 'right', { allowDraft: true }), null);
});
test('main app beta is off by default and scoped only to Chiikawa', () => {
  for (const enabled of [false, true]) {
    const e = environment(); let api;
    const manifest = { approvalStatus: 'draft', experimental: true, actions: {
      idle: { views: { front: { ...sequence, loop: false, frames: [sequence.frames[0]] } } },
      'step-in-place': { views: { front: sequence } },
    } };
    try {
      const original = { frames: { idle: 'idle', happy: 'happy' }, behavior: { idle: 100 }, betaManifest: manifest };
      api = mountChiikawaPets({ enabledCharacters: ['chiikawa', 'hachiware'], characterProfiles: { chiikawa: original, hachiware: original }, experimentalCharacters: enabled ? ['chiikawa', 'hachiware'] : [] });
      assert.equal(api.getState()[0].assetMode, enabled ? 'beta-static' : 'static-fallback');
      assert.equal(api.getState()[1].assetMode, 'static-fallback');
      assert.equal(api.playAction('walk','chiikawa'),enabled);
      if(enabled) { e.step(200); assert.equal(api.getState()[0].mode,'step-in-place'); assert.equal(api.getState()[0].assetMode,'beta-sequence'); }
      api.pause(); assert.equal(api.playAction('walk','chiikawa'),false);
    } finally { api?.destroy(); e.close(); }
  }
});
test('reserved beta stage preserves release height and safely catches landing', () => {
  const e = environment(); let api;
  const one = { ...sequence, loop: false, frames: [{ ...sequence.frames[0], durationMs: 120 }] };
  const manifest = { approvalStatus: 'draft', experimental: true, actions: {
    idle: { views: { front: one } }, 'grab-onset': { views: { front: one } },
    hold: { views: { front: sequence } }, release: { views: { front: one } },
    landing: { views: { front: { ...sequence, loop: false } } },
  } };
  try {
    const stage = { hidden: false, getBoundingClientRect: () => ({ left: 100, right: 900, top: 220, bottom: 400 }) };
    api = mountChiikawaPets({ enabledCharacters: ['chiikawa'], experimentalCharacters: ['chiikawa'], experimentalStage: stage,
      characterProfiles: { chiikawa: { frames: { idle:'idle', grabbed:'grabbed' }, betaManifest: manifest } } });
    const actor=e.doc.body.children[0].children[0];const baseline=api.getState()[0].y;
    emit(actor,'pointerdown',{button:0,pointerId:3,clientX:500,clientY:300});
    emit(actor,'pointermove',{pointerId:3,clientX:520,clientY:100});
    emit(actor,'pointerup',{pointerId:3}); e.step(80);
    assert.equal(api.getState()[0].mode,'release'); assert.ok(api.getState()[0].y<baseline-100);
    e.step(100);assert.equal(api.getState()[0].mode,'fall');
    e.step(1600);assert.equal(api.getState()[0].y,baseline);assert.equal(api.getState()[0].mode,'idle');
    emit(actor,'pointerdown',{button:0,pointerId:4,clientX:500,clientY:300});
    emit(e.doc,'keydown',{key:'Escape'});assert.equal(api.getState()[0].captured,false);assert.equal(api.getState()[0].mode,'idle');
  } finally {api?.destroy();e.close();}
});
test('hide during capture cancels immediately without throw, landing or delayed replay', () => {
  const e=setup();try{
    emit(e.el,'pointerdown',{button:0,pointerId:8,clientX:150,clientY:650});
    emit(e.el,'pointermove',{pointerId:8,clientX:220,clientY:200});
    e.api.setVisibleCharacters(['hachiware','usagi']);
    const p=e.api.getState()[0];assert.equal(p.visible,false);assert.equal(p.captured,false);assert.equal(p.airborne,false);assert.equal(p.mode,'idle');
    assert.equal(e.el.capture,null);e.step(1000);assert.equal(e.api.getState()[0].mode,'idle');
    e.api.setVisibleCharacters(['chiikawa','chiikawa','hachiware']);assert.equal(e.api.getVisibleCharacters().length,2);
    assert.equal(e.doc.body.children[0].children.length,3);
  }finally{e.finish();}
});
test('hiding a partner clears both reservations; all-hide does not change pause', () => {
  const e=setup();try{
    e.api.react('complete');e.step(80);assert.equal(e.api.getState().filter(p=>p.pairRole).length,2);
    e.api.setVisibleCharacters(['usagi']);assert.equal(e.api.getState().filter(p=>p.pairRole).length,0);
    e.api.pause();e.api.setVisibleCharacters([]);assert.equal(e.hasScheduledFrame(),false);assert.equal(e.api.isPaused(),true);assert.equal(e.api.getState().filter(p=>p.visible).length,0);
    e.api.react('correct');e.api.setVisibleCharacters(['chiikawa']);assert.equal(e.hasScheduledFrame(),true);e.step(200);assert.equal(e.api.isPaused(),true);assert.equal(e.api.getState()[0].mode,'idle');
  }finally{e.finish();}
});
test('hidden focused actor reports focus recovery to its UI control', () => {
  const e=environment();let api;const notifications=[];
  try{
    api=mountChiikawaPets({enabledCharacters:['chiikawa'],onCharacterHidden:(id,state)=>notifications.push({id,...state})});
    e.doc.activeElement=e.doc.body.children[0].children[0];api.setVisibleCharacters([]);
    assert.deepEqual(notifications,[{id:'chiikawa',hadFocus:true}]);
    api.setVisibleCharacters([]);assert.equal(notifications.length,1);
  }finally{api?.destroy();e.close();}
});
test('mobile scroll dock keeps six selected actors unique without x=0 piling', () => {
  const e=environment();e.win.innerWidth=500;let api,offset=0;const ids=['chiikawa','hachiware','usagi','shisa','momonga','rakko'];
  const stages=Object.fromEntries(ids.map((id,i)=>[id,{hidden:false,getBoundingClientRect:()=>({left:18+i*152-offset,right:158+i*152-offset,top:200,bottom:364}),scrollIntoView(){offset=i*152;}}]));
  const dock={getBoundingClientRect:()=>({left:12,right:488,top:192,bottom:372})};
  try{
    api=mountChiikawaPets({enabledCharacters:ids,mobilePetStages:stages,mobileStageViewport:dock,maxVisibleMobile:3,
      characterProfiles:Object.fromEntries(ids.map(id=>[id,{frames:{idle:'idle'},behavior:{idle:100}}]))});
    assert.equal(api.getVisibleCharacters().length,6);assert.equal(api.getState().filter(p=>p.visible).length,6);
    const before=api.getState()[0].x;offset=300;emit(e.win,'scroll');e.step(40);
    const state=api.getState();assert.equal(state[0].x,before-300);assert.equal(state[0].onScreen,false);
    assert.equal(new Set(state.map(p=>p.x)).size,6);assert.equal(e.doc.body.children[0].children.length,6);
    assert.equal(api.focusCharacter('rakko'),true);assert.equal(offset,5*152);
    api.setVisibleCharacters(['rakko']);assert.equal(api.getVisibleCharacters().length,1);assert.equal(api.focusCharacter('chiikawa'),false);
  }finally{api?.destroy();e.close();}
});
test('external presentation suppresses base once and restores current visibility only',()=>{
 const e=environment();let api;const reasons=[];
 try{api=mountChiikawaPets({enabledCharacters:['momonga','chiikawa'],onPresentationCancelled:r=>reasons.push(r)});
 assert.equal(api.beginExternalPresentation('momonga'),true);assert.equal(api.getState().find(p=>p.id==='momonga').visible,false);
 assert.equal(e.doc.body.children[0].children.length,2);api.endExternalPresentation('momonga');assert.equal(api.getState().find(p=>p.id==='momonga').visible,true);
 api.beginExternalPresentation('momonga');api.setVisibleCharacters(['chiikawa']);assert.equal(api.getExternalPresentation(),null);api.endExternalPresentation('momonga');assert.equal(api.getState().find(p=>p.id==='momonga').visible,false);
 api.setVisibleCharacters(['momonga']);api.beginExternalPresentation('momonga');api.pause();assert.equal(api.getExternalPresentation(),null);assert.ok(reasons.length>=2);
 }finally{api?.destroy();e.close();}
});
