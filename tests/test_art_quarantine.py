import unittest
from art_quarantine import apply_art_quarantine,QUARANTINED_MOMONGA
class ArtQuarantineTests(unittest.TestCase):
    def test_damaged_pixels_never_survive_runtime_aliases(self):
        frames={'idle':'intact','happy':'happy',**{k:'damaged-'+k for k in QUARANTINED_MOMONGA}}
        sprites={'momonga':frames,'shisa':{'idle':'unchanged'}};profiles={'momonga':{}}
        apply_art_quarantine(sprites,profiles)
        self.assertTrue(all(frames[k]=='intact' for k in QUARANTINED_MOMONGA))
        self.assertEqual(frames['happy'],'happy');self.assertEqual(sprites['shisa']['idle'],'unchanged')
        self.assertEqual(set(profiles['momonga']['quarantinedArt']),set(QUARANTINED_MOMONGA))
    def test_no_missing_idle_guess(self):
        with self.assertRaises(ValueError):apply_art_quarantine({'momonga':{'grabbed':'bad'}},{'momonga':{}})

    def test_usagi_wrong_weapon_is_never_shown_or_selected(self):
        sprites={'usagi':{'idle':'safe-idle','sasumata':'wrong-blue-y-weapon','happy':'safe-happy'}}
        profiles={'usagi':{'frames':{'idle':'idle.png','sasumata':'sasumata.png'},'behavior':{'idle':10,'sasumata':5,'happy':85}}}
        apply_art_quarantine(sprites,profiles)
        self.assertEqual(sprites['usagi']['sasumata'],'safe-idle');self.assertEqual(profiles['usagi']['frames']['sasumata'],'idle.png')
        self.assertNotIn('sasumata',profiles['usagi']['behavior']);self.assertEqual(profiles['usagi']['behavior']['idle'],15)
        self.assertEqual(sum(profiles['usagi']['behavior'].values()),100);self.assertEqual(sprites['usagi']['happy'],'safe-happy')
    def test_builder_applies_quarantine_after_refresh_and_behavior_selection(self):
        from pathlib import Path
        code=(Path(__file__).resolve().parents[1]/'build_html.py').read_text()
        self.assertGreater(code.index('apply_art_quarantine(sprites, profiles)'),code.index("profiles[who]['behavior'] = dict(weights)"))

    def test_chiikawa_default_prop_color_quarantined_hachiware_untouched(self):
        sprites={who:{'idle':who+'-idle','sasumata':who+'-blue-fork'} for who in ('chiikawa','hachiware')}
        profiles={who:{'behavior':{'idle':90,'sasumata':10}} for who in sprites}
        apply_art_quarantine(sprites,profiles)
        self.assertEqual(sprites['chiikawa']['sasumata'],'chiikawa-idle')
        self.assertEqual(profiles['chiikawa']['behavior'],{'idle':100})
        self.assertEqual(sprites['hachiware']['sasumata'],'hachiware-blue-fork')
        self.assertEqual(profiles['hachiware']['behavior']['sasumata'],10)

    def test_built_runtime_has_no_wrong_default_weapon_but_preserves_hachiware(self):
        import json,re
        from pathlib import Path
        html=(Path(__file__).resolve().parents[1]/'단어장.html').read_text()
        def embedded(id):
            return json.loads(re.search(r'<script[^>]*id=[\"\']'+id+r'[\"\'][^>]*>(.*?)</script>',html,re.S).group(1))
        sprites,profiles=embedded('pet-sprites'),embedded('pet-profiles')
        self.assertNotEqual(sprites['chiikawa']['sasumata'],sprites['chiikawa']['idle'])
        self.assertNotEqual(sprites['usagi']['sasumata'],sprites['usagi']['idle'])
        self.assertEqual(profiles['usagi']['staticArtCorrections']['sasumata']['scope'],'STATIC_PROP_IDENTITY_REPAIR_ONLY')
        for who in ('chiikawa','usagi'):
            self.assertNotIn('sasumata',profiles[who]['behavior'])
        self.assertNotEqual(sprites['hachiware']['sasumata'],sprites['hachiware']['idle'])
        self.assertGreater(profiles['hachiware']['behavior']['sasumata'],0)
