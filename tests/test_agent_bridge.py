"""The bridge to the agent worker: what the app sees of the voice loop's lines, on a stand-in process."""
import json
import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
import agent_bridge


class Pipe:
    def __init__(self): self.lines = []
    def write(self, text): self.lines.append(json.loads(text))
    def flush(self): pass


class Proc:
    def __init__(self, *lines):
        self.stdout, self.stdin = [json.dumps(line) + '\n' for line in lines], Pipe()
    def poll(self): return 0


class BridgeTest(unittest.TestCase):
    def host(self, *lines):
        host = agent_bridge.AgentHost()
        host.process = Proc(*lines)
        return host

    def test_the_report_follows_the_loop_when_its_voice_changes(self):
        host = self.host({'ready': True, 'schema': {'version': '1'}, 'model': 'gemma', 'report': {'voice': {'model': 'af_heart'}}},
                         {'report': {'voice': {'model': 'af_bella'}}})
        host._read()
        self.assertEqual((host.report, host.schema, host.model), ({'voice': {'model': 'af_bella'}}, {'version': '1'}, 'gemma'))

    def test_a_line_spoken_by_the_agents_voice_comes_back_to_the_one_who_asked(self):
        host = self.host(); host.ready = True
        got = []
        def ask():
            try: got.append(host.say('Hi.', 'af_bella'))
            except RuntimeError as exc: got.append(str(exc))
        for answer, expected in (({'rate': 24000, 'pcm': 'AAA=', 'ms': 12}, {'rate': 24000, 'pcm': 'AAA=', 'ms': 12}),
                                 ({'error': 'no voice'}, 'no voice')):
            host.ready, host.process.stdin.lines = True, []
            asker = threading.Thread(target=ask); asker.start()
            for _ in range(200):
                if host.process.stdin.lines: break
                threading.Event().wait(0.01)
            sent = host.process.stdin.lines[0]
            self.assertEqual((sent['op'], sent['text'], sent['voice']), ('say', 'Hi.', 'af_bella'))
            host.process.stdout = [json.dumps({'id': sent['id'], **answer}) + '\n']
            host._read()
            asker.join(2)
            last = got[-1]
            self.assertEqual({k: v for k, v in last.items() if k != 'id'} if isinstance(last, dict) else last, expected)
        self.assertEqual(host.pending, {})                        # nobody is left waiting

    def test_loop_events_reach_every_listener_and_the_report_is_kept(self):
        host = self.host({'ready': True, 'schema': {'version': '1'}, 'model': 'gemma', 'report': {'ctx': 32768}},
                         {'event': 'audio', 'text': 'Hi.'}, {'event': 'done'})
        a, b = host.listen(), host.listen()
        host.unlisten(b)
        host._read()
        self.assertEqual((host.model, host.report), ('gemma', {'ctx': 32768}))
        got = [a.get_nowait() for _ in range(a.qsize())]
        self.assertEqual(got[:2], [{'event': 'audio', 'text': 'Hi.'}, {'event': 'done'}])
        self.assertEqual(got[2:], [{'event': 'status', 'text': 'The agent stopped'}, {'event': 'done'}])   # the worker ended
        self.assertTrue(b.empty())
        self.assertFalse(host.ready)

    def test_the_agents_avatar_request_is_answered_on_the_same_pipe(self):
        host = self.host({'ready': True}, {'control': {'op': 'emotion', 'value': 'joy', 'ttl_ms': 10000}, 'id': 'r1'})
        asked = []
        host.on_control = lambda op, value, ttl_ms: asked.append((op, value, ttl_ms)) or {'ok': True}
        host._read()
        self.assertEqual(asked, [('emotion', 'joy', 10000)])
        self.assertEqual(host.process.stdin.lines, [{'op': 'control_result', 'id': 'r1', 'result': {'ok': True}}])

    def test_an_avatar_request_with_nobody_to_ask_is_refused(self):
        host = self.host({'ready': True}, {'control': {'op': 'emotion', 'value': 'joy', 'ttl_ms': 1}, 'id': 'r1'})
        host._read()
        self.assertEqual(host.process.stdin.lines[0]['result']['ok'], False)

    def test_an_old_worker_ending_does_not_switch_off_the_new_one(self):
        host = self.host()
        old = host.process
        host.process = Proc()
        host.ready = True
        host._read(old)
        self.assertTrue(host.ready)

    def test_the_loop_worker_gets_its_start_line_first(self):
        started = []
        def popen(args, **kw):
            started.append(args)
            return Proc()
        self.addCleanup(setattr, agent_bridge.subprocess, 'Popen', agent_bridge.subprocess.Popen)
        self.addCleanup(setattr, agent_bridge.os, 'environ', agent_bridge.os.environ)
        agent_bridge.subprocess.Popen = popen
        agent_bridge.os.environ = {**agent_bridge.os.environ, 'JAEGER_AGENT_PYTHON': sys.executable}
        host = agent_bridge.AgentHost()
        host.start({'op': 'start', 'model': 'gemma'})
        self.assertTrue(started[0][-1].endswith('agent_loop.py'))
        self.assertEqual(host.process.stdin.lines, [{'op': 'start', 'model': 'gemma'}])
        host.start()
        self.assertTrue(started[1][-1].endswith('agent_worker.py'))


if __name__ == '__main__':
    unittest.main()
