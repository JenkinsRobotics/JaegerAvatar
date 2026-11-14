"""The face for a robot's own panel as a program with no browser: commands in, the panel's pixels out."""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from jaeger_avatar.embedded import Controller
from jaeger_avatar.embedded.panel import Panel

MANIFEST = {'avatar': 'jp01', 'capabilities': {'emotions': ['neutral', 'love'], 'reactions': ['blink']}}


@unittest.skipUnless(shutil.which('node'), 'the face program runs on Node')
class PanelTest(unittest.TestCase):
    def test_commands_go_in_and_the_panels_pixels_come_out(self):
        controller = Controller(MANIFEST)
        panel = Panel(controller, fps=60)
        self.addCleanup(panel.close)
        frames = panel.frames()
        first, second = next(frames), next(frames)
        self.assertEqual([(w, h, len(rgb)) for w, h, _, rgb in (first, second)], [(64, 64, 64 * 64 * 3), (24, 1, 24 * 3)])   # the face, then the ring, every tick
        controller.send('emotion', 'love', 30000)
        began, pink = time.time(), False
        for w, h, number, rgb in frames:                              # the eyes turn love's pink, even as it wakes
            if h == 64 and bytes([255, 163, 193]) in rgb: pink = True; break
            if time.time() - began > 8: break
        self.assertTrue(pink, 'the feeling never reached the panel')
        self.assertGreater(number, 2)                                 # frames kept coming, numbered in order
        panel.close()
        self.assertIsNotNone(panel.process.poll())                    # the program ends with its host

    def test_a_face_with_no_panel_look_fails_at_the_start(self):
        with self.assertRaises(RuntimeError) as failed:
            panel = Panel(Controller(MANIFEST), face='mochi_lips')
            self.addCleanup(panel.close)
            next(panel.frames())
        self.assertIn('no look made for the panel', str(failed.exception))


@unittest.skipUnless(shutil.which('node'), 'the face program runs on Node')
class PanelBundleTest(unittest.TestCase):
    """One avatar's panel face as a folder a robot can take: it runs with nothing else from this repository."""

    def test_the_jp01_bundle_runs_on_its_own(self):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
        import build_panel_runtime
        with tempfile.TemporaryDirectory() as tmp:
            bundle = build_panel_runtime.build(Path(tmp) / 'jp01-panel')
            manifest = json.loads((bundle / 'avatar_runtime/manifest.json').read_text())
            self.assertEqual((manifest['avatar'], manifest['face'], manifest['control_schema']), ('jp01', 'mochi_wave', 'avatar-control/v1'))
            self.assertEqual(manifest['outputs'], [{'id': 'face', 'width': 64, 'height': 64, 'format': 'rgb8'}, {'id': 'ring', 'width': 24, 'height': 1, 'format': 'rgb8'}])
            self.assertEqual(len(manifest['capabilities']['emotions']), 16)
            self.assertIn('wake', manifest['capabilities']['reactions'])
            for name, digest in json.loads((bundle / 'SHA256SUMS.json').read_text()).items():   # every file is listed with its checksum
                self.assertEqual(hashlib.sha256((bundle / name).read_bytes()).hexdigest(), digest, name)
            self.assertFalse(list(bundle.rglob('three*')) + list(bundle.rglob('*.html')), 'no browser parts travel with it')
            # A host's use of it, from the bundle's own folder with this repository out of reach.
            host = ('import json, sys; sys.path.insert(0, "."); from avatar_runtime import Controller; from avatar_runtime.panel import Panel\n'
                    'manifest = json.load(open("avatar_runtime/manifest.json")); controller = Controller(manifest); panel = Panel(controller, face=manifest["face"])\n'
                    'controller.send("reaction", "sparkle"); frames = panel.frames(); print([next(frames)[:2] for _ in range(4)], panel.process.args[1]); panel.close()')
            ran = subprocess.run([sys.executable, '-c', host], cwd=bundle, capture_output=True, text=True, timeout=30, env={'PATH': os.environ['PATH']})
            self.assertEqual(ran.returncode, 0, ran.stderr)
            self.assertIn('[(64, 64), (24, 1), (64, 64), (24, 1)]', ran.stdout)
            self.assertIn('jp01-panel/avatar_runtime/panel/kin/panel-run.mjs', ran.stdout, 'it ran its own copy of the face program')
            with self.assertRaises(ValueError): build_panel_runtime.build(bundle)                 # a built bundle is never written over
            with self.assertRaises(ValueError): build_panel_runtime.build(Path(tmp) / 'x', avatar='jp01_ring')   # a face with no panel look is not exported


if __name__ == '__main__':
    unittest.main()
