import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pickPetBehavior } from '../chiikawa-pets/pet-engine.js';

const config = JSON.parse(await readFile(new URL('../chiikawa-pets/behavior-config.json', import.meta.url), 'utf8'));
for (const [character, weights] of Object.entries(config.characters)) {
  test(`${character}: configured percentage distribution`, () => {
    // Midpoints of 10,000 equally spaced samples give exact counts for integer
    // percentages, without a flaky random tolerance or timing dependency.
    const counts = Object.fromEntries(Object.keys(weights).map(action => [action, 0]));
    for (let i = 0; i < 10000; i++) counts[pickPetBehavior(weights, () => (i + .5) / 10000)]++;
    for (const [action, probability] of Object.entries(weights)) assert.equal(counts[action], probability * 100);
  });
}
test('boundaries and zero-probability actions', () => {
  const weights = { disabled: 0, idle: 25, walk: 75 };
  assert.equal(pickPetBehavior(weights, () => 0), 'idle');
  assert.equal(pickPetBehavior(weights, () => .249999), 'idle');
  assert.equal(pickPetBehavior(weights, () => .25), 'walk');
  assert.equal(pickPetBehavior(weights, () => .999999), 'walk');
});
test('invalid configuration and RNG are rejected', () => {
  for (const weights of [{}, { idle: 99 }, { idle: -1, walk: 101 }, { idle: NaN }, { idle: Infinity }]) {
    assert.throws(() => pickPetBehavior(weights));
  }
  for (const value of [-.1, 1, NaN, Infinity]) assert.throws(() => pickPetBehavior({ idle: 100 }, () => value));
});
