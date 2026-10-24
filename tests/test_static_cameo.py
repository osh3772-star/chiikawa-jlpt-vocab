import unittest,json,tempfile,shutil
from pathlib import Path
from static_cameo import load_static_cameo
from evidence_registry import EvidenceContractError
ROOT=Path(__file__).resolve().parents[1]
class StaticCameoTests(unittest.TestCase):
    def test_one_pose_and_manual_upperbody_clip(self):
        a=load_static_cameo(ROOT,lambda p:'fixture')
        self.assertEqual(a['bodyPoseCount'],4);self.assertEqual(a['frames'][0]['sourceRect'],[245,99,972,915]);self.assertFalse(a['productionEnabled'])
        self.assertEqual(a['timingOrigin'],'AUTHORED_WEB_UX');self.assertEqual(a['frames'][0]['displayWidth'],120);self.assertFalse(a['loop'])
    def test_new_frames_timing_or_unreviewed_pixels_fail_closed(self):
        for field,value in [('bodyPoseCount',12),('timingOrigin','VIDEO_EXACT'),('windowSize',[900,900]),('enabledByDefault',True),('interpolation',True)]:
            with self.subTest(field=field),tempfile.TemporaryDirectory() as t:
                root=Path(t);folder=root/'chiikawa-pets/limited-previews';shutil.copytree(ROOT/'chiikawa-pets/limited-previews',folder)
                path=folder/'chiikawa-ep2-a.json';c=json.loads(path.read_text());c[field]=value;path.write_text(json.dumps(c))
                with self.assertRaises(EvidenceContractError):load_static_cameo(root,lambda p:'fixture')

    def test_reordered_or_changed_frame_fails_closed(self):
        for mode in ('order','hash','duration','crop'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as t:
                root=Path(t);folder=root/'chiikawa-pets/limited-previews';shutil.copytree(ROOT/'chiikawa-pets/limited-previews',folder)
                path=folder/'chiikawa-ep2-a.json';c=json.loads(path.read_text())
                if mode=='order':c['frames'].reverse()
                else:c['frames'][1][{'hash':'assetSha256','duration':'durationMs','crop':'sourceRect'}[mode]]={'hash':'changed','duration':1,'crop':[0,0,10,10]}[mode]
                path.write_text(json.dumps(c))
                with self.assertRaises(EvidenceContractError):load_static_cameo(root,lambda p:'fixture')
