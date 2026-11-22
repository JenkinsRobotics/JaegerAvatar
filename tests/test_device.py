"""A body with a speaker and a microphone, connected to Jaeger Agent with no browser: what Mochi and JP01 are to the agent."""
import base64
import queue
import sys
import time
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from jaeger_avatar.embedded.control import Controller  # noqa: E402
from jaeger_avatar.embedded.device import Device, Player, track  # noqa: E402

RATE = 1000
MANIFEST = {'avatar': 'mochi', 'name': 'Mochi', 'capabilities': {'emotions': ['neutral', 'joy', 'thinking', 'listening'], 'reactions': ['wink']},
            'activity': {'thinking': 'thinking', 'listening': 'listening'}}


def audio(text, seconds=0.06, level=0.5, **more):
    pcm = (np.full(int(seconds * RATE), level) * 32767).astype('<i2').tobytes()
    return {'event': 'audio', 'text': text, 'rate': RATE, 'pcm': base64.b64encode(pcm).decode(), 'marks': [], 'cues': [], **more}


class Speaker:
    def __init__(self): self.played, self.stopped = [], 0
    def play(self, samples, rate): self.played.append((len(samples), rate))
    def stop(self): self.stopped += 1


class Host:
    """Stands in for agent_host.AgentHost: keeps what the device sent, and hands it the events a test puts in."""
    def __init__(self): self.sent, self.q, self.ready, self.first, self.on_control = [], queue.Queue(), True, None, None
    def start(self, first): self.first = first
    def listen(self): return self.q
    def send(self, data): self.sent.append(data)
    def close(self): self.q.put(None)


class TrackTest(unittest.TestCase):
    def test_the_mouth_follows_how_loud_the_voice_is_and_closes_on_a_lip_mark(self):
        samples = np.concatenate([np.full(40, 0.1), np.full(40, 0.8), np.full(20, 0.4)]).astype(np.float32)   # 0.1 s at 1000 Hz
        steps = track(samples, RATE, marks=[[0.06, 0.08, 'p']], cues=[{'at': 0, 'call': {'emotion': 'joy'}}, {'at': 0.05, 'call': {'action': 'wink'}}])
        self.assertEqual([round(t, 2) for t, _, _ in steps], [0.0, 0.02, 0.04, 0.06, 0.08])
        mouth = [m for _, m, _ in steps]
        self.assertLess(mouth[0], mouth[2]); self.assertEqual(mouth[2], 1.0)            # against the clip's own loudest moment
        self.assertEqual(mouth[3], 0)                                                     # m, b, p: the lips are closed
        self.assertEqual([calls for _, _, calls in steps], [[{'emotion': 'joy'}], [], [], [{'action': 'wink'}], []])   # each cue on the first step at or after its moment

    def test_a_quiet_stretch_moves_no_mouth_but_keeps_its_cues(self):
        steps = track(np.zeros(60, dtype=np.float32), RATE, cues=[{'at': 0, 'call': {'look': 'left', 'hold': 3}}])
        self.assertEqual([m for _, m, _ in steps], [None, None, None])
        self.assertEqual(steps[0][2], [{'look': 'left', 'hold': 3}])


