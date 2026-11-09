from copy import deepcopy
from pathlib import Path
import tempfile
import unittest
import yaml

from jaeger_avatar.catalog import catalog, persona, ROOT
from jaeger_avatar.packs import load_pack, PackError


class RuntimeCatalogTests(unittest.TestCase):
    def test_incomplete_pack_does_not_blank_catalog(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); folder=root/'unfinished'; folder.mkdir()
            (folder/'avatar.yaml').write_text('schema: wrong\navatar: unfinished\n')
            rows=catalog(root)
            self.assertEqual(rows[0]['id'],'unfinished')
            self.assertTrue(rows[0]['error'])
            self.assertEqual(rows[0]['representations'],[])
    def test_live_characters_and_existing_library_coexist(self):
        rows=catalog();self.assertEqual(len(rows),51)
        live=[(p,r) for p in rows for r in p['representations'] if r['status']=='Live rig']
        # Every pack has a rig; the original demo rigs are the featured tabs, the rest live in the library.
        self.assertEqual({p['id'] for p,r in live},{p['id'] for p in rows})
        featured=[(p,r) for p,r in live if not r['defaults'].get('library')]
        self.assertEqual(len(featured),13)
        self.assertEqual({p['id'] for p,r in featured},{'vita','mochi','vee','nori','ace','sol','pip','bo','rook','maya','momo','aster'})
        mochi=next(p for p in rows if p['id']=='mochi')
        self.assertEqual(mochi['defaultProfile'],'jaeger_ai')
        self.assertEqual(mochi['defaultRepresentation'],'mochi')
        clanker=next(p for p in rows if p['id']=='clanker')
        self.assertTrue(any(r['supported'] and r['status']=='Portrait' for r in clanker['representations']))
        self.assertTrue(any(r['status']=='Source only · renderer not available' for p in rows for r in p['representations']))

    def test_models_are_pack_local_and_original_personas_are_separate(self):
        vita=next(p for p in catalog() if p['id']=='vita')
        self.assertEqual(len(vita['representations']),2)
        self.assertEqual(vita['representations'][0]['asset'],vita['representations'][1]['asset'])
        name,text=persona('vita');self.assertEqual(name,'Vita');self.assertIn('Vita',text)
        with self.assertRaises(PackError):persona('../app')

    def test_native_rig_cannot_name_arbitrary_executable_adapter(self):
        p=deepcopy(load_pack(ROOT/'momo'));p['sources']={}
        p['profiles']['kin_demo'].pop('source')
        r=p['representations']['kin_demo'];r.pop('source');r['root']='.'
        with tempfile.TemporaryDirectory() as d:
            folder=Path(d)
            for adapter,preset in [('python','run.py'),('nori-3d','unknown')]:
                r['presentation']['render']={'adapter':adapter,'preset':preset}
                (folder/'avatar.yaml').write_text(yaml.safe_dump(p))
                with self.assertRaises(PackError):load_pack(folder)
