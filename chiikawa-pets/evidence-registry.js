/** Read-only status helpers. No trigger, timing, renderer or motion fallback. */
export function summarizeEvidenceRegistry(registry) {
  if (!registry) return { candidateCount: 0, enabledCount: 0, label: '영상 근거 동작: 검수 자료 미연결', entries: [], mappings: [] };
  if (registry.schemaVersion !== 1 || registry.runtimeEnabled !== false || registry.activationSupported !== false ||
      !Array.isArray(registry.entries) || registry.entries.some(entry => entry.enabled !== false) ||
      registry.enabledCount !== 0 || registry.candidateCount !== registry.entries.length ||
      (registry.mappings ?? []).some(mapping => mapping.enabled !== false || mapping.canonicalTrajectory !== false) ||
      (registry.mappingEnabledCount ?? 0) !== 0 || (registry.mappingCount ?? 0) !== (registry.mappings ?? []).length) {
    throw new TypeError('Evidence status must be a disabled, validated registry; activation is not implemented.');
  }
  return { candidateCount: registry.entries.length, enabledCount: 0,
    label: `영상 근거 동작: 활성 0 · 검토 후보 ${registry.entries.length} · 웹 배치안 ${registry.mappingCount ?? 0} · 원화/승인 대기`,
    entries: registry.entries.map(entry => ({ actionId: entry.actionId, title: entry.title,
      evidenceStatus: entry.evidenceStatus, source: entry.observationRef?.url,
      blockers: [...(entry.blockingReasons ?? [])] })),
    mappings: (registry.mappings ?? []).map(mapping => ({ mappingId: mapping.mappingId, title: mapping.title, previewTestingAuthorized: mapping.previewTestingAuthorized === true, canonicalTrajectory: false })) };
}
export function evidenceStatusLabel(status) {
  return ({ OBSERVED_PARTIAL: '영상 일부 관찰 · 동작 승인 아님',
    VIDEO_SAMPLED_CONFIRMED: '영상 표본 확인 · 연속 재현 승인 아님',
    VIDEO_SAMPLED_ACTION_FRAGMENT: '영상 본동작 조각 관찰 · 승인 대기',
    REACQUIRE_TIME: '영상 구간 재확인 필요', STILL_REFERENCE_ONLY: '정지 외형 참고만',
    HOLD_VIDEO_REQUIRED: '영상 근거 없음 · 보류' })[status] ?? '미확인 · 보류';
}
