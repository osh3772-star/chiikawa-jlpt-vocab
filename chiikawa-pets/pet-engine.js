/**
 * Chiikawa-style vocabulary app pets, dependency-free ESM.
 * Generated image poses are distinct static illustrations, not a perfectly aligned walk cycle.
 * Works in browser environments with Pointer Events. Does not touch your vocabulary data.
 *
 * Example:
 *  const pets = mountChiikawaPets({ assetBase: '/chiikawa' });
 *  document.dispatchEvent(new Event('vocab:correct'));
 *  // on teardown: pets.destroy();
 */
// Personality choices and special-action weights merged from the supplied v2 engine.
const DATA = [
  { id: 'chiikawa', label: '치이카와', size: 126, speed: 42, walk: .48, actions: [['wave', .12], ['encourage', .16], ['weeding', .18], ['sasumata', .10]] },
  { id: 'hachiware', label: '하치와레', size: 130, speed: 48, walk: .54, actions: [['wave', .10], ['encourage', .12], ['guitar', .16], ['camera', .14], ['sasumata', .10]] },
  { id: 'usagi', label: '우사기', size: 126, speed: 64, walk: .71, actions: [['wave', .10], ['cheer', .12], ['jump', .15], ['onigiri', .18], ['sasumata', .10]] },
  { id: 'shisa', label: '시사', size: 122, speed: 39, walk: .39, actions: [['study', .25], ['bow', .17], ['ramen-serve', .09]] },
  { id: 'momonga', label: '모몽가', size: 127, speed: 61, walk: .48, actions: [['charm', .18], ['tail-proud', .17], ['pout', .08], ['fake-cry', .06], ['glide', .14]] },
  { id: 'rakko', label: '랏코', size: 120, speed: 34, walk: .34, actions: [['sword', .15], ['dessert', .11], ['study', .10], ['sleep', .10]] },
];
const FRAMES = ['idle', 'blink', 'walk-a', 'walk-b', 'happy', 'reaction', 'grabbed', 'landing'];
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
const rand = (min, max) => min + Math.random() * (max - min);
const imgURL = (base, who, frame) => `${base}/characters/${who}/${frame}.png`;
const INSTANCE = Symbol.for('jlpt.chiikawa-pets');