class PlayerTest(unittest.TestCase):
    def setUp(self):
        self.controls, self.cues, self.speaker = [], [], Speaker()
        self.player = Player(lambda op, value, ttl: self.controls.append((op, value)), self.cues.append, self.speaker)
        self.addCleanup(self.player.close)

    def test_clips_play_in_order_with_the_mouth_moving_and_each_cue_made_once(self):
        self.player.on_event(audio('Hi.', cues=[{'at': 0, 'call': {'emotion': 'joy'}}]))
        self.player.on_event(audio('Bye.', seconds=0.04))
        self.assertTrue(self.player.busy)
        self.assertTrue(self.player.wait(2))
        self.assertEqual(self.speaker.played, [(60, RATE), (40, RATE)])
        self.assertEqual(self.cues, [{'emotion': 'joy'}])
        self.assertIn(('speaking', True), self.controls); self.assertIn(('jaw', 1.0), self.controls)
        self.assertEqual(self.controls[-1], ('speaking', False))                          # the mouth rests when she has finished
        self.assertFalse(self.player.busy)

    def test_a_scenes_clips_are_held_until_every_line_is_voiced(self):
        self.player.on_event({'event': 'scene', 'text': 'begin'})
        self.player.on_event(audio('One.'))
        time.sleep(0.15)
        self.assertEqual(self.speaker.played, [])
        self.assertTrue(self.player.busy)                                                 # her turn has begun: the mic stays shut
        self.player.on_event({'event': 'scene', 'text': 'end'})
        self.assertTrue(self.player.wait(2))
        self.assertEqual(len(self.speaker.played), 1)

    def test_the_agents_word_that_a_part_is_voiced_starts_a_scenes_clips_too(self):
        self.player.on_event({'event': 'scene', 'text': 'begin'})
        self.player.on_event(audio('One.'))
        self.player.on_event({'event': 'voiced', 'n': 1})                                 # the agent now waits to hear it has been played: it cannot wait for 'end'
        self.assertTrue(self.player.wait(2))
        self.assertEqual(len(self.speaker.played), 1)

    def test_the_player_is_busy_until_the_last_clip_has_played_out(self):
        self.player.on_event(audio('One.', seconds=0.2))
        self.player.on_event({'event': 'voiced', 'n': 1})                                 # arrives right behind the sound, before the clip has begun
        self.assertTrue(self.player.busy)
        self.assertFalse(self.player.wait(0.1))                                           # still sounding
        self.assertTrue(self.player.wait(2))

    def test_stop_ends_what_is_playing_and_drops_what_was_waiting(self):
        self.player.on_event(audio('A long line.', seconds=2.0))
        self.player.on_event(audio('Never heard.'))
        time.sleep(0.1)
        self.player.stop()
        self.assertTrue(self.player.wait(1))
        self.assertEqual((len(self.speaker.played), self.speaker.stopped), (1, 1))


