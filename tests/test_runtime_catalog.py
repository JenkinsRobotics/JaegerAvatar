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
        rows=catalog();self.assertEqual(len(rows),56)
        live=[(p,r) for p in rows for r in p['representations'] if r['status']=='Live rig']
        # Every pack has a rig; the original demo rigs are the featured tabs, the rest live in the library.
        self.assertEqual({p['id'] for p,r in live},{p['id'] for p in rows})
        featured=[(p,r) for p,r in live if not r['defaults'].get('library')]
        self.assertEqual(len(featured),14)
        self.assertEqual({p['id'] for p,r in featured},{'vita','mochi','vee','nori','ace','sol','pip','bo','rook','maya','momo','aster','jp01'})
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


class PersonaPromptTest(unittest.TestCase):
    def test_profile_reaches_the_agent_with_its_own_name_and_voice(self):
        from jaeger_avatar.catalog import persona
        name, text = persona('bender')
        self.assertEqual(name, 'Bender')   # the character's name, not the pack's
        for part in ('bending-unit', 'Your voice: gravelly', 'How you talk:', 'Style:'):
            self.assertIn(part, text)


    def test_controls_are_validated(self):
        """A pack names the controls an agent may drive; anything but three lists of names is refused."""
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp).resolve(); folder = tmp / 'jp01'
            shutil.copytree(ROOT / 'jp01', folder)
            data = yaml.safe_load((folder / 'avatar.yaml').read_text())
            rep = data['representations'][data['default_representation']]
            for bad in ({'actions': ['wave', 'Bad Name']}, {'actions': ['wave', 'wave']}, {'moves': ['wave']}, {'actions': 'wave'}):
                rep['presentation']['controls'] = bad
                (folder / 'avatar.yaml').write_text(yaml.safe_dump(data))
                with self.subTest(bad=bad), self.assertRaisesRegex(PackError, 'controls lists names'):
                    load_pack(folder)
            rep['presentation']['controls'] = {'actions': ['wave', 'nod']}
            (folder / 'avatar.yaml').write_text(yaml.safe_dump(data))
            row = catalog(tmp)[0]
            entry = next(r for r in row['representations'] if r['id'] == data['default_representation'])
            self.assertEqual(entry['controls'], {'actions': ['wave', 'nod']})
            self.assertTrue(all('controls' not in r for r in row['representations'] if r['id'] != entry['id']))

    def test_expression_sounds_are_the_characters_own_text_lines(self):
        """The pack carries what to say; the host's voice engine (Kokoro) says it in the pack's voice."""
        packs = {p['id']: p for p in catalog()}
        for pack in ('bender', 'vita', 'mochi', 'jp01'):
            sounds = next(x for x in packs[pack]['profiles'] if x['id'] == packs[pack]['defaultProfile'])['character']['performance']['sounds']
            self.assertTrue({'joy', 'angry', 'love', 'wink'} <= set(sounds), pack)
        self.assertNotEqual(next(x for x in packs['bender']['profiles'])['character']['performance']['sounds']['love'],
                            packs['vita']['profiles'][0]['character']['performance']['sounds']['love'])
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / 'bad'; folder.mkdir()
            data = yaml.safe_load((ROOT / 'jp01' / 'avatar.yaml').read_text())
            data['profiles']['jp01']['character']['performance'] = {'sounds': {'joy': {'engine': 'kokoro'}}}
            data['representations'] = {}; data['default_representation'] = None; data['sources'] = {}
            for prof in data['profiles'].values(): prof.pop('card', None); prof.pop('source', None)
            (folder / 'avatar.yaml').write_text(yaml.safe_dump(data))
            with self.assertRaises(PackError):
                load_pack(folder)
