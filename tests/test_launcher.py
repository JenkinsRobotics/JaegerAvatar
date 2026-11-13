"""The launcher: the agent keeps its tools when the voice loop runs; only the old in-app path turns them off."""
import os
import runpy
import sys
import unittest
from unittest import mock

from jaeger_avatar import __main__ as launcher

KEYS = ('JAEGER_AGENT_NO_TOOLS', 'JAEGER_AGENT_NO_SKILLS')


class LauncherTest(unittest.TestCase):
    def launch(self, **env):
        with mock.patch.dict(os.environ, env), mock.patch.object(runpy, 'run_path'), \
                mock.patch.object(sys, 'argv', ['jaeger_avatar']), mock.patch.object(sys, 'path', list(sys.path)):
            for key in KEYS: os.environ.pop(key, None)
            launcher.main()
            return [os.environ.get(key) for key in KEYS]

    def test_the_voice_loop_keeps_the_agents_tools(self):
        self.assertEqual(self.launch(JAEGER_AVATAR_LOOP='1'), [None, None])

    def test_the_old_path_runs_the_agent_without_tools(self):
        self.assertEqual(self.launch(JAEGER_AVATAR_LOOP='0'), ['1', '1'])


if __name__ == '__main__':
    unittest.main()