class DeviceTest(unittest.TestCase):
    def setUp(self):
        self.host, self.speaker, self.shown = Host(), Speaker(), []
        self.device = Device(Controller(MANIFEST), self.host, who='You are Mochi, an AI character.', speaker=self.speaker, show=self.shown.append)
        self.device.start()
        self.addCleanup(self.device.close)

    def settle(self, done, seconds=2):
        end = time.time() + seconds
        while time.time() < end and not done(): time.sleep(0.01)
        self.assertTrue(done())

    def test_the_agent_is_started_as_this_character_in_this_body(self):
        first = self.host.first
        self.assertEqual((first['op'], first['session']), ('start', 'device'))
        self.assertIn('You are Mochi', first['persona']); self.assertIn('joy, thinking, listening', first['persona']); self.assertIn('wink', first['persona'])
        self.assertEqual(self.host.on_control('offers', None, 0), {'ok': True, 'offers': {'emotions': ['neutral', 'joy', 'thinking', 'listening'], 'reactions': ['wink'], 'actions': []}})
        self.assertEqual(self.host.on_control('emotion', 'joy', 5000), {'ok': True})      # the agent's avatar tool moves this body
        self.assertEqual(self.device.controller.snapshot()['emotion'], 'joy')
        self.assertFalse(self.host.on_control('emotion', 'furious', 5000)['ok'])

    def test_the_bundle_says_who_the_character_is_and_which_voice_it_has(self):
        manifest = {**MANIFEST, 'character': {'who': 'You are Mochi, an AI character. You are a small companion robot.', 'voice': 'af_nicole'}}
        device = Device(Controller(manifest), Host())
        self.addCleanup(device.close)
        self.assertIn('a small companion robot', device.first['persona']); self.assertEqual(device.first['voice'], 'af_nicole')

    def test_typed_words_and_scenes_go_to_the_agent_and_stop_what_she_was_saying(self):
        self.host.q.put(audio('A long line.', seconds=2.0))
        self.settle(lambda: self.speaker.played)
        self.device.text('Hello')
        self.device.scene('say Hi. | listen')
        self.device.stop()
        self.assertEqual(self.host.sent, [{'op': 'text', 'text': 'Hello'}, {'op': 'scene', 'script': 'say Hi. | listen'}, {'op': 'interrupt'}])
        self.assertGreaterEqual(self.speaker.stopped, 1)

    def test_the_agent_shuts_its_own_ears_and_is_told_when_the_speaker_has_played_her_words(self):
        frame = np.zeros(160, dtype=np.float32)
        self.assertNotIn('open_mic', self.host.first)                                     # a bare speaker and microphone: the agent's half duplex
        self.host.q.put(audio('Hi there.', seconds=0.2, cues=[{'at': 0, 'call': {'emotion': 'joy'}}]))
        self.host.q.put({'event': 'voiced', 'n': 7})                                      # the agent has voiced it all and waits, its microphone shut
        self.settle(lambda: self.speaker.played)
        self.device.hear(frame)                                                           # every frame goes to the agent: turn-taking is its own
        self.assertIn('pcm', self.host.sent[-1])
        self.assertNotIn({'op': 'played', 'n': 7}, self.host.sent)                        # she is still sounding
        self.settle(lambda: {'op': 'played', 'n': 7} in self.host.sent)                   # the speaker has finished: the agent opens its microphone
        self.assertFalse(self.device.player.busy)
        self.assertIn({'op': 'cue', 'call': {'emotion': 'joy'}}, self.host.sent)
        self.assertNotIn({'op': 'audio', 'end': True}, self.host.sent)                    # this device ends no phrase for the agent

    def test_a_device_with_an_echo_canceller_asks_for_the_agents_open_mic(self):
        device = Device(Controller(MANIFEST), Host(), open_mic=True)
        self.addCleanup(device.close)
        self.assertIs(device.first['open_mic'], True)

    def test_a_script_runs_step_by_step_each_once_the_turn_before_it_has_ended_and_been_played(self):
        import threading
        ran = threading.Thread(target=self.device.run, args=(['# a run with nobody at the keyboard', 'say: Hello', 'scene: say Hi. | listen', 'sleep: 0.01', 'say: My line'],))
        ran.start()
        self.settle(lambda: self.host.sent == [{'op': 'text', 'text': 'Hello'}])
        time.sleep(0.1)
        self.assertEqual(len(self.host.sent), 1)                                          # the next step waits for the turn to end
        self.host.q.put(audio('Hi!', seconds=0.1)); self.host.q.put({'event': 'done'})
        self.settle(lambda: len(self.host.sent) == 2)
        self.assertEqual(self.host.sent[1], {'op': 'scene', 'script': 'say Hi. | listen'})
        self.host.q.put({'event': 'done'})
        self.settle(lambda: len(self.host.sent) == 3)
        self.host.q.put({'event': 'done'})
        ran.join(2)
        self.assertFalse(ran.is_alive())
        self.assertEqual(self.host.sent[2], {'op': 'text', 'text': 'My line'})

    def test_the_face_shows_what_the_agent_is_doing_and_the_words_are_shown(self):
        self.host.q.put({'event': 'state', 'text': 'thinking'})
        self.settle(lambda: self.device.controller.snapshot()['emotion'] == 'thinking')   # the feeling the character's own pack names for it
        self.host.q.put({'event': 'state', 'text': 'hearing you'})
        self.settle(lambda: self.device.controller.snapshot()['emotion'] == 'listening')
        self.host.q.put({'event': 'user', 'text': 'Hello'}); self.host.q.put({'event': 'assistant', 'text': 'Hi!'})
        self.host.q.put({'event': 'scene', 'text': 'listen', 'data': {'expect': 'My name is Sam'}})
        self.settle(lambda: len(self.shown) == 3)
        self.assertEqual(self.shown, ['You: Hello', 'Mochi: Hi!', 'Your line: “My name is Sam”'])


if __name__ == '__main__':
    unittest.main()
