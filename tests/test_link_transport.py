"""The control link as the way the agent's avatar tool reaches the body on stage: send(op, value, ttl_ms).

The avatar and scene tools themselves are Jaeger Agent's, and are tested there (jaeger-module-agent, tests/test_body_tools.py).
"""
import unittest

from jaeger_avatar.embedded.link import ControlLink, link_transport

TRUTH = {'avatar': 'truth', 'capabilities': {'emotions': ['neutral', 'joy'], 'reactions': ['wink'], 'actions': ['clap']}}


class Clock:
    def __init__(self): self.now = 1000.0
    def __call__(self): return self.now


class LinkTransportTest(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.link = ControlLink('T', clock=self.clock)
        self.send = link_transport(self.link, 'T')

    def test_nobody_on_stage_is_said_plainly(self):
        self.assertEqual(self.send('offers', None, 0)['ok'], False)                 # nothing to check a scene's moves against
        refused = self.send('emotion', 'joy', 10000)
        self.assertEqual((refused['ok'], refused['error']), (False, 'No avatar attached'))

    def test_the_link_says_what_the_attached_body_offers(self):
        self.link.attach(TRUTH)
        self.assertEqual(self.send('offers', None, 0), {'ok': True, 'offers': TRUTH['capabilities']})

    def test_a_move_reaches_the_body_and_is_held_and_a_refusal_says_what_it_offers(self):
        session = self.link.attach(TRUTH)['session']
        self.assertEqual(self.send('emotion', 'joy', 10000), {'ok': True})
        self.clock.now += 9000
        self.assertEqual(self.link.state(session)['emotion'], 'joy')
        self.assertEqual(self.send('gaze', [-1, 1], 10000), {'ok': True})
        self.assertEqual(self.link.state(session)['gaze'], [-1, 1])
        refused = self.send('emotion', 'smug', 10000)
        self.assertEqual((refused['ok'], refused['offers']), (False, TRUTH['capabilities']))
        self.assertIn('Unknown emotion', refused['error'])


if __name__ == '__main__':
    unittest.main()
