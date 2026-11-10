import contextlib
import importlib.util
import io
import os
import unittest
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location('avatar_control', Path(__file__).resolve().parents[1] / 'scripts' / 'avatar_control.py')
cli = importlib.util.module_from_spec(spec); spec.loader.exec_module(cli)


def fails(argv, env=None):
    err = io.StringIO()
    with mock.patch.dict(os.environ, env or {}, clear=True), contextlib.redirect_stderr(err), unittest.TestCase().assertRaises(SystemExit):
        cli.build_request(cli.parse(argv))
    return err.getvalue()


class AvatarControlCliTest(unittest.TestCase):
    def test_feel_builds_an_emotion_command(self):
        self.assertEqual(cli.build_request(cli.parse(['--token', 'T', 'feel', 'joy'])),
                         ('/control', {'op': 'emotion', 'value': 'joy'}, {'X-Avatar-Token': 'T'}))

    def test_react_act_and_stop(self):
        self.assertEqual(cli.build_request(cli.parse(['--token', 'T', 'react', 'wink']))[1], {'op': 'reaction', 'value': 'wink'})
        self.assertEqual(cli.build_request(cli.parse(['--token', 'T', 'act', 'clap']))[1], {'op': 'act', 'value': 'clap'})
        self.assertEqual(cli.build_request(cli.parse(['--token', 'T', 'stop']))[1], {'op': 'stop', 'value': None})

    def test_look_is_two_numbers_in_range(self):
        self.assertEqual(cli.build_request(cli.parse(['--token', 'T', 'look', '0.5', '-0.2']))[1], {'op': 'gaze', 'value': [0.5, -0.2]})
        self.assertIn('[-1, 1]', fails(['--token', 'T', 'look', '2', '0']))

    def test_token_comes_from_the_environment(self):
        with mock.patch.dict(os.environ, {'JAEGER_AVATAR_CONTROL_TOKEN': 'E'}, clear=True):
            self.assertEqual(cli.build_request(cli.parse(['feel', 'joy']))[2], {'X-Avatar-Token': 'E'})
        self.assertIn('JAEGER_AVATAR_CONTROL_TOKEN', fails(['feel', 'joy']))

    def test_defaults_to_the_demo_server(self):
        self.assertEqual(cli.parse(['stop']).url, 'http://127.0.0.1:8790')

    def test_wav_duration(self):
        import wave
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(b'\0\0' * 36000)
        self.assertEqual(cli.wav_ms(buf.getvalue()), 1500)
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(b'\0\0' * 24001)
        self.assertEqual(cli.wav_ms(buf.getvalue()), 1001)   # never shorter than the sound, or its last lip mark falls outside


if __name__ == '__main__':
    unittest.main()
