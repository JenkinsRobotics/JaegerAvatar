import unittest
from jaeger_avatar.catalog import catalog,ROOT
from jaeger_avatar.packs import load_pack
from jaeger_avatar.deploy import legacy_manifest

class MochiVariants(unittest.TestCase):
    def test_names_share_identity_and_preserve_defaults(self):
        pack=load_pack(ROOT/'mochi',verify_sources=True)
        self.assertEqual(pack['default_representation'],'mochi')
        self.assertEqual({r['name'] for r in pack['representations'].values()},
                         {'Mochi Classic','Mochi Enhanced','Mochi Live','Mochi Portrait','Mochi 3D'})
        row=next(p for p in catalog() if p['id']=='mochi')
        self.assertEqual(next(r for r in row['representations'] if r['id']=='classic')['name'],'Mochi Classic')
        for key in ['classic','mochi']:
            m=legacy_manifest(pack,key)
            self.assertEqual(m['character'],'mochi')
            self.assertEqual(len(m['expressions']),5)
            self.assertTrue(all(set(s['clips'])=={'primary','alternate'} for s in m['expressions'].values()))
        self.assertEqual(load_pack(ROOT/'momo')['avatar'],'momo')
