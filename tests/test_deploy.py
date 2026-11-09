import json
from pathlib import Path
import tempfile
import unittest
import yaml
from jaeger_avatar.deploy import build, verify, PackError

class DeploymentTests(unittest.TestCase):
    def fixture(self, root):
        folder=root/'sample';folder.mkdir(parents=True)
        (folder/'face.png').write_bytes(b'fixture')
        data={'schema':'avatar/v1','avatar':'sample','name':'Sample','version':'0.1.0',
              'profiles':{},'default_profile':None,'default_representation':'face','sources':{},
              'representations':{'face':{'format':'character/v1','root':'.','presentation':{
                  'kind':'clip_set','render':{'adapter':'image','asset':'face.png'},
                  'expressions':{'idle':{'clips':{'closed':'face.png'}}},
                  'default_expression':'idle','default_mouth':'closed'}}}}
        (folder/'avatar.yaml').write_text(yaml.safe_dump(data));return folder,data

    def test_portable_after_source_removed_and_tamper_detection(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);folder,_=self.fixture(base/'source')
            report=build(base/'source',base/'out')
            folder.rename(base/'moved-source')
            self.assertGreater(verify(base/'out'),0)
            exported=base/'out/mochi-character-v1/sample--face/character.yaml'
            self.assertEqual(yaml.safe_load(exported.read_text())['default_mouth'],'closed')
            self.assertFalse(report['packs'][0]['hardware_verified'])
            exported.write_text('tampered')
            with self.assertRaises(PackError):verify(base/'out')

    def test_missing_nested_clip_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);folder,data=self.fixture(base/'source')
            data['representations']['face']['presentation']['expressions']['idle']['clips']['open']='missing.png'
            (folder/'avatar.yaml').write_text(yaml.safe_dump(data))
            with self.assertRaises(PackError):build(base/'source',base/'out')
            self.assertFalse((base/'out').exists())

    def test_export_refuses_links_and_existing_destination(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);folder,_=self.fixture(base/'source')
            (folder/'link').symlink_to(folder/'face.png')
            with self.assertRaises(PackError):build(base/'source',base/'out')
            (folder/'link').unlink();(base/'out').mkdir()
            with self.assertRaises(PackError):build(base/'source',base/'out')
