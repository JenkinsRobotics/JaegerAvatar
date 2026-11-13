import unittest

from jaeger_avatar.embedded.agent_tools import avatar_tool, link_transport
from jaeger_avatar.embedded.link import ControlLink

TRUTH = {'avatar': 'truth', 'capabilities': {'emotions': ['neutral', 'joy'], 'reactions': ['wink'], 'actions': ['clap']}}


class Clock:
    def __init__(self): self.now = 1000.0
    def __call__(self): return self.now


class AvatarToolTest(unittest.TestCase):
    """The agent's avatar tool, driving a real control link the way the app wires it."""

    def setUp(self):
        self.clock = Clock()
        self.link = ControlLink('T', clock=self.clock)
        self.avatar = avatar_tool(link_transport(self.link, 'T'))

    def attach(self):
        self.session = self.link.attach(TRUTH)['session']
        return self.link.state(self.session)

    def test_an_emotion_reaches_the_body_and_is_held(self):
        self.attach()
        self.assertEqual(self.avatar(emotion='joy'), {'ok': True, 'did': ['emotion joy']})
        self.clock.now += 9000
        self.assertEqual(self.link.state(self.session)['emotion'], 'joy')

    def test_a_feeling_this_body_lacks_comes_back_with_what_it_offers(self):
        self.attach()
        out = self.avatar(emotion='smug')
        self.assertFalse(out['ok'])
        self.assertIn('Unknown emotion', out['errors'][0])
        self.assertEqual(out['offers'], TRUTH['capabilities'])

    def test_an_action_may_be_a_gesture_or_a_reaction(self):
        before = self.attach()
        self.assertEqual(self.avatar(action='clap')['did'], ['action clap'])
        self.assertEqual(self.avatar(action='wink')['did'], ['action wink'])
        after = self.link.state(self.session)
        self.assertGreater(after['act_seq'], before['act_seq'])   # each is the sequence of its last command
        self.assertGreater(after['reaction_seq'], before['reaction_seq'])
        self.assertEqual((after['act'], after['reaction']), ('clap', 'wink'))

    def test_look_words_become_a_gaze(self):
        self.attach()
        self.assertTrue(self.avatar(look='up left')['ok'])
        self.assertEqual(self.link.state(self.session)['gaze'], [-1, 1])
        self.assertIn('look', self.avatar(look='sideways')['errors'][0])

    def test_one_call_can_feel_and_move_and_reports_each_part(self):
        self.attach()
        out = self.avatar(emotion='joy', action='backflip')
        self.assertFalse(out['ok'])
        self.assertEqual(out['did'], ['emotion joy'])
        self.assertIn('Unknown action', out['errors'][0])

    def test_none_means_no_move_not_a_move_to_refuse(self):
        self.attach()    # seen 2026-11-11: the small model fills the slot it does not want with "none"
        self.assertEqual(self.avatar(emotion='joy', action='none', look='None'), {'ok': True, 'did': ['emotion joy']})

    def test_no_page_and_nothing_asked_are_said_plainly(self):
        self.assertIn('No avatar attached', self.avatar(emotion='joy')['errors'][0])
        self.assertFalse(self.avatar()['ok'])


class SceneCheckTest(unittest.TestCase):
    """A scene's moves are checked against what the body offers before the scene starts."""

    def test_the_link_says_what_the_attached_body_offers(self):
        link = ControlLink('T')
        send = link_transport(link, 'T')
        self.assertEqual(send('offers', None, 0)['ok'], False)                 # nobody on stage: nothing to check against
        link.attach(TRUTH)
        self.assertEqual(send('offers', None, 0), {'ok': True, 'offers': TRUTH['capabilities']})

    def test_a_call_is_fitted_the_way_the_avatar_tool_would_take_it(self):
        from jaeger_avatar.embedded.agent_tools import fitted
        offers = TRUTH['capabilities']
        for call in ({'emotion': 'joy'}, {'action': 'clap', 'hold': 2.0}, {'action': 'wink'}, {'look': 'up left'}, {'emotion': 'joy', 'look': 'center'}):
            self.assertEqual(fitted(call, offers), (call, []), call)           # an action may be one of the body's reactions
        kept, left = fitted({'emotion': 'happy', 'action': 'wave', 'look': 'sideways', 'spin': 'fast', 'hold': 2}, offers)
        self.assertEqual(kept, {'hold': 2})
        self.assertEqual(left, ['emotion happy (it shows: neutral, joy)', 'action wave (it does: clap, wink)',
                                'look sideways (left, right, up, down or center)', 'spin (a move is an emotion, an action or a look)'])
        self.assertEqual(fitted({'emotion': 'joy', 'action': 'wave'}, offers)[0], {'emotion': 'joy'})   # what it can do is kept


class SceneToolTest(unittest.TestCase):
    def test_the_models_script_is_staged_with_the_agent_to_play_after_its_words(self):
        from jaeger_avatar.embedded.agent_tools import scene_tool
        staged = []
        scene = scene_tool(lambda script: staged.append(script) and [])
        answer = scene(script='look left | hold 3 | emotion joy | say Hi.')
        self.assertEqual(staged, ['look left | hold 3 | emotion joy | say Hi.'])
        self.assertEqual(answer, {'ok': True, 'note': 'The scene plays now.'})   # with ok, the agent ends the turn there: the scene is the reply
        left = scene_tool(lambda script: ['action wave (it does: clap, wink)'])(script='action wave | say Hi.')
        self.assertEqual(left['ok'], True)                        # it still plays, and the model reads what was left out for next time
        self.assertIn('without what this body cannot do: action wave (it does: clap, wink)', left['note'])
        for part in ('say', 'wait', 'emotion', 'action', 'look', 'hold', 'on'):   # the model is shown every part of a beat
            self.assertIn(part + ' <', scene.__doc__)

    def test_a_script_the_agent_cannot_read_goes_back_to_the_model_to_fix(self):
        from jaeger_avatar.embedded.agent_tools import scene_tool
        def stage(script): raise ValueError("Beat 1: 'goodbye' is not in the line")
        self.assertEqual(scene_tool(stage)(script='say Hello. | on goodbye'), {'ok': False, 'error': "Beat 1: 'goodbye' is not in the line"})


if __name__ == '__main__':
    unittest.main()
