import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { samplePetSequence } from '../chiikawa-pets/pet-engine.js';
const directory = new URL('../chiikawa-pets/draft-preview/', import.meta.url);
const config = JSON.parse(await readFile(new URL('config.json', directory), 'utf8'));
const html = await readFile(new URL('preview.template.html', directory), 'utf8');
class Target {
  constructor() { this.listeners = {}; this.style = {}; this.value = '1'; this.clientWidth = 1000; this.clientHeight = 410; this.capture = null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  emit(type, detail = {}) { for (const fn of this.listeners[type] ?? []) fn({ preventDefault() {}, ...detail }); }
  setPointerCapture(id) { this.capture = id; } hasPointerCapture(id) { return id === this.capture; } releasePointerCapture() { this.capture = null; }
  getBoundingClientRect() { return { left: 0, top: 0 }; }
}
function lab(reduced = false) {
  const elements = new Map();
  const document = new Target(); document.hidden = false;
  document.getElementById = id => { if (!elements.has(id)) elements.set(id, new Target()); return elements.get(id); };
  document.getElementById('draft-config').textContent = JSON.stringify(config);
  const window = new Target(), query = new Target(); query.matches = reduced;
  let callback, now = 0;
  const context = { document, window, matchMedia: () => query, requestAnimationFrame: fn => { callback = fn; }, samplePetSequence };
  const script = html.match(/<script>\s*__TIMING_HELPER__([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, context);
  return { document, window, query, get: id => document.getElementById(id), click: id => document.getElementById(id).onclick(),
    state: () => window.draftPreview.getState(), step(ms) { for(let t=0;t<ms;t+=20){now+=20;callback(now);} } };
}
test('draft loop advances actual frames and pause freezes root', () => {
  const l=lab();l.click('play');l.click('move');l.step(300);assert.equal(l.state().index,1);
  const moving=l.state().x;l.click('play');l.step(400);assert.equal(l.state().x,moving);
});
test('button-driven hold is globally escapable; landing sequence completes', () => {
  const l=lab();l.click('grab');l.step(300);assert.equal(l.state().state,'hold');
  l.document.emit('keydown',{key:'Escape'});assert.equal(l.state().state,'idle');
  l.click('grab');l.click('release');l.step(540);assert.equal(l.state().state,'landing');
  l.step(900);assert.equal(l.state().state,'idle');assert.equal(l.state().y,346);
});
test('draft reduced motion steps manually and never automatically falls', () => {
  const l=lab(true);l.click('play');l.step(400);assert.equal(l.state().index,1);assert.equal(l.state().playing,false);
  l.click('grab');l.click('release');assert.equal(l.state().state,'idle');assert.equal(l.state().y,346);
});
test('draft resize and pointer cancellation are safe resets', () => {
  const l=lab();const actor=l.get('actor');actor.emit('pointerdown',{button:0,pointerId:9,clientX:500,clientY:300});
  assert.equal(actor.capture,9);actor.emit('pointercancel',{pointerId:9});assert.equal(actor.capture,null);assert.equal(l.state().state,'idle');
  l.click('grab');l.window.emit('resize');assert.equal(l.state().state,'idle');
});
