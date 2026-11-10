import unittest

from jaeger_avatar.embedded.control import ControlError
from jaeger_avatar.embedded.link import ControlLink

JP01 = {'avatar': 'jp01', 'capabilities': {'emotions': ['neutral', 'joy'], 'reactions': ['wink'], 'actions': []}}
TRUTH = {'avatar': 'truth', 'capabilities': {'emotions': ['neutral', 'joy'], 'reactions': [], 'actions': ['clap']}}


class Clock:
    def __init__(self): self.now = 1000.0
    def __call__(self): return self.now


class ControlLinkTest(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.link = ControlLink('T', clock=self.clock)

    def test_commands_need_the_token_and_a_page(self):
        with self.assertRaisesRegex(ControlError, 'No avatar attached'):
            self.link.command({'op': 'emotion', 'value': 'joy'}, 'T')
        s = self.link.attach(JP01)['session']
        self.link.state(s)
        with self.assertRaisesRegex(ControlError, 'Not allowed'):
            self.link.command({'op': 'emotion', 'value': 'joy'}, 'wrong')
        self.assertEqual(self.link.command({'op': 'emotion', 'value': 'joy'}, 'T')['emotion'], 'joy')
        self.assertIs(self.link.state(s)['attached'], True)

    def test_page_gone_means_not_attached(self):
        self.link.state(self.link.attach(JP01)['session'])
        self.clock.now += 2001
        with self.assertRaisesRegex(ControlError, 'No avatar attached'):
            self.link.command({'op': 'emotion', 'value': 'joy'}, 'T')

    def test_reattach_starts_a_new_session(self):
        a = self.link.attach(JP01)['session']
        self.link.state(a)
        with self.assertRaisesRegex(ControlError, 'Unknown action'):
            self.link.command({'op': 'act', 'value': 'clap'}, 'T')
        b = self.link.attach(TRUTH)['session']
        self.assertNotEqual(a, b)
        self.link.state(b)
        self.assertEqual(self.link.command({'op': 'act', 'value': 'clap'}, 'T')['act'], 'clap')

    def test_bad_bodies_are_refused(self):
        for bad in (None, {'avatar': 'x'}, {'avatar': 'x', 'capabilities': {'emotions': 'joy'}}):
            with self.subTest(bad=bad), self.assertRaises(ControlError):
                self.link.attach(bad)
        self.link.state(self.link.attach(JP01)['session'])
        for bad in (None, {'op': 'emotion'}, {'op': 'emotion', 'value': 'joy', 'ttl_ms': 'x'}, {'op': 'emotion', 'value': 'joy', 'seq': 9}):
            with self.subTest(bad=bad), self.assertRaises(ControlError):
                self.link.command(bad, 'T')

    def test_only_the_newest_page_follows(self):
        old = self.link.attach(JP01)['session']
        new = self.link.attach(JP01)['session']
        self.assertEqual(self.link.state(old), {'attached': False, 'taken': True})   # an older tab stands aside
        self.assertIs(self.link.state(new)['attached'], True)
        self.clock.now += 1500
        self.link.state(old); self.link.state()                                       # neither keeps the newest page alive
        self.clock.now += 600
        with self.assertRaisesRegex(ControlError, 'No avatar attached'):
            self.link.command({'op': 'emotion', 'value': 'joy'}, 'T')
        self.assertEqual(self.link.state(old), {'attached': False})                   # it's gone, so the older tab may attach again

    def test_audio_store_is_bounded(self):
        with self.assertRaisesRegex(ControlError, 'Not allowed'):
            self.link.put_audio(b'RIFF', 'wrong')
        clips = [self.link.put_audio(b'RIFF%d' % i, 'T') for i in range(17)]
        self.assertTrue(all(c.startswith('/control/audio/') and len(c) == len('/control/audio/') + 12 for c in clips))
        self.assertIsNone(self.link.audio(clips[0].rsplit('/', 1)[1]))
        self.assertEqual(self.link.audio(clips[16].rsplit('/', 1)[1]), b'RIFF16')
        with self.assertRaises(ControlError):
            self.link.put_audio(b'x' * (10 * 1024 * 1024 + 1), 'T')


if __name__ == '__main__':
    unittest.main()
