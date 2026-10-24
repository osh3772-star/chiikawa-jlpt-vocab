import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from evidence_registry import compile_registry, load_motion_registry, EvidenceContractError


def inputs():
    index = json.loads((ROOT / 'chiikawa-pets/evidence/registry.json').read_text())
    docs = {item['logicalPath']: json.loads((ROOT / item['snapshotPath']).read_text()) for item in index['inputs']}
    return docs[index['contractPath']], docs[index['designPath']], docs


class EvidenceRegistryTests(unittest.TestCase):
    def setUp(self):
        self.contract, self.design, self.ledgers = inputs()

    def compile(self):
        return compile_registry(self.contract, self.design, self.ledgers)

    def test_current_candidates_are_all_disabled_and_unapproved(self):
        result = load_motion_registry(ROOT)
        self.assertEqual(result['candidateCount'], len(self.contract['entries']))
        self.assertEqual(result['enabledCount'], 0)
        self.assertFalse(result['activationSupported'])
        self.assertFalse(result['runtimeEnabled'])
        self.assertTrue(all(e['enabled'] is False for e in result['entries']))
        self.assertEqual(set(result['characters']), {'chiikawa','hachiware','usagi','momonga','rakko','shisa'})

    def test_sampled_airborne_pose_does_not_approve_flight(self):
        entry = next(e for e in self.compile()['entries'] if e['actionId'] == 'momonga.video_airborne_spread')
        self.assertEqual(entry['evidenceStatus'], 'VIDEO_SAMPLED_CONFIRMED')
        self.assertIn('design-fragment-not-approved', entry['blockingReasons'])
        self.assertIn('asset-review-binding-not-implemented', entry['blockingReasons'])
        self.assertFalse(entry['enabled'])

    def test_limited_preview_scope_cannot_approve_original_motion(self):
        mapping = self.contract['mapping_entries'][0]
        self.assertTrue(self.compile()['mappings'][0]['previewTestingAuthorized'])
        mapping['art_scope'] = 'FULL_ANIMATION'
        with self.assertRaisesRegex(EvidenceContractError, 'Incomplete limited-preview'):
            self.compile()

    def test_preview_authorization_must_bind_matching_review(self):
        self.contract['mapping_entries'][0]['review_id'] = 'different-art'
        with self.assertRaisesRegex(EvidenceContractError, 'art review does not match'):
            self.compile()

    def test_player_readings_never_become_animation_timing(self):
        result = json.dumps(self.compile())
        for key in ('durationMs', 'keyframes', 'fps', 'pre_image_timestamps_seconds'):
            self.assertNotIn(key, result)

    def test_no_asset_guessing_or_legacy_beta_alias(self):
        self.contract['entries'][0]['asset_manifest'] = 'chiikawa-pets/draft-preview/config.json'
        entry = self.compile()['entries'][0]
        self.assertIn('asset-review-binding-not-implemented', entry['blockingReasons'])
        self.assertFalse(entry['enabled'])

    def test_enabled_flag_cannot_bypass_missing_reviews(self):
        entry = self.contract['entries'][0]
        entry.update(enabled=True, evidence_approval='APPROVED_VIDEO_FRAGMENT', design_approval='APPROVED_FRAGMENT', art_validation='PASS')
        with self.assertRaisesRegex(EvidenceContractError, 'activation'):
            self.compile()

    def test_runtime_switch_is_not_a_hidden_activation_backdoor(self):
        with self.assertRaisesRegex(EvidenceContractError, 'Runtime activation'):
            compile_registry(self.contract, self.design, self.ledgers, True)

    def test_still_reference_cannot_become_action(self):
        self.contract['non_actions'][0]['enabled'] = True
        with self.assertRaisesRegex(EvidenceContractError, 'Still references'):
            self.compile()

    def test_hold_cannot_become_action(self):
        self.contract['holds'][0]['enabled'] = True
        with self.assertRaises(EvidenceContractError):
            self.compile()

    def test_source_url_window_and_design_id_must_match(self):
        original = copy.deepcopy(self.contract)
        mutations = [
            lambda e: e['observation_ref'].update(url='https://example.org/unrelated'),
            lambda e: e['observation_ref'].update(window_index=99),
            lambda e: e.update(design_ref='characters[usagi].candidate_actions[usagi.video_circle]'),
            lambda e: e.update(character_id='usagi'),
            lambda e: e.update(evidence_status='STILL_REFERENCE_ONLY'),
        ]
        for mutate in mutations:
            self.contract = copy.deepcopy(original)
            mutate(self.contract['entries'][0])
            with self.assertRaises(EvidenceContractError):
                self.compile()

    def test_unknown_duplicate_and_archived_candidates_rejected(self):
        original = copy.deepcopy(self.contract)
        self.contract['entries'].append(copy.deepcopy(self.contract['entries'][0]))
        with self.assertRaises(EvidenceContractError):
            self.compile()
        self.contract = original
        self.design['version'] = self.contract['design_version'] = '1.0-personality'
        with self.assertRaisesRegex(EvidenceContractError, 'Archived'):
            self.compile()

    def test_escaped_manifest_path_is_rejected_even_while_disabled(self):
        self.contract['entries'][0]['asset_manifest'] = '../unrelated-secret.json'
        with self.assertRaisesRegex(EvidenceContractError, 'Unsafe'):
            self.compile()

    def test_reacquire_time_remains_blocked(self):
        entries = [e for e in self.compile()['entries'] if e['evidenceStatus'] == 'REACQUIRE_TIME']
        self.assertTrue(entries)
        self.assertTrue(all('source-window-unresolved' in e['blockingReasons'] for e in entries))

    def test_changed_snapshot_requires_resync_not_silent_reapproval(self):
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / 'chiikawa-pets/evidence'
            shutil.copytree(ROOT / 'chiikawa-pets/evidence', destination)
            index = json.loads((destination / 'registry.json').read_text())
            file = Path(temp) / index['inputs'][0]['snapshotPath']
            file.write_text(file.read_text() + '\n')
            with self.assertRaisesRegex(EvidenceContractError, 'snapshot changed'):
                load_motion_registry(temp)


class AuthoredLayoutRegistryTests(unittest.TestCase):
    def setUp(self):
        self.contract, self.design, self.ledgers = inputs()

    def compile(self):
        return compile_registry(self.contract, self.design, self.ledgers)
    def test_mapping_is_not_added_to_video_action_count(self):
        result = self.compile()
        self.assertEqual(result['mappingCount'], len(self.contract['mapping_entries']))
        self.assertEqual(result['candidateCount'], len(self.contract['entries']))
        self.assertTrue(all(not mapping['enabled'] and not mapping['canonicalTrajectory'] for mapping in result['mappings']))

    def test_mapping_cannot_claim_other_body_or_source_window(self):
        original = copy.deepcopy(self.contract)
        for field, value in [('body_action_ref', 'chiikawa.video_turn'), ('enabled', True)]:
            self.contract = copy.deepcopy(original)
            self.contract['mapping_entries'][0][field] = value
            with self.assertRaises(EvidenceContractError):
                self.compile()
        self.contract = copy.deepcopy(original)
        self.contract['mapping_entries'][0]['body_observation_ref']['window_index'] = 0
        with self.assertRaises(EvidenceContractError):
            self.compile()


if __name__ == '__main__':
    unittest.main()
