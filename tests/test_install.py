"""A fresh checkout: ./run.sh installs the app and the agent, and the app says why when only scripted replies answer."""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
# Stands in for every Python: writes down how it was called, and "-m venv DIR" leaves a copy of itself as DIR/bin/python.
STUB = '''#!/bin/sh
echo "$(basename "$0") $*" >> "$LOG"
if [ "$1" = "-m" ] && [ "$2" = "venv" ]; then mkdir -p "$3/bin" && cp "$0" "$3/bin/python"; fi
if [ -n "${FAIL:-}" ]; then case "$*" in *"$FAIL"*) exit 1;; esac; fi
'''


class RunScriptTest(unittest.TestCase):
    def run_sh(self, *args, pythons=('python3', 'python3.12'), fail='', again=False):
        """Run run.sh in an empty folder with stub Pythons; returns (what was called, stderr, the folder)."""
        if not again:
            self.dir = Path(tempfile.mkdtemp()); self.addCleanup(shutil.rmtree, self.dir, True)
            shutil.copy(ROOT / 'run.sh', self.dir)
            (self.dir / 'bin').mkdir()
            for name in pythons:
                (self.dir / 'bin' / name).write_text(STUB); (self.dir / 'bin' / name).chmod(0o755)
        log = self.dir / 'log'; log.unlink(missing_ok=True)
        done = subprocess.run(['/bin/sh', str(self.dir / 'run.sh'), *args], capture_output=True, text=True,
                              env={'PATH': f'{self.dir}/bin:/bin:/usr/bin', 'LOG': str(log), 'FAIL': fail})
        self.assertEqual(done.returncode, 0, done.stderr)
        return log.read_text().splitlines(), done.stderr

    def test_a_fresh_checkout_gets_the_app_and_the_agent_then_starts(self):
        calls, _ = self.run_sh('--port', '1')
        self.assertEqual(calls, ['python3 -m venv .venv', 'python -m pip install -r requirements-app.txt',
                                 'python3.12 -m venv .agent-venv', 'python -m pip install -r requirements-agent.txt',
                                 'python -m jaeger_avatar --port 1'])

    def test_a_second_run_installs_nothing(self):
        self.run_sh()
        self.assertEqual(self.run_sh(again=True)[0], ['python -m jaeger_avatar'])

    def test_python_3_11_serves_when_3_12_is_absent(self):
        self.assertIn('python3.11 -m venv .agent-venv', self.run_sh(pythons=('python3', 'python3.11'))[0])

    def test_scripted_asks_for_no_agent(self):
        self.assertNotIn('.agent-venv', ' '.join(self.run_sh('--scripted')[0]))

    def test_without_a_python_the_agent_can_use_the_app_still_starts_and_says_so(self):
        calls, err = self.run_sh(pythons=('python3',))
        self.assertEqual(calls[-1], 'python -m jaeger_avatar')
        self.assertNotIn('.agent-venv', ' '.join(calls))
        self.assertIn('Python 3.11 or 3.12', err)

    def test_an_agent_install_that_fails_is_tried_again_next_run(self):
        calls, err = self.run_sh(fail='requirements-agent.txt')
        self.assertEqual(calls[-1], 'python -m jaeger_avatar')
        self.assertFalse((self.dir / '.agent-venv').exists())
        self.assertIn('scripted', err)
        self.assertIn('python3.12 -m venv .agent-venv', self.run_sh(again=True)[0])

    def test_an_app_install_that_fails_stops_and_is_tried_again_next_run(self):
        self.dir = Path(tempfile.mkdtemp()); self.addCleanup(shutil.rmtree, self.dir, True)
        shutil.copy(ROOT / 'run.sh', self.dir); (self.dir / 'bin').mkdir()
        (self.dir / 'bin/python3').write_text(STUB); (self.dir / 'bin/python3').chmod(0o755)
        done = subprocess.run(['/bin/sh', str(self.dir / 'run.sh')], capture_output=True, text=True,
                              env={'PATH': f'{self.dir}/bin:/bin:/usr/bin', 'LOG': str(self.dir / 'log'), 'FAIL': 'requirements-app.txt'})
        self.assertNotEqual(done.returncode, 0)
        self.assertFalse((self.dir / '.venv').exists())


class PinsTest(unittest.TestCase):
    def test_the_agent_and_its_voice_and_hearing_are_pinned_to_commits(self):
        pins = dict(re.findall(r'^([\w-]+) @ git\+https://github\.com/JenkinsRobotics/([\w-]+)\.git@[0-9a-f]{40}$',
                               (ROOT / 'requirements-agent.txt').read_text(), re.M))
        self.assertEqual(pins, {'jaeger-os': 'JaegerOS', 'jaeger-agent': 'jaeger-module-agent',
                                'jaeger-kokoro-tts': 'jaeger-module-kokoro', 'jaeger-whisper-stt': 'jaeger-module-whisper'})


class WhyScriptedTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault('JAEGER_AVATAR_CONTROL_TOKEN', 'T')
        sys.path.insert(0, str(ROOT / 'app'))
        import server
        cls.server = server

    def why(self, process=None, models=('m',), env=None):
        host = mock.Mock(process=process)
        with mock.patch.object(self.server, 'agent_host', host), mock.patch.dict(self.server.MODELS, {m: m for m in models}, clear=True), \
                mock.patch.dict(os.environ, env or {}):
            return self.server.why_scripted()

    def test_nothing_to_say_while_the_agent_runs(self):
        self.assertEqual(self.why(process=mock.Mock(poll=lambda: None)), '')

    def test_started_scripted(self):
        self.assertIn('--scripted', self.why(env={'NORI_BRAIN': 'scripted'}))

    def test_no_agent_installed(self):
        self.assertIn('not installed', self.why(process=None))

    def test_no_model_file(self):
        self.assertIn('no model file', self.why(process=mock.Mock(poll=lambda: None), models=()))

    def test_the_agent_stopped(self):
        self.assertIn('agent.log', self.why(process=mock.Mock(poll=lambda: 1)))


if __name__ == '__main__':
    unittest.main()
