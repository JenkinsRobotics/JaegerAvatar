"""The Mochi bundle a host vendors: the face, who the character is, and the parts that connect it to the agent."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / 'scripts')]
import build_embedded_mochi  # noqa: E402
from jaeger_avatar.embedded import Controller, RuntimeServer  # noqa: E402


class MochiBundleTest(unittest.TestCase):
    def test_the_bundle_carries_its_look_its_character_and_the_agent_connection(self):
        with tempfile.TemporaryDirectory() as tmp:
            bundle = build_embedded_mochi.build(Path(tmp) / 'mochi')
            manifest = json.loads((bundle / 'avatar_runtime/manifest.json').read_text())
            self.assertEqual(manifest['face'], 'mochi_wave')                                  # the pack's own choice: a voice line under the eyes, so speech shows
            self.assertEqual(manifest['character']['voice'], 'af_heart')                      # the voice this look was given, not the sheet's first idea
            self.assertTrue(manifest['character']['who'].startswith('You are Mochi, an AI character.'))
            self.assertEqual(manifest['activity']['listening'], 'listening')
            for part in ('agent_host.py', 'agent_loop.py', 'agent_tools.py', 'device.py', 'persona.py', 'public/kin/jp01.js'):
                self.assertTrue((bundle / 'avatar_runtime' / part).is_file(), part)
            page = (bundle / 'avatar_runtime/public/embedded.js').read_text()
            self.assertIn("get('face')", page)                                                # the page draws the face it is asked for
            server = RuntimeServer(bundle / 'avatar_runtime/public', Controller(manifest))
            self.addCleanup(server.close)
            self.assertTrue(server.url.endswith('&face=mochi_wave'))


if __name__ == '__main__':
    unittest.main()
