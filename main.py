#!/usr/bin/env python3
"""The main app, launched the way Mochi's was: `python3 main.py` from the repository.

It is `./run.sh` exactly — the venvs are made on first run, then the app opens in
its own window (`--browser` serves for a browser instead; `--scripted` skips the
agent; `--port` picks the port). One launcher, two spellings.
"""
import os
import sys

os.execv('/bin/sh', ['/bin/sh', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'run.sh'), *sys.argv[1:]])