export function mountChiikawaPets(options = {}) {
  const {
    assetBase = '/chiikawa',
    enabledCharacters = DATA.map(p => p.id),
    floorOffset = 8,
    startPaused = false,
    onStatusChange = null,
    spriteSources = null,
    characterProfiles = {},
    maxVisibleMobile = 3,
    mobilePriority = ['shisa', 'momonga', 'rakko'],
    avoidSelector = '#card, button, select, input, textarea, a, .table-scroll',
  } = options;
  if (typeof document === 'undefined') {
    return { react() {}, pause() {}, resume() {}, destroy() {}, getState() { return []; } };
  }
  if (window[INSTANCE]) return window[INSTANCE];
  const base = String(assetBase).replace(/\/$/, '');
  const root = document.createElement('div');
  root.className = 'cv-pet-layer';
  root.setAttribute('aria-label', '움직이는 치이카와 마스코트');
  document.body.appendChild(root);
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery?.matches ?? false;
  let destroyed = false;
  let paused = Boolean(startPaused) || reducedMotion;
  let raf = 0;
  let lastTime = 0;
  const listeners = [];
  const pets = [];
  const selected = DATA.filter(info => enabledCharacters.includes(info.id));
  let mobileLimit = maxVisibleMobile;
  let mobileOrder = [...mobilePriority];
  function visibleIds() {
    const ids = selected.map(p => p.id);
    return viewport().w < 640 && mobileLimit >= 0
      ? [...new Set([...mobileOrder, ...ids])].filter(id => ids.includes(id)).slice(0, mobileLimit) : ids;
  }
  let obstacles = [], obstaclesDirty = true;
  const source = (id, frame) => spriteSources?.[id]?.[frame] ?? imgURL(base, id, frame);
  const preloads = [];
  root.dataset.assetsLoaded = '0';
  for (const { id } of selected) for (const frame of Object.keys(spriteSources?.[id] ?? characterProfiles[id]?.frames ?? Object.fromEntries(FRAMES.map(f => [f, f])))) {
    const img = new Image();
    img.onload = () => { root.dataset.assetsLoaded = String(Number(root.dataset.assetsLoaded) + 1); };
    img.onerror = () => { root.dataset.assetError = `${id}/${frame}`; };
    img.src = source(id, frame);
    preloads.push(img);
  }
  const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });
  let previousWidth = viewport().w;
  const report = (p) => { if (typeof onStatusChange === 'function') onStatusChange(p.id, p.mode); };
  function listen(el, event, handler, opts) {
    el.addEventListener(event, handler, opts);
    listeners.push([el, event, handler, opts]);
  }
  function ground(p) { return Math.max(0, viewport().h - p.height - floorOffset); }
  function showFrame(p, name) {
    const frames = spriteSources?.[p.id] ?? characterProfiles[p.id]?.frames;
    if (p.frame === name || !(frames ? Object.hasOwn(frames, name) : FRAMES.includes(name))) return;
    p.frame = name;
    p.img.src = source(p.id, name);
    p.img.alt = `${p.label} ${name}`;
    p.el.dataset.frame = name;
  }
  function setMode(p, mode) {
    if (p.mode === mode) return;
    p.mode = mode;
    p.el.dataset.mode = mode;
    p.el.classList.toggle('cv-pet--dragging', mode === 'dragged');
    p.el.classList.toggle('cv-pet--celebrating', mode === 'happy');
    p.el.classList.toggle('cv-pet--sad', mode === 'sad');
    p.el.classList.toggle('cv-pet--landing', mode === 'landing');
    p.el.classList.toggle('cv-pet--special', mode === 'special');
    p.el.classList.toggle('cv-pet--glide', mode === 'glide');
    p.el.classList.toggle('cv-pet--jump', mode === 'jump');
    p.el.classList.toggle('cv-pet--pose-walk', mode === 'walk' && !!characterProfiles[p.id]?.motion?.walkPose);
    report(p);
  }
  function decide(p) {
    if (Math.random() < p.walk) {
      setMode(p, 'walk'); p.dir = Math.random() < .5 ? -1 : 1;
      p.actionTime = rand(1.1, p.id === 'momonga' ? 2.8 : 3.8);
      showFrame(p, characterProfiles[p.id]?.motion?.walkPose ?? 'walk-a'); return;
    }
    const choice = Math.random(); let weight = 0;
    for (const [frame, probability] of p.actions) {
      weight += probability;
      if (choice < weight) {
        if (frame === 'glide' && !reducedMotion) startGlide(p);
        else if (frame === 'jump' && !reducedMotion) startJump(p);
        else { setMode(p, 'special'); showFrame(p, frame); p.reactionTime = rand(1.35, 2.45); }
        return;
      }
    }
    setMode(p, 'idle'); showFrame(p, 'idle'); p.actionTime = rand(1.2, 4.2);
  }
  function startGlide(p) {
    p.glide = true; p.jump = false; p.airborne = true; p.vx = p.dir * p.speed * .6; p.vy = -230;
    p.y = Math.max(0, Math.min(p.y, ground(p) - 2));
    setMode(p, 'glide'); showFrame(p, 'glide');
  }
  function startJump(p) {
    p.glide = false; p.jump = true; p.airborne = true; p.vx = p.dir * p.speed * .3; p.vy = -360;
    p.y = Math.max(0, Math.min(p.y, ground(p) - 2));
    setMode(p, 'jump'); showFrame(p, 'jump');
  }
  function render(p) {
    const face = p.dir < 0 ? -1 : 1;
    p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    // Independent scale keeps the facing direction during CSS cheer/squash keyframes.
    p.figure.style.scale = `${face} 1`;
    p.el.style.setProperty('--cv-facing', String(face));
    const blocked = p.mode !== 'dragged' && obstacles.some(r =>
      p.x < r.right + 4 && p.x + p.width > r.left - 4 && p.y < r.bottom + 4 && p.y + p.height > r.top - 4);
    p.el.classList.toggle('cv-pet--yielding', blocked);
  }
  function reactPet(p, type) {
    if (p.el.hidden || p.mode === 'dragged') return;
    if (p.airborne) { if (p.glide || p.jump) p.pendingEvent = type; return; }
    const defaults = { start: 'blink', correct: 'happy', wrong: p.id === 'usagi' ? 'landing' : 'reaction', complete: 'happy' };
    const frame = characterProfiles[p.id]?.vocab?.[type] ?? defaults[type];
    if (!frame) return;
    // The package's behavior table/engine specifies a blink for Rakko's start.
    const pose = type === 'start' && p.id === 'rakko' ? 'blink' : frame;
    if (pose === 'glide' && !reducedMotion) { startGlide(p); return; }
    if (type === 'correct' || type === 'complete') {
      setMode(p, 'happy');
      showFrame(p, pose);
      p.reactionTime = type === 'complete' ? 2.4 : 1.15;
    } else if (type === 'wrong') {
      setMode(p, p.id === 'shisa' ? 'special' : 'sad');
      showFrame(p, pose);
      p.reactionTime = 1.25;
    } else if (type === 'start') {
      setMode(p, 'idle');
      showFrame(p, pose);
      p.reactionTime = p.id === 'shisa' || p.id === 'momonga' ? 1.2 : .55;
    }
  }
  function pointerDown(p, e) {
    if (e.button !== 0 || e.isPrimary === false || destroyed || p.el.hidden || p.pointerId !== null) return;
    if (e.cancelable) e.preventDefault();
    p.el.setPointerCapture(e.pointerId);
    p.pointerId = e.pointerId;
    p.grabDX = e.clientX - p.x;
    p.grabDY = e.clientY - p.y;
    p.prevPointerX = e.clientX;
    p.prevPointerY = e.clientY;
    p.prevPointerTime = performance.now();
    p.throwVX = 0;
    p.throwVY = 0;
    p.airborne = false;
    p.glide = false;
    p.jump = false;
    p.reactionTime = 0;
    p.pendingEvent = null;
    setMode(p, 'dragged');
    showFrame(p, 'grabbed');
    render(p);
  }
  function pointerMove(p, e) {
    if (p.pointerId !== e.pointerId || p.mode !== 'dragged') return;
    if (e.cancelable) e.preventDefault();
    const now = performance.now();
    const delta = Math.max((now - p.prevPointerTime) / 1000, .012);
    p.throwVX = clamp((e.clientX - p.prevPointerX) / delta, -750, 750);
    p.throwVY = clamp((e.clientY - p.prevPointerY) / delta, -850, 850);
    p.prevPointerTime = now;
    p.prevPointerX = e.clientX;
    p.prevPointerY = e.clientY;
    p.x = clamp(e.clientX - p.grabDX, 0, viewport().w - p.width);
    p.y = clamp(e.clientY - p.grabDY, 0, ground(p));
    render(p);
  }
  function pointerUp(p, e) {
    if (p.pointerId !== e.pointerId) return;
    const pointerId = p.pointerId;
    p.pointerId = null;
    p.glide = false;
    p.jump = false;
    if (p.el.hasPointerCapture(pointerId)) p.el.releasePointerCapture(pointerId);
    p.vx = p.throwVX * .22;
    p.vy = clamp(p.throwVY * .25, -350, 450);
    p.airborne = p.y < ground(p) - 1 || p.vy < -30;
    if (p.airborne && !reducedMotion) {
      setMode(p, 'fall');
      showFrame(p, 'grabbed');
    } else {
      p.y = ground(p);
      land(p);
    }
  }
  function land(p) {
    p.airborne = false;
    p.glide = false;
    p.jump = false;
    p.vx = 0;
    p.vy = 0;
    p.reactionTime = .4;
    setMode(p, 'landing');
    showFrame(p, 'landing');
  }
  for (const info of selected) {
    const el = document.createElement('div');
    el.className = 'cv-pet';
    el.dataset.character = info.id;
    el.dataset.mode = 'idle';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${info.label} 캐릭터: 마우스나 터치로 끌어서 옮기기`);
    el.innerHTML = `<div class="cv-pet__figure"><img class="cv-pet__image" draggable="false" alt=""/><span class="cv-pet__name">${info.label}</span></div>`;
    const p = {
      ...info, el,
      figure: el.querySelector('.cv-pet__figure'),
      img: el.querySelector('.cv-pet__image'),
      frame: null, mode: 'idle', width: 0, height: 0,
      x: 0, y: 0, dir: 1, actionTime: rand(1, 4), walkFrameTime: 0,
      reactionTime: 0, airborne: false, glide: false, jump: false, pendingEvent: null, vx: 0, vy: 0, pointerId: null,
    };
    sizePet(p);
    el.style.setProperty('--cv-step-time', info.id === 'usagi' ? '.28s' : '.46s');
    p.x = clamp(viewport().w * (selected.indexOf(info) + .5) / selected.length - p.width / 2, 0, Math.max(0, viewport().w - p.width));
    p.y = ground(p);
    root.appendChild(el);
    pets.push(p);
    showFrame(p, 'idle');
    render(p);
    listen(el, 'pointerdown', (e) => pointerDown(p, e));
    listen(el, 'pointermove', (e) => pointerMove(p, e));
    listen(el, 'pointerup', (e) => pointerUp(p, e));
    listen(el, 'pointercancel', (e) => pointerUp(p, e));
    listen(el, 'lostpointercapture', (e) => pointerUp(p, e));
    listen(el, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation(); reactPet(p, 'correct');
      }
    });
  }
  function sizePet(p) {
    const count = visibleIds().length;
    const scale = viewport().w < 640 ? (count > 3 ? .40 : .62) : viewport().w <= 900 ? .8 : 1;
    p.width = Math.min(p.size * scale, Math.max(1, viewport().w));
    p.height = p.width * 4 / 3;
    p.el.style.setProperty('--cv-pet-size', `${p.width}px`);
  }
  function applyMobileVisibility(spread = false) {
    const ids = visibleIds();
    for (const p of pets) {
      const shown = ids.includes(p.id);
      if (!shown && p.pointerId !== null) pointerUp(p, { pointerId: p.pointerId });
      if (p.el.hidden !== !shown) {
        p.airborne = false; p.glide = false; p.jump = false; p.reactionTime = 0; p.pendingEvent = null;
        setMode(p, 'idle'); showFrame(p, 'idle');
      }
      p.el.hidden = !shown;
      sizePet(p);
      if (shown && spread && p.mode !== 'dragged') p.x = viewport().w * (ids.indexOf(p.id) + .5) / ids.length - p.width / 2;
      p.x = clamp(p.x, 0, Math.max(0, viewport().w - p.width));
      p.y = p.airborne || p.mode === 'dragged' ? clamp(p.y, 0, ground(p)) : ground(p);
      render(p);
    }
    root.dataset.visibleCount = String(ids.length);
    obstaclesDirty = true;
  }
  applyMobileVisibility(viewport().w < 640);
  function tick(now) {
    if (destroyed) return;
    const dt = lastTime ? clamp((now - lastTime) / 1000, 0, .04) : 0;
    lastTime = now;
    if (obstaclesDirty) {
      obstacles = [...document.querySelectorAll(avoidSelector)].map(el => el.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0 && r.top < viewport().h && r.bottom > 0);
      obstaclesDirty = false;
    }
    if (!document.hidden) {
      const bound = viewport();
      for (const p of pets) {
        if (p.el.hidden || p.mode === 'dragged') continue;
        if (p.airborne) {
          p.vy += (p.glide ? 470 : 1900) * dt;
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          p.x = clamp(p.x, 0, bound.w - p.width);
          p.y = Math.max(0, p.y);
          if (p.y >= ground(p)) {
            p.y = ground(p);
            land(p);
          }
        } else if (p.reactionTime > 0) {
          p.reactionTime -= dt;
          if (p.reactionTime <= 0) {
            setMode(p, 'idle');
            showFrame(p, 'idle');
            p.actionTime = rand(1.2, 2.8);
            if (p.pendingEvent) { const type = p.pendingEvent; p.pendingEvent = null; reactPet(p, type); }
          }
        } else if (!paused) {
          p.actionTime -= dt;
          if (p.actionTime <= 0) decide(p);
          if (p.mode === 'walk') {
            p.x += p.dir * p.speed * dt;
          if (p.x <= 0 || p.x >= Math.max(0, bound.w - p.width)) {
              p.x = clamp(p.x, 0, bound.w - p.width);
              p.dir *= -1;
            }
            p.walkFrameTime += dt;
            showFrame(p, characterProfiles[p.id]?.motion?.walkPose ?? (Math.floor(p.walkFrameTime / .23) % 2 ? 'walk-b' : 'walk-a'));
          } else if (p.mode === 'idle') {
            // Blink occasionally without using timers.
            showFrame(p, (now + pets.indexOf(p) * 1300) % 5300 < 130 ? characterProfiles[p.id]?.motion?.blinkPose ?? 'blink' : 'idle');
          }
        }
        render(p);
      }
    }
    raf = requestAnimationFrame(tick);
  }
  function react(type, target = 'all') {
    if (destroyed) return;
    for (const p of pets) if (target === 'all' || p.id === target) reactPet(p, type);
  }
  const eventTypes = {
    'vocab:correct': 'correct',
    'vocab:wrong': 'wrong',
    'vocab:complete': 'complete',
    'vocab:start': 'start',
  };
  for (const [ev, type] of Object.entries(eventTypes)) listen(document, ev, (e) => react(type, e.detail?.character ?? 'all'));
  const dirty = () => { obstaclesDirty = true; };
  for (const ev of [...Object.keys(eventTypes), 'click', 'change', 'vocab:view']) listen(document, ev, dirty);
  listen(window, 'scroll', dirty, { passive: true, capture: true });
  listen(document, 'visibilitychange', () => { lastTime = 0; dirty(); });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(dirty) : null;
  if (observer) observer.observe(document.querySelector('main') || document.body);
  listen(window, 'resize', () => {
    const width = viewport().w;
    for (const p of pets) {
      sizePet(p);
      p.x = clamp(p.x * width / Math.max(1, previousWidth), 0, Math.max(0, width - p.width));
      p.y = p.airborne || p.mode === 'dragged' ? clamp(p.y, 0, ground(p)) : ground(p);
      render(p);
    }
    previousWidth = width;
    applyMobileVisibility(true);
    dirty();
  });
  function setPaused(value) {
    paused = value;
    root.dataset.paused = String(paused);
    if (paused) for (const p of pets) if (p.mode === 'walk') { setMode(p, 'idle'); showFrame(p, 'idle'); }
    lastTime = 0;
  }
  if (motionQuery) listen(motionQuery, 'change', (event) => { reducedMotion = event.matches; setPaused(reducedMotion); });
  root.dataset.paused = String(paused);
  raf = requestAnimationFrame(tick);
  const api = {
    react,
    pause() { setPaused(true); },
    resume() { setPaused(false); },
    isPaused() { return paused; },
    setMobileCharacters(ids) {
      if (destroyed) return;
      mobileOrder = [...new Set(ids)].filter(id => selected.some(p => p.id === id));
      mobileLimit = mobileOrder.length;
      applyMobileVisibility(true);
    },
    getState() { return pets.map(p => ({ id: p.id, mode: p.mode, frame: p.frame, x: p.x, y: p.y, width: p.width, height: p.height, dir: p.dir, airborne: p.airborne, glide: p.glide, jump: p.jump, visible: !p.el.hidden, reactionTime: p.reactionTime })); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      for (const [el, ev, handler, opts] of listeners) el.removeEventListener(ev, handler, opts);
      observer?.disconnect();
      for (const img of preloads) { img.onload = null; img.onerror = null; }
      root.remove();
      if (window[INSTANCE] === api) delete window[INSTANCE];
    },
  };
  window[INSTANCE] = api;
  return api;
}
