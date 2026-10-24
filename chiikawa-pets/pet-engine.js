const DATA = [
  { id: 'chiikawa', label: '치이카와', size: 126, speed: 42 },
  { id: 'hachiware', label: '하치와레', size: 130, speed: 48 },
  { id: 'usagi', label: '우사기', size: 126, speed: 64 },
  { id: 'shisa', label: '시사', size: 122, speed: 39 },
  { id: 'momonga', label: '모몽가', size: 127, speed: 61 },
  { id: 'rakko', label: '랏코', size: 120, speed: 34 },
];
export function pickPetBehavior(weights, random = Math.random) {
  const entries = Object.entries(weights);
  if (!entries.length || entries.some(([, weight]) => !Number.isFinite(weight) || weight < 0)) {
    throw new TypeError('Pet probabilities must be finite, non-negative percentages.');
  }
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (Math.abs(total - 100) > 1e-6) throw new RangeError('Pet probabilities must sum to 100.');
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError('Random sample must be in [0, 1).');
  const target = sample * total;
  let cumulative = 0;
  for (const [action, weight] of entries) {
    cumulative += weight;
    if (target < cumulative) return action;
  }
  return entries.findLast(([, weight]) => weight > 0)[0];
}

// A view is never mirrored. Missing/unapproved views are static fallbacks.
export function resolvePetSequence(profile, action, direction = 'front', { allowDraft = false } = {}) {
  const manifest = profile?.animationManifest;
  if (manifest?.approvalStatus !== 'approved' && !(allowDraft && manifest?.approvalStatus === 'draft' && manifest?.experimental === true)) return null;
  const entry = manifest.actions?.[action];
  const original = entry?.views?.[direction] ?? (action === 'walk' ? null : entry?.views?.front);
  if (!original || !Array.isArray(original.frames) || original.frames.length < (action === 'walk' ? 2 : 1)) return null;
  const view = original.frames.some(f => f.assetKey) ? { ...original, frames: original.frames.map(f => ({ ...f, source: manifest.assets?.[f.assetKey] ?? f.source })) } : original;
  if (view.frames.some(f => !f.frameId || !f.source || !Number.isFinite(f.durationMs) || f.durationMs <= 0)) return null;
  if (action === 'walk' && (!view.loop || !(view.rootDistance > 0))) return null;
  return view;
}
export function samplePetSequence(sequence, elapsedMs) {
  const duration = sequence.frames.reduce((sum, f) => sum + f.durationMs, 0);
  const elapsed = Math.max(0, elapsedMs);
  const time = sequence.loop ? elapsed % duration : Math.min(elapsed, duration - .000001);
  let cursor = 0;
  const index = sequence.frames.findIndex(f => (cursor += f.durationMs) > time);
  return { frame: sequence.frames[Math.max(0, index)], index: Math.max(0, index),
    phase: time / duration, done: !sequence.loop && elapsed >= duration, duration };
}
export function petReleaseVelocity(vx, vy, cancelled = false, reduced = false) {
  return cancelled || reduced ? { vx: 0, vy: 0 } :
    { vx: Math.max(-165, Math.min(165, (Number.isFinite(vx) ? vx : 0) * .22)),
      vy: Math.max(-350, Math.min(450, (Number.isFinite(vy) ? vy : 0) * .25)) };
}
export function availablePetWeights(weights, profile, options = {}) {
  const result = { idle: 0 };
  for (const [action, weight] of Object.entries(weights)) {
    const available = action === 'idle' || (action === 'walk'
      ? ['left', 'right'].some(d => resolvePetSequence(profile, action, d, options))
      : !!profile?.frames?.[action] || !!resolvePetSequence(profile, action, 'front', options));
    const key = available ? action : 'idle';
    result[key] = (result[key] ?? 0) + weight;
  }
  return result;
}
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
const rand = (a, b) => a + Math.random() * (b - a);
const INSTANCE = Symbol.for('jlpt.chiikawa-pets');
const DEFAULT_POSES = ['idle', 'blink', 'happy', 'reaction', 'grabbed', 'landing'];
const PHYSICAL = new Set(['grab-onset', 'hold', 'release', 'fall', 'landing', 'recover']);

