import unittest

from jaeger_avatar.embedded.control import Controller, ControlError

MANIFEST = {'avatar': 'jp01', 'capabilities': {'emotions': ['neutral', 'joy'], 'reactions': ['wink'], 'actions': ['wave']}}
SPEAK = {'clip': '/control/audio/a1', 'duration_ms': 1500, 'marks': [[0.1, 0.15, 'p']], 'text': 'Mom'}


class Clock:
    def __init__(self): self.now = 1000.0
    def __call__(self): return self.now


class ControllerTest(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.c = Controller(MANIFEST, clock=self.clock)

    def test_act_must_be_declared(self):
        s = self.c.send('act', 'wave')
        self.assertEqual(s['act'], 'wave')
        self.assertEqual(s['act_seq'], 1)
        with self.assertRaisesRegex(ControlError, 'Unknown action'):
            self.c.send('act', 'clap')

    def test_speak_sets_speaking_for_its_duration(self):
        s = self.c.send('speak', dict(SPEAK))
        self.assertIs(s['speaking'], True)
        self.assertEqual(s['speak_seq'], 1)
        self.assertEqual(s['speak']['clip'], '/control/audio/a1')
        self.clock.now = 2600
        self.assertIs(self.c.snapshot()['speaking'], False)
        self.assertIsNone(self.c.snapshot()['speak'])

    def test_speak_rejects_bad_values(self):
        bad = [dict(SPEAK, clip='http://evil/x.wav'), dict(SPEAK, duration_ms=0), dict(SPEAK, duration_ms=60001),
               dict(SPEAK, marks=[[0.5, 0.2, 'p']]), dict(SPEAK, marks=[[0.1, 0.2, 'x']]),
               dict(SPEAK, marks=[[0.1, 0.2, 'p']] * 401), dict(SPEAK, text='a' * 601),
               dict(SPEAK, marks=[[0.1, 2.0, 'p']]), 'not a dict']
        for v in bad:
            with self.subTest(v=str(v)[:60]), self.assertRaises(ControlError):
                self.c.send('speak', v)

    def test_stop_clears_act_and_speak(self):
        self.c.send('act', 'wave')
        self.c.send('speak', dict(SPEAK))
        s = self.c.send('stop')
        self.assertEqual(s['act'], '')
        self.assertIsNone(s['speak'])
        self.assertIs(s['speaking'], False)
        self.assertEqual(s['stop_seq'], 3)
        self.assertEqual(self.c.send('emotion', 'neutral')['stop_seq'], 3)   # going back to rest is not a stop


if __name__ == '__main__':
    unittest.main()
