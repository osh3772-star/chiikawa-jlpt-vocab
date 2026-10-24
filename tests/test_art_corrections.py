import unittest
from pathlib import Path
from art_corrections import load_usagi_prop_correction,apply_usagi_prop_correction
class CorrectionTests(unittest.TestCase):
    def test_exact_reviewed_static_asset_and_legacy_key_keep_probability_off(self):
        c=load_usagi_prop_correction(Path(__file__).resolve().parents[1],lambda p:str(p))
        sprites={'usagi':{'idle':'idle','sasumata':'idle'}}
        profiles={'usagi':{'behavior':{'idle':100},'poseAliases':{'sasumata':'idle'},'quarantinedArt':{'sasumata':{'reason':'wrong original prop','fallback':'idle'}}}}
        apply_usagi_prop_correction(c,sprites,profiles)
        self.assertNotEqual(sprites['usagi']['sasumata'],'idle')
        self.assertNotIn('sasumata',profiles['usagi']['behavior'])
        self.assertNotIn('sasumata',profiles['usagi']['poseAliases'])
        self.assertEqual(profiles['usagi']['quarantinedArt']['sasumata']['reason'],'wrong original prop')
    def test_static_repair_cannot_restore_autonomous_action(self):
        with self.assertRaises(ValueError):
            apply_usagi_prop_correction({'source':'new'}, {'usagi':{}}, {'usagi':{'behavior':{'sasumata':5}}})
    def test_static_scope_and_motion_permission_cannot_be_silently_widened(self):
        import json,tempfile
        source=Path(__file__).resolve().parents[1]/'chiikawa-pets/art-corrections/usagi-rod.json'
        original=json.loads(source.read_text())
        for field,value in [('autonomousActivation',True),('motionActivation',True),('reviewScope','FULL_MOTION_APPROVED'),('assetSha256','0'*64)]:
            with self.subTest(field=field),tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);p=root/'chiikawa-pets/art-corrections/usagi-rod.json';p.parent.mkdir(parents=True)
                p.write_text(json.dumps({**original,field:value}))
                with self.assertRaises(ValueError):load_usagi_prop_correction(root,str)

    def test_chiikawa_exact_static_color_repair_does_not_restore_behavior(self):
        from art_corrections import load_chiikawa_prop_correction,apply_chiikawa_prop_correction
        c=load_chiikawa_prop_correction(Path(__file__).resolve().parents[1],str)
        sprites={'chiikawa':{'idle':'idle','sasumata':'idle'}}
        profiles={'chiikawa':{'behavior':{'idle':100},'poseAliases':{'sasumata':'idle'},'quarantinedArt':{'sasumata':{'reason':'blue default prop mismatch'}}}}
        apply_chiikawa_prop_correction(c,sprites,profiles)
        self.assertNotEqual(sprites['chiikawa']['sasumata'],'idle')
        self.assertEqual(profiles['chiikawa']['behavior'],{'idle':100})
        self.assertEqual(profiles['chiikawa']['quarantinedArt']['sasumata']['reason'],'blue default prop mismatch')
