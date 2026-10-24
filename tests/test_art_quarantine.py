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