export function mountChiikawaPets(options = {}) {
  const { assetBase = '/chiikawa', enabledCharacters = DATA.map(p => p.id), floorOffset = 8,
    startPaused = false, onStatusChange = null, spriteSources = null, characterProfiles = {}, experimentalCharacters = [], experimentalStage = null, visibleCharacters = enabledCharacters, mobilePetStages = null, mobileStageViewport = null, onCharacterHidden = null, onPresentationCancelled = null,
    maxVisibleMobile = 3, mobilePriority = ['shisa', 'momonga', 'rakko'],
    avoidSelector = '#card, button, select, input, textarea, a, .table-scroll' } = options;
  if (typeof document === 'undefined') return { react() {}, pause() {}, resume() {}, destroy() {}, getState() { return []; }, isPaused() { return true; }, setMobileCharacters() {}, setVisibleCharacters() {}, getVisibleCharacters() { return []; } };
  if (window[INSTANCE]) return window[INSTANCE];
  const root = document.createElement('div');
  root.className = 'cv-pet-layer'; root.setAttribute('aria-label', '치이카와 마스코트');
  document.body.appendChild(root);
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = query?.matches ?? false, manualPaused = Boolean(startPaused), destroyed = false;
  let ticking = false;
  let raf = 0, lastTime = 0, started = false, mobileLimit = maxVisibleMobile, mobileOrder = [...mobilePriority];
  let obstacles = [], dirty = true, pending = null, eventSerial = 0, representative = 0, pair = null;
  const listeners = [], pets = [], preloads = [], failed = new Set(), seen = new Map();
  const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });
  const paused = () => manualPaused || reduced;
  const selected = DATA.filter(p => enabledCharacters.includes(p.id));
  let requestedVisible = new Set(visibleCharacters.filter(id => selected.some(p => p.id === id)));
  let externalPresentation = null;
  const visibleIds = () => {
    const ids = selected.map(p => p.id).filter(id => requestedVisible.has(id) && id !== externalPresentation);
    return viewport().w < 640 && mobileLimit >= 0 && !mobilePetStages
      ? [...new Set([...mobileOrder, ...ids])].filter(id => ids.includes(id)).slice(0, mobileLimit) : ids;
  };
  const isBeta = p => p.id === 'chiikawa' && experimentalCharacters.includes(p.id) && !!characterProfiles[p.id]?.betaManifest;
  const profile = p => { const original = characterProfiles[p.id] ?? {}; return isBeta(p) ? { ...original, animationManifest: original.betaManifest, behavior: { idle: 30, [original.betaManifest.actions.walk ? 'walk' : 'step-in-place']: 60, happy: 10 } } : original; };
  const sequenceFor = (p, action, direction = p.dir < 0 ? 'left' : 'right') => resolvePetSequence(profile(p), action, direction, { allowDraft: isBeta(p) });
  const source = (id, frame) => spriteSources?.[id]?.[frame] ?? `${String(assetBase).replace(/\/$/, '')}/characters/${id}/${frame}.png`;
  const mobileStage = p => viewport().w < 640 ? mobilePetStages?.[p.id] : null;
  const stageRect = p => mobileStage(p) && !mobileStage(p).hidden ? mobileStage(p).getBoundingClientRect() : isBeta(p) && experimentalStage && !experimentalStage.hidden ? experimentalStage.getBoundingClientRect() : null;
  const xBounds = p => { const r = stageRect(p); return r ? [r.left + 8, r.right - p.width - 8] : [0, viewport().w - p.width]; };
  const constrainX = (p, x) => { const [left, right] = xBounds(p); return clamp(x, left, right); };
  const ground = p => { const r = stageRect(p); return Math.max(0, (r ? r.bottom : viewport().h) - p.height - floorOffset); };
  // Paused/reduced actors still finish explicit reactions and direct-input physics.
  // Unpaused idle retains the existing autonomous decision clock.
  function needsFrame() {
    return !destroyed && !document.hidden && pets.some(p => !p.el.hidden) &&
      (!paused() || dirty || pending || pair || pets.some(p => !p.el.hidden &&
        (p.action || p.touch || p.airborne || p.pointerId !== null)));
  }
  function wake() {
    if (started && !ticking && !raf && needsFrame()) { lastTime = 0; raf = requestAnimationFrame(tick); }
  }
  function invalidate() { dirty = true; wake(); }
  function listen(el, type, fn, opts) { el.addEventListener(type, fn, opts); listeners.push([el, type, fn, opts]); }
  function pose(p, name = 'idle') {
    if (isBeta(p) && name === 'idle') { const neutral = sequenceFor(p, 'idle', 'front')?.frames[0]; if (neutral && !failed.has(neutral.source)) { display(p, neutral.frameId, neutral.source, 'beta-static', neutral); return; } }
    const frames = spriteSources?.[p.id] ?? profile(p).frames;
    if (!(frames ? Object.hasOwn(frames, name) : DEFAULT_POSES.includes(name))) name = 'idle';
    const src = source(p.id, name);
    display(p, name, src, 'static-fallback');
  }
  function display(p, name, src, kind, frame = null) {
    if (failed.has(src)) { name = 'idle'; src = source(p.id, 'idle'); kind = 'static-fallback'; }
    if (p.src !== src) { p.src = src; p.img.src = src; }
    if (frame?.assetSize) {
      const [x, y, w, h] = frame.sourceRect ?? [0, 0, ...frame.assetSize], [sw, sh] = frame.assetSize;
      const scale = Math.min(p.width / w, p.height / h) * (frame.renderScale ?? 1);
      const [px, py] = frame.pivot ?? [.5, 1];
      Object.assign(p.img.style, { position: 'absolute', objectFit: 'fill', width: `${sw * scale}px`, height: `${sh * scale}px`,
        maxWidth: 'none', left: `${p.width / 2 - px * w * scale - x * scale}px`, top: `${p.height - py * h * scale - y * scale}px`,
        clipPath: `inset(${y * scale}px ${(sw - x - w) * scale}px ${(sh - y - h) * scale}px ${x * scale}px)` });
    } else {
      for (const key of ['position', 'objectFit', 'width', 'height', 'maxWidth', 'left', 'top', 'clipPath']) p.img.style[key] = '';
    }
    p.frame = name; p.el.dataset.frame = name; p.el.dataset.assetMode = kind;
  }
  function mode(p, name) {
    if (p.mode !== name) { p.mode = name; p.el.dataset.mode = name; onStatusChange?.(p.id, name); }
    p.el.classList.toggle('cv-pet--dragging', p.pointerId !== null);
  }
  function start(p, action, fallback = 'idle', duration = .6, next = null) {
    const direction = p.dir < 0 ? 'left' : 'right';
    const sequence = !reduced && !manualPaused ? sequenceFor(p, action, direction) : null;
    p.action = { id: action, sequence, elapsed: 0, duration, next, fallback };
    mode(p, action); pose(p, fallback);
    if (sequence) advance(p, 0);
    wake();
  }
  function idle(p) { p.action = null; p.wait = rand(1.5, 4.5); mode(p, 'idle'); pose(p); }
  function advance(p, dt) {
    const a = p.action; if (!a) return;
    a.elapsed += dt;
    let done = a.elapsed >= a.duration;
    if (a.sequence) {
      if (a.sequence.frames.some(f => failed.has(f.source))) { idle(p); return; }
      const sample = samplePetSequence(a.sequence, a.elapsed * 1000);
      display(p, sample.frame.frameId, sample.frame.source, isBeta(p) ? (a.sequence.frames.length > 1 ? 'beta-sequence' : 'beta-static') : 'sequence', sample.frame);
      done = sample.done || (['start', 'correct', 'wrong', 'complete'].includes(a.id) && a.elapsed >= a.duration) || (a.sequence.loop && !['hold', 'fall', 'walk'].includes(a.id) && a.elapsed >= a.duration && sample.phase < .12);
      if (a.id === 'walk') {
        // Root and frame phase use the SAME clamped clock, including dropped RAF frames.
        const speed = a.sequence.rootDistance * p.width / (sample.duration / 1000);
        const nextX = p.x + p.dir * speed * dt;
        p.x = constrainX(p, nextX);
        if (nextX !== p.x || a.elapsed >= a.duration && sample.phase < .12) done = true;
      }
    }
    if (!done || a.id === 'hold' || a.id === 'fall') return;
    const next = a.next; p.action = null;
    if (next) next(); else if (a.id === 'walk') start(p, 'walk-stop', 'idle', .14); else idle(p);
  }
  function cancelPair() {
    if (!pair) return;
    const actors = pair.actors; pair = null;
    for (const p of actors) { p.pairRole = null; if (!PHYSICAL.has(p.mode)) idle(p); }
  }
  function releaseCapture(p) {
    const id = p.pointerId; p.pointerId = null; p.touch = null;
    if (id !== null && p.el.hasPointerCapture?.(id)) p.el.releasePointerCapture(id);
    p.el.classList.remove('cv-pet--dragging');
  }
  function safeReset(p) {
    releaseCapture(p); p.airborne = false; p.vx = p.vy = 0; p.y = ground(p); idle(p); render(p);
  }
  function resetAll() { cancelPair(); pending = null; for (const p of pets) safeReset(p); lastTime = 0; }
  function cancelExternalPresentation(reason) {
    if (!externalPresentation) return;
    externalPresentation = null; onPresentationCancelled?.(reason);
  }
  function render(p) {
    const r = stageRect(p);
    if (r) { if (Number.isFinite(p.stageLeft)) p.x += r.left - p.stageLeft; p.stageLeft = r.left; }
    else p.stageLeft = null;
    if (r && !PHYSICAL.has(p.mode)) p.y = ground(p);
    p.el.style.touchAction = mobileStage(p) ? 'pan-x pan-y' : '';
    const dock = mobileStage(p) && mobileStageViewport ? mobileStageViewport.getBoundingClientRect() : null;
    p.el.style.visibility = r && (r.bottom <= 0 || r.top >= viewport().h || r.right <= 0 || r.left >= viewport().w) ? 'hidden' : '';
    p.el.style.clipPath = dock ? `inset(${Math.max(0, dock.top - p.y)}px ${Math.max(0, p.x + p.width - dock.right)}px ${Math.max(0, p.y + p.height - dock.bottom)}px ${Math.max(0, dock.left - p.x)}px)` : '';
    p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    // No scaleX(-1), squash, rotation, or CSS walk substitution, including Rakko.
    const blocked = p.pointerId === null && obstacles.some(r => p.x < r.right + 4 && p.x + p.width > r.left - 4 && p.y < r.bottom + 4 && p.y + p.height > r.top - 4);
    p.el.classList.toggle('cv-pet--yielding', blocked);
  }
  function beginGrab(p, e) {
    if (externalPresentation) { cancelExternalPresentation('direct-input'); layout(); }
    cancelPair(); p.touch = null; p.pointerId = e.pointerId;
    try { p.el.setPointerCapture(e.pointerId); } catch (_) { p.pointerId = null; return; }
    p.grabDX = e.clientX - p.x; p.grabDY = e.clientY - p.y;
    p.prevX = e.clientX; p.prevY = e.clientY; p.prevTime = performance.now();
    p.throwVX = p.throwVY = 0; p.airborne = false;
    start(p, 'grab-onset', 'grabbed', .16, () => start(p, 'hold', 'grabbed', Infinity)); render(p);
  }
  function pointerDown(p, e) {
    if (e.button !== 0 || e.isPrimary === false || destroyed || p.el.hidden || p.pointerId !== null || document.hidden) return;
    // Long press to drag on touch; vertical gestures remain browser scrolling.
    if (e.pointerType === 'touch') { p.touch = { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, at: performance.now() }; wake(); return; }
    if (e.cancelable) e.preventDefault(); beginGrab(p, e);
  }
  function pointerMove(p, e) {
    if (p.touch?.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - p.touch.clientX, e.clientY - p.touch.clientY) > 8) p.touch = null;
      return;
    }
    if (p.pointerId !== e.pointerId) return;
    if (e.cancelable) e.preventDefault();
    const now = performance.now(), dt = Math.max(.012, (now - p.prevTime) / 1000);
    p.throwVX = clamp((e.clientX - p.prevX) / dt, -750, 750); p.throwVY = clamp((e.clientY - p.prevY) / dt, -850, 850);
    p.prevX = e.clientX; p.prevY = e.clientY; p.prevTime = now;
    p.x = constrainX(p, e.clientX - p.grabDX); p.y = clamp(e.clientY - p.grabDY, 0, ground(p)); render(p);
  }
  function pointerEnd(p, e, cancelled = false) {
    if (p.touch?.pointerId === e.pointerId) p.touch = null;
    if (p.pointerId !== e.pointerId) return;
    releaseCapture(p);
    if (cancelled || paused()) { safeReset(p); return; }
    // A stationary hold must not reuse the velocity from an old move.
    const stale = performance.now() - p.prevTime > 100;
    Object.assign(p, petReleaseVelocity(stale ? 0 : p.throwVX, stale ? 0 : p.throwVY));
    start(p, 'release', 'grabbed', .1, () => {
      if (p.y >= ground(p) - 1 && p.vy >= -30) land(p);
      else { p.airborne = true; start(p, 'fall', 'grabbed', Infinity); }
    });
  }
  function land(p) {
    p.airborne = false; p.vx = p.vy = 0; p.y = ground(p);
    // Old compressed landing PNGs are not used as a stand-in for real impact frames.
    start(p, 'landing', 'idle', .18, () => start(p, 'recover', 'idle', .2));
  }
  function sizePet(p) {
    const scale = viewport().w < 640 ? (mobilePetStages ? .70 : visibleIds().length > 3 ? .40 : .62) : viewport().w <= 900 ? .8 : 1;
    p.width = Math.min(p.size * scale, Math.max(1, viewport().w)); p.height = p.width * 4 / 3;
    p.el.style.setProperty('--cv-pet-size', `${p.width}px`);
  }
  function layout() {
    resetAll(); const ids = visibleIds();
    for (const p of pets) {
      const wasShown = !p.el.hidden, shown = ids.includes(p.id), hadFocus = document.activeElement === p.el;
      p.el.hidden = !shown; sizePet(p);
      if (!shown && wasShown) onCharacterHidden?.(p.id, { hadFocus });
      if (!p.el.hidden) { const [left, right] = xBounds(p); p.x = stageRect(p) ? (left + right) / 2 : constrainX(p, viewport().w * (ids.indexOf(p.id) + .5) / ids.length - p.width / 2); }
      p.stageLeft = stageRect(p)?.left ?? null;
      p.y = ground(p); render(p);
    }
    if (!ids.length || document.hidden) { cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
    root.dataset.visibleCount = String(ids.length); invalidate();
  }
  for (const info of selected) {
    const el = document.createElement('div'); el.className = 'cv-pet'; el.dataset.character = info.id;
    el.tabIndex = 0; el.setAttribute('role', 'button');
    if (isBeta(info)) { el.dataset.quality = 'beta'; el.title = '치이카와 동작 베타 · 원화 외형/연결 미승인'; }
    el.setAttribute('aria-label', `${info.label}: 마우스로 끌기, 터치는 길게 누르기. Enter로 인사, Escape로 내려놓기`);
    el.innerHTML = `<div class="cv-pet__figure"><img class="cv-pet__image" draggable="false" alt=""/><span class="cv-pet__name">${info.label}</span></div>`;
    const p = { ...info, el, img: el.querySelector('.cv-pet__image'), pointerId: null, touch: null, x: 0, y: 0, width: 0, height: 0, dir: 1, mode: 'idle', frame: null, airborne: false, vx: 0, vy: 0, action: null };
    pets.push(p); root.appendChild(el); sizePet(p); idle(p);
    listen(el, 'focus', () => { mobileStage(p)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); });
    listen(el, 'pointerdown', e => pointerDown(p, e)); listen(el, 'pointermove', e => pointerMove(p, e));
    listen(el, 'pointerup', e => pointerEnd(p, e));
    listen(el, 'pointercancel', e => pointerEnd(p, e, true)); listen(el, 'lostpointercapture', e => pointerEnd(p, e, true));
    listen(el, 'keydown', e => {
      if (['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); e.stopPropagation();
        if (e.key === 'Escape') { cancelPair(); safeReset(p); } else react('start', p.id);
      }
    });
    listen(p.img, 'error', () => { failed.add(p.src); root.dataset.assetError = `${p.id}/${p.frame}`; if (p.frame !== 'idle') { idle(p); } else p.img.style.visibility = 'hidden'; });
    listen(p.img, 'load', () => { p.img.style.visibility = ''; });
  }
  // Decode optional sequences before use; a failed image degrades to neutral, never blocks study.
  root.dataset.assetsLoaded = '0';
  const urls = new Set();
  for (const p of pets) {
    for (const name of Object.keys(spriteSources?.[p.id] ?? profile(p).frames ?? { idle: '' })) urls.add(source(p.id, name));
    for (const src of Object.values(profile(p).animationManifest?.assets ?? {})) urls.add(src);
    for (const entry of Object.values(profile(p).animationManifest?.actions ?? {})) for (const view of Object.values(entry.views ?? {})) for (const frame of view.frames ?? []) if (frame.source) urls.add(frame.source);
  }
  for (const src of urls) { const img = new Image(); img.onload = () => { if (!destroyed) root.dataset.assetsLoaded = String(Number(root.dataset.assetsLoaded) + 1); }; img.onerror = () => { failed.add(src); root.dataset.assetError = 'preload'; }; img.src = src; preloads.push(img); }
  function reaction(p, type, duration) {
    const defaults = { start: 'wave', correct: 'happy', wrong: 'encourage', complete: 'happy' };
    const configured = profile(p).vocab?.[type];
    // Wrong means "unknown", not failure: do not play crying or punitive poses.
    const fallback = type === 'wrong' ? (profile(p).frames?.encourage ? 'encourage' : 'idle') : configured ?? defaults[type];
    start(p, type, fallback, duration);
  }
  function processEvent(now) {
    if (!pending) return;
    if (now - pending.at > 1000) { pending = null; return; }
    if (now < pending.ready) return;
    const choices = pets.filter(p => !p.el.hidden && !PHYSICAL.has(p.mode) && (pending.target === 'all' || pending.target === p.id));
    if (!choices.length) return;
    cancelPair();
    for (const p of pets) if (!PHYSICAL.has(p.mode) && p.mode !== 'idle') idle(p);
    const event = pending; pending = null;
    const lead = choices[representative++ % choices.length];
    reaction(lead, event.type, event.type === 'complete' ? 1.25 : event.type === 'wrong' ? .65 : .8);
    if (event.type === 'complete' && choices.length > 1 && !paused()) {
      const partner = choices.find(p => p !== lead);
      pair = { actors: [lead, partner], elapsed: 0, responded: false };
      lead.pairRole = 'lead'; partner.pairRole = 'response';
    }
  }
  function react(type, target = 'all', metadata = {}) {
    if (destroyed || document.hidden || externalPresentation || !pets.some(p => !p.el.hidden && (target === 'all' || p.id === target)) || !['start', 'correct', 'wrong', 'complete'].includes(type)) return;
    const now = performance.now();
    const id = metadata.eventId ?? `local-${++eventSerial}`;
    if (seen.has(id)) return;
    seen.set(id, now); for (const [key, at] of seen) if (now - at > 5000 || seen.size > 128) seen.delete(key);
    if (Number.isFinite(metadata.occurredAt) && Date.now() - metadata.occurredAt > 1000) return;
    // Coalesce same-turn correct + complete; latest event replaces, never a backlog.
    if (pending?.type === 'complete' && type === 'correct' && now - pending.at < 100) return;
    pending = { type, target, at: now, ready: now + 45 };
    wake();
  }
  function decide(p) {
    if (externalPresentation) { p.wait = 1; return; }
    if (pets.some(q => q !== p && !q.el.hidden && q.mode !== 'idle') || pair || pending) { p.wait = 1; return; }
    const weights = availablePetWeights(profile(p).behavior ?? { idle: 100 }, profile(p), { allowDraft: isBeta(p) });
    const action = pickPetBehavior(weights);
    if (action === 'idle') { p.wait = rand(1.5, 4.5); return; }
    if (action === 'walk') {
      p.dir = Math.random() < .5 ? -1 : 1;
      if (!sequenceFor(p, 'walk')) p.dir *= -1;
      start(p, 'walk-start', 'idle', .12, () => start(p, 'walk', 'idle', rand(1.5, 3.2)));
    } else start(p, action, action, rand(1.0, 1.8));
  }
  function tick(now) {
    raf = 0;
    if (destroyed) return;
    ticking = true;
    const dt = lastTime ? clamp((now - lastTime) / 1000, 0, .04) : 0; lastTime = now;
    if (dirty) { obstacles = [...document.querySelectorAll(avoidSelector)].map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0); dirty = false; }
    if (!document.hidden) {
      processEvent(now);
      if (pair) { pair.elapsed += dt;
        if (!pair.responded && pair.elapsed >= .3) { pair.responded = true; reaction(pair.actors[1], 'complete', .9); }
        if (pair.elapsed >= 1.5) cancelPair();
      }
      for (const p of pets) {
        if (p.el.hidden) continue;
        if (p.touch && now - p.touch.at >= 220) beginGrab(p, p.touch);
        if (p.airborne) { p.vy += 1900 * dt; p.y = Math.max(0, p.y + p.vy * dt); p.x = constrainX(p, p.x + p.vx * dt); if (p.y >= ground(p)) land(p); }
        advance(p, dt);
        if (!p.action && p.pointerId === null && !paused()) { p.wait -= dt; if (p.wait <= 0) decide(p); }
        render(p);
      }
    }
    ticking = false;
    raf = needsFrame() ? requestAnimationFrame(tick) : 0;
  }
  for (const type of ['start', 'correct', 'wrong', 'complete']) listen(document, `vocab:${type}`, e => { react(type, e.detail?.character ?? 'all', e.detail ?? {}); invalidate(); });
  for (const type of ['click', 'change', 'vocab:view']) listen(document, type, () => { invalidate(); });
  listen(window, 'scroll', () => { invalidate(); for (const p of pets) if (stageRect(p) && PHYSICAL.has(p.mode)) safeReset(p); }, { passive: true, capture: true });
  listen(document, 'keydown', e => { if (e.key === 'Escape' && pets.some(p => PHYSICAL.has(p.mode))) { e.preventDefault(); resetAll(); } });
  listen(window, 'resize', () => { cancelExternalPresentation('resize'); layout(); });
  listen(window, 'blur', () => { cancelExternalPresentation('blur'); layout(); });
  listen(document, 'visibilitychange', () => { cancelExternalPresentation('visibility'); layout(); invalidate(); });
  listen(window, 'pagehide', () => { cancelExternalPresentation('pagehide'); layout(); }); listen(window, 'pageshow', () => { layout(); invalidate(); });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidate) : null;
  observer?.observe(document.querySelector('main') || document.body);
  function syncPaused() { cancelExternalPresentation('pause-or-motion-preference'); layout(); root.dataset.paused = String(paused()); }
  if (query) listen(query, 'change', e => { reduced = e.matches; syncPaused(); });
  layout(); root.dataset.paused = String(paused()); started = true; wake();
  function playAction(action, target = 'chiikawa') {
    const p = pets.find(p => p.id === target);
    if (!p || !isBeta(p) || p.el.hidden || paused() || PHYSICAL.has(p.mode) || action !== 'walk') return false;
    if (externalPresentation) { cancelExternalPresentation('new-preview'); layout(); }
    cancelPair();
    for (const q of pets) if (!PHYSICAL.has(q.mode)) idle(q);
    if (sequenceFor(p, 'walk', 'right') || sequenceFor(p, 'walk', 'left')) {
      p.dir = sequenceFor(p, 'walk', p.x > viewport().w / 2 ? 'left' : 'right') ? (p.x > viewport().w / 2 ? -1 : 1) : sequenceFor(p, 'walk', 'right') ? 1 : -1;
      start(p, 'walk-start', 'idle', .12, () => start(p, 'walk', 'idle', 2.5));
    } else start(p, 'step-in-place', 'idle', 2.5);
    return true;
  }
  const api = {
    react, playAction, pause() { manualPaused = true; syncPaused(); }, resume() { manualPaused = false; syncPaused(); }, isPaused: paused,
    setMobileCharacters(ids) { if (destroyed) return; mobileOrder = [...new Set(ids)].filter(id => selected.some(p => p.id === id)); mobileLimit = mobileOrder.length; layout(); },
    setVisibleCharacters(ids) { if (destroyed) return; requestedVisible = new Set(ids.filter(id => selected.some(p => p.id === id))); if (externalPresentation && !requestedVisible.has(externalPresentation)) cancelExternalPresentation('hidden'); layout(); },
    beginExternalPresentation(id) { if (destroyed || !requestedVisible.has(id) || !selected.some(p => p.id === id)) return false; cancelExternalPresentation('replaced'); externalPresentation = id; layout(); return true; },
    endExternalPresentation(id) { if (destroyed || externalPresentation !== id) return; externalPresentation = null; layout(); },
    getExternalPresentation() { return externalPresentation; },
    focusCharacter(id) { if (externalPresentation === id) { cancelExternalPresentation('focus'); layout(); } const p = pets.find(p => p.id === id && !p.el.hidden); if (!p) return false; mobileStage(p)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); render(p); p.el.focus?.({ preventScroll: true }); return true; },
    getVisibleCharacters() { return selected.map(p => p.id).filter(id => requestedVisible.has(id)); },
    getState() { return pets.map(p => ({ id: p.id, mode: p.mode, frame: p.frame, x: p.x, y: p.y, width: p.width, height: p.height, dir: p.dir, airborne: p.airborne, glide: false, jump: false, visible: !p.el.hidden, onScreen: !p.el.hidden && p.el.style.visibility !== 'hidden', reactionTime: p.action ? Math.max(0, p.action.duration - p.action.elapsed) : 0, assetMode: p.el.dataset.assetMode, pairRole: p.pairRole ?? null, captured: p.pointerId !== null })); },
    destroy() { if (destroyed) return; cancelExternalPresentation('destroy'); resetAll(); destroyed = true; cancelAnimationFrame(raf); for (const [el, type, fn, opts] of listeners) el.removeEventListener(type, fn, opts); observer?.disconnect(); for (const img of preloads) { img.onload = img.onerror = null; } root.remove(); if (window[INSTANCE] === api) delete window[INSTANCE]; },
  };
  window[INSTANCE] = api; return api;
}
