"""The control link's HTTP routes, on the real demo handler, on an ephemeral loopback port."""
import http.client
import json
import os
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

os.environ['JAEGER_AVATAR_CONTROL_TOKEN'] = 'T'
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
import server  # noqa: E402

from jaeger_avatar.embedded.link import ControlLink  # noqa: E402


class ControlHttpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown(); cls.httpd.server_close()

    def setUp(self):
        server.control_link = ControlLink('T')   # each test starts with no page attached

    def call(self, method, path, body=b'', **headers):
        c = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=5)
        c.request(method, path, body=body, headers={'Host': '127.0.0.1', **headers})
        r = c.getresponse(); data = r.read(); c.close()
        return r.status, data

    def test_refusals(self):
        J = {'Content-Type': 'application/json'}
        cmd = json.dumps({'op': 'emotion', 'value': 'joy'}).encode()
        self.assertEqual(self.call('GET', '/control/state', Host='evil.example')[0], 403)          # DNS rebinding
        self.assertEqual(self.call('POST', '/control', cmd, Origin='http://evil.example', **J)[0], 403)
        self.assertEqual(self.call('POST', '/control/attach', b'{}', **{'Content-Type': 'text/plain; json'})[0], 415)   # no preflight, so refused
        self.assertEqual(self.call('POST', '/control', cmd, **J)[0], 403)                          # no token
        status, data = self.call('POST', '/control', cmd, **J, **{'X-Avatar-Token': 'T'})
        self.assertEqual((status, json.loads(data)['error']), (422, 'No avatar attached'))
        self.assertEqual(self.call('GET', '/control/audio/000000000000')[0], 404)
        self.assertEqual(self.call('POST', '/control/audio', b'', **{'Content-Length': str(10 * 1024 * 1024 + 1)})[0], 413)

    def test_a_page_and_an_agent(self):
        J = {'Content-Type': 'application/json'}
        caps = {'avatar': 'jp01', 'capabilities': {'emotions': ['neutral', 'joy'], 'reactions': ['wink'], 'actions': []}}
        session = json.loads(self.call('POST', '/control/attach', json.dumps(caps).encode(), **J)[1])['session']
        self.assertTrue(json.loads(self.call('GET', '/control/state?session=' + session)[1])['attached'])
        ok = self.call('POST', '/control', b'{"op":"emotion","value":"joy"}', **J, **{'X-Avatar-Token': 'T'})
        self.assertEqual((ok[0], json.loads(ok[1])['emotion']), (200, 'joy'))
        bad = self.call('POST', '/control', b'{"op":"act","value":"clap"}', **J, **{'X-Avatar-Token': 'T'})
        self.assertEqual((bad[0], json.loads(bad[1])['error']), (422, 'Unknown action'))


if __name__ == '__main__':
    unittest.main()
