import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeEvidenceRegistry, evidenceStatusLabel } from '../chiikawa-pets/evidence-registry.js';
const registry = JSON.parse(await readFile(new URL('../chiikawa-pets/evidence/validation-report.json', import.meta.url), 'utf8'));

test('readonly status shows candidates, never activated motion', () => {
  const result = summarizeEvidenceRegistry(registry);
  assert.equal(result.enabledCount, 0);
  assert.equal(result.candidateCount, registry.entries.length);
  assert.match(result.label, /활성 0/);
  assert.match(result.label, /승인 대기/);
});
test('forged enabled or runtime-supported data is rejected', () => {
  for (const mutation of [r => r.runtimeEnabled=true, r => r.activationSupported=true,
    r => r.entries[0].enabled=true, r => r.enabledCount=1, r => r.candidateCount=999]) {
    const data=structuredClone(registry);mutation(data);
    assert.throws(() => summarizeEvidenceRegistry(data), /activation is not implemented/);
  }
});
test('partial samples and still references never receive an approval label', () => {
  assert.match(evidenceStatusLabel('OBSERVED_PARTIAL'), /승인 아님/);
  assert.match(evidenceStatusLabel('VIDEO_SAMPLED_CONFIRMED'), /승인 아님/);
  assert.equal(evidenceStatusLabel('STILL_REFERENCE_ONLY'), '정지 외형 참고만');
  assert.match(evidenceStatusLabel('made-up'), /보류/);
});
test('absent registry is an inert status, not automatic fallback motion', () => {
  const result=summarizeEvidenceRegistry(null);
  assert.equal(result.enabledCount,0);assert.equal(result.entries.length,0);
});
test('authored layout proposals are counted separately from video candidates', () => {
  const result=summarizeEvidenceRegistry(registry);
  assert.equal(result.candidateCount,registry.entries.length);
  assert.equal(result.mappings.length,registry.mappingCount);
  assert.ok(result.mappings.every(mapping=>mapping.canonicalTrajectory===false));
  const forged=structuredClone(registry);forged.mappings[0].canonicalTrajectory=true;
  assert.throws(()=>summarizeEvidenceRegistry(forged));
});
