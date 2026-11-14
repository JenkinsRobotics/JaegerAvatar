"""The app's side of Jaeger Agent's voice loop: what the page's requests become on the worker's pipe."""
import base64
import http.client
import io
import json
import os
import queue
import sys
import tempfile
import threading
import unittest
import wave
from http.server import ThreadingHTTPServer
from pathlib import Path

os.environ['JAEGER_AVATAR_CONTROL_TOKEN'] = 'T'
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
import server  # noqa: E402

from jaeger_avatar.embedded.link import ControlLink  # noqa: E402

REPORT = {'voice': {'module': 'jaeger_kokoro_tts', 'version': '0.13.0', 'compute': 'mlx', 'model': 'af_heart'},
          'hearing': {'module': 'jaeger_whisper_stt', 'version': '0.14.0', 'compute': 'metal', 'model': 'large-v3-turbo'},
          'ctx': 32768, 'tools_enabled': True, 'max_iterations': 24, 'tool_list': 'short list', 'load_s': 16.9}
WHO = {'session': 's1', 'pack': 'vita', 'body': 'Vita, full body', 'actions': ['wave'],
       'controls': {'emotions': ['joy', 'sad'], 'reactions': ['nod', 'not a name'], 'actions': ['wave']}}
J = {'Content-Type': 'application/json'}


class Host:
    """Stands in for the worker: keeps what the app sent it."""

    def __init__(self):
        self.ready, self.sent, self.started, self.q = True, [], [], queue.Queue()
        self.report, self.schema, self.model, self.process = REPORT, {'version': '1.2.0'}, 'gemma-test', type('Running', (), {'poll': lambda self: None})()

    def send(self, data):
        if not self.ready: raise RuntimeError('JaegerAgent is not ready')
        self.sent.append(data)

    def say(self, text, voice=None):
        if not self.ready: raise RuntimeError('JaegerAgent is not ready')
        self.said = (text, voice)
        return {'rate': 24000, 'pcm': base64.b64encode(b'\x01\x00\xff\x7f').decode(), 'ms': 41.6, 'marks': [[0.1, 0.2, 'p']]}

    def listen(self): return self.q
    def unlisten(self, q): self.unlistened = True
    def restart(self, first=None): self.started.append(first)


class AgentRoutesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown(); cls.httpd.server_close()

    def setUp(self):
        for name in ('agent_host', 'LOOP', 'loop_key', 'config', 'SETTINGS_FILE'):
            self.addCleanup(setattr, server, name, getattr(server, name))
        server.agent_host, server.LOOP, server.loop_key = Host(), True, None
        self.host = server.agent_host

    def call(self, method, path, body=b'', **headers):
        c = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=5)
        c.request(method, path, body=body, headers={'Host': '127.0.0.1', **headers})
        r = c.getresponse(); data = r.read(); c.close()
        self.headers = r.headers
        return r.status, data

    def post(self, path, data):
        return self.call('POST', path, json.dumps(data).encode(), **J)

    def test_typed_words_go_to_the_loop_as_this_character_in_this_body(self):
        self.assertEqual(self.post('/agent/text', {**WHO, 'text': 'hi'})[0], 200)
        persona, text = self.host.sent
        self.assertEqual(text, {'op': 'text', 'text': 'hi'})
        self.assertEqual(persona['op'], 'persona')
        self.assertTrue(persona['session'].startswith('s1:'))
        said = persona['persona']
        last = said.strip().splitlines()[-1]       # the body and its rule come last, and the call comes before the words:
        self.assertIn('call the scene tool instead', last)   # asked to act something out, the model writes a scene
        for part in ('Vita, full body', 'joy sad', 'nod wave', 'begin every reply with one avatar tool call'):   # measured 2026-11-11,
            self.assertIn(part, last)              # the model then moved the body on 42 of 42 turns (old wording: 1 to 3 of 7)
        self.assertNotIn('<|', said)               # no model's own syntax in the app: the loop worker adds the example
        self.assertNotIn('not a name', said)       # only plain names reach the prompt
        self.assertNotIn('[joy]', said)            # no inline tags: the agent moves the body with its tool
        self.post('/agent/text', {**WHO, 'text': 'again'})
        self.assertEqual([s['op'] for s in self.host.sent], ['persona', 'text', 'text'])   # same character: not told twice
        self.post('/agent/text', {**WHO, 'controls': {'emotions': ['joy'], 'reactions': [], 'actions': []}, 'text': 'new body'})
        self.assertEqual(self.host.sent[-2]['op'], 'persona')
        self.assertNotEqual(self.host.sent[-2]['session'], persona['session'])           # another body: its own conversation

    def test_the_character_speaks_in_the_voice_chosen_for_it(self):
        self.post('/agent/text', {**WHO, 'voice': 'kokoro:af_bella', 'text': 'hi'})
        first = self.host.sent[0]
        self.assertEqual((first['op'], first['voice']), ('persona', 'af_bella'))
        self.post('/agent/text', {**WHO, 'voice': 'kokoro:bf_emma', 'text': 'again'})
        again = self.host.sent[2]
        self.assertEqual((again['op'], again['voice'], again['session']), ('persona', 'bf_emma', first['session']))   # same conversation, new voice
        self.post('/agent/text', {**WHO, 'voice': 'clone:abc', 'text': 'more'})      # not a voice the module has: the loop is not told one
        self.assertNotIn('voice', self.host.sent[4])

    def test_a_scene_goes_to_the_agent_as_this_character_and_a_cue_goes_straight_through(self):
        self.assertEqual(self.post('/agent/scene', {**WHO, 'script': 'say Hi. | emotion joy'})[0], 200)
        persona, scene = self.host.sent
        self.assertEqual((persona['op'], scene), ('persona', {'op': 'scene', 'script': 'say Hi. | emotion joy'}))   # the script is the agent's to read
        self.assertEqual(self.post('/agent/scene', {**WHO, 'script': [{'say': 'Hi.'}]})[0], 200)                  # or written out as beats
        self.assertEqual(self.host.sent[-1], {'op': 'scene', 'script': [{'say': 'Hi.'}]})
        self.assertEqual(self.post('/agent/scene', {**WHO, 'script': 7})[0], 400)
        self.assertEqual(self.post('/agent/cue', {'call': {'emotion': 'joy', 'hold': 3}})[0], 200)                # a cue whose moment has come
        self.assertEqual(self.host.sent[-1], {'op': 'cue', 'call': {'emotion': 'joy', 'hold': 3}})
        self.assertEqual(self.post('/agent/cue', {'call': 'joy'})[0], 400)
        self.host.ready = False
        self.assertEqual(self.post('/agent/scene', {**WHO, 'script': 'say Hi.'})[0], 503)

    def test_microphone_sound_goes_in_and_too_much_is_refused(self):
        pcm = bytes(range(8))
        self.assertEqual(self.call('POST', '/agent/audio', pcm)[0], 200)
        self.assertEqual(self.host.sent, [{'op': 'audio', 'pcm': base64.b64encode(pcm).decode()}])
        self.host.sent.clear()
        self.assertEqual(self.call('POST', '/agent/audio?end=1', pcm)[0], 200)   # the page's mic went quiet: the phrase ends with this sound
        self.assertEqual(self.host.sent, [{'op': 'audio', 'pcm': base64.b64encode(pcm).decode(), 'end': True}])
        self.assertEqual(self.call('POST', '/agent/audio', b'', **{'Content-Length': str(server.MIC_LIMIT + 1)})[0], 413)

    def test_a_loop_that_is_still_loading_says_so(self):
        self.host.ready = False
        status, data = self.post('/agent/text', {**WHO, 'text': 'hi'})
        self.assertEqual((status, json.loads(data)['error']), (503, 'The agent is still loading'))
        self.assertEqual(self.call('POST', '/agent/audio', b'\0\0')[0], 503)
        self.assertEqual(self.post('/warm', WHO)[0], 200)      # naming the character early is never an error
        self.assertEqual(server.loop_key, None)                # and it is told again once the loop is up

    def test_the_page_hears_every_loop_event(self):
        self.host.q.put({'event': 'assistant', 'text': 'Hi.'})
        self.host.q.put({'event': 'done'})
        c = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=5)
        c.request('GET', '/agent/events', headers={'Host': '127.0.0.1'})
        r = c.getresponse()
        self.assertEqual(r.getheader('Content-Type'), 'text/event-stream')
        lines = [r.fp.readline() for _ in range(4)]
        c.close()
        self.assertEqual([json.loads(l[6:]) for l in lines if l.startswith(b'data: ')],
                         [{'event': 'assistant', 'text': 'Hi.'}, {'event': 'done'}])

    def test_a_line_spoken_by_the_agents_own_voice_comes_back_as_one_clip(self):
        status, data = self.post('/voice/module', {'text': ' Hello there. '})
        self.assertEqual((status, self.headers['Content-Type'], self.host.said), (200, 'audio/wav', ('Hello there.', None)))
        with wave.open(io.BytesIO(data)) as w:                    # the same kind of clip /say gives: 16-bit mono
            self.assertEqual((w.getframerate(), w.getnchannels(), w.getsampwidth(), w.readframes(9)), (24000, 1, 2, b'\x01\x00\xff\x7f'))
        self.assertEqual(json.loads(self.headers['X-Lips']), [[0.1, 0.2, 'p']])   # the voice module's own lip marks
        self.assertEqual(self.headers['X-Render-Ms'], '42')       # how long the voice itself took
        self.post('/voice/module', {'text': 'Hi.', 'voice': 'kokoro:bf_emma'})
        self.assertEqual(self.host.said, ('Hi.', 'bf_emma'))      # one of the app's Kokoro voices, for this line
        self.assertEqual(self.post('/voice/module', {'text': 'Hi.', 'voice': 'clone:abc'})[0], 400)   # not a voice the module has
        self.assertEqual(self.post('/voice/module', {'text': '  '})[0], 400)
        self.host.ready = False
        status, data = self.post('/voice/module', {'text': 'Hi.'})
        self.assertEqual((status, json.loads(data)['error']), (503, 'JaegerAgent is not ready'))
        server.LOOP = False                                       # the old path has no agent voice to ask
        self.assertEqual(self.post('/voice/module', {'text': 'Hi.'})[0], 404)

    def test_stop_and_naming_the_character(self):
        self.post('/warm', WHO)
        self.post('/agent/interrupt', {'session': 's1', 'pack': 'vita'})
        self.assertEqual([s['op'] for s in self.host.sent], ['persona', 'interrupt'])

    def test_the_app_says_what_the_loop_runs_on(self):
        health = json.loads(self.call('GET', '/health')[1])
        self.assertEqual((health['loop'], health['ears']), (True, True))
        self.assertEqual(health['brain'], 'JaegerAgent voice loop · gemma-test')
        self.assertIn('jaeger_whisper_stt', health['hearing'])
        settings = json.loads(self.call('GET', '/settings')[1])
        shown = settings['jaeger_agent']['in_app']
        self.assertEqual((shown['ctx'], shown['tools_enabled'], shown['max_iterations']), (32768, True, 24))
        self.assertEqual(settings['parts']['voice']['compute'], 'mlx')
        self.host.ready = False
        self.assertEqual(json.loads(self.call('GET', '/health')[1])['brain'], 'scripted')

    def test_a_settings_change_restarts_the_loop_with_the_new_values(self):
        server.SETTINGS_FILE = Path(tempfile.mkdtemp()) / 'settings.json'
        self.assertEqual(self.post('/settings', {'agent': {'temperature': 0.3}})[0], 200)
        for _ in range(200):
            if self.host.started: break
            threading.Event().wait(0.01)
        start = self.host.started[0]
        self.assertEqual((start['op'], start['temperature'], start['hearing']), ('start', 0.3, server.config['hearing']['model']))
        self.assertEqual(server.loop_key, None)

    def test_the_agents_tool_moves_the_attached_avatar(self):
        self.addCleanup(setattr, server, 'control_link', server.control_link)
        server.control_link = link = ControlLink('T')
        self.assertEqual(server.move_avatar('emotion', 'joy', 1000)['error'], 'No avatar attached')
        page = link.attach({'avatar': 'vita', 'capabilities': {'emotions': ['neutral', 'joy'], 'reactions': ['wink'], 'actions': []}})['session']
        self.assertEqual(server.move_avatar('emotion', 'joy', 1000), {'ok': True})
        self.assertEqual(link.state(page)['emotion'], 'joy')    # what the page reads on its next poll
        self.assertEqual(server.move_avatar('offers', None, 0)['offers']['reactions'], ['wink'])   # asked before a scene, to check its moves
        refused = server.move_avatar('act', 'clap', 1000)
        self.assertEqual((refused['ok'], refused['offers']['reactions']), (False, ['wink']))


if __name__ == '__main__':
    unittest.main()
