"""The desktop window: `python -m jaeger_avatar` opens the app in its own window; `--browser` serves it only."""
import unittest

from jaeger_avatar import __main__ as launch
from jaeger_avatar import window


class WindowTest(unittest.TestCase):
    def test_only_the_apps_own_page_gets_the_microphone_and_camera(self):
        self.assertTrue(window.own_page('127.0.0.1'))
        self.assertTrue(window.own_page('localhost'))
        self.assertFalse(window.own_page('example.com'))
        self.assertFalse(window.own_page(''))

    def test_the_window_runs_the_server_in_browser_mode_with_the_same_flags(self):
        cmd = launch.server_command(['--port', '8791', '--scripted'])
        self.assertEqual(cmd[1:4], ['-m', 'jaeger_avatar', '--browser'])
        self.assertEqual(cmd[4:], ['--port', '8791', '--scripted'])


    def test_the_server_stops_when_its_window_process_is_gone(self):
        import os, subprocess, sys, time
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        server = "import os, time; from jaeger_avatar.__main__ import watch_parent; watch_parent(os.getppid()); print('watching', flush=True); time.sleep(60)"
        window_ = f"import subprocess, sys, time; p = subprocess.Popen([sys.executable, '-c', {server!r}]); print(p.pid, flush=True); time.sleep(15)"
        w = subprocess.Popen([sys.executable, '-c', window_], cwd=root, stdout=subprocess.PIPE, text=True)
        child = int(w.stdout.readline())
        self.assertEqual(w.stdout.readline().strip(), 'watching')   # the server is up and watching
        w.kill(); w.wait()                       # the window process is killed, not closed
        for _ in range(50):
            try: os.kill(child, 0)
            except ProcessLookupError: return
            time.sleep(0.1)
        os.kill(child, 9)
        self.fail('the server outlived its window')


if __name__ == '__main__':
    unittest.main()
