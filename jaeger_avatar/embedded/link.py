"""The control link: an agent outside the avatar sends avatar-control/v1 commands to the body on stage.

The page that shows the avatar attaches with the body's declared controls and polls the state; an external client
sends commands with the token. Commands are refused while no page is polling, so nothing is accepted into the void.
Speech audio is uploaded here as a clip the host's speaker plays; the avatar only times its mouth to it.
"""
import hmac
import re
import secrets
import threading
import time
from collections import OrderedDict

from .control import Controller, ControlError

ATTACH_MS = 2000            # a page that hasn't polled for this long is gone
CLIPS, CLIP_BYTES = 16, 10 * 1024 * 1024
NAME = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


class ControlLink:
    def __init__(self, token, clock=None):
        self.token = token
        self.clock = clock or (lambda: time.time() * 1000)
        self.lock = threading.Lock()
        self.controller = None
        self.polled = -1e18
        self.clips = OrderedDict()

    def _allowed(self, token):
        if not isinstance(token, str) or not hmac.compare_digest(token.encode(), self.token.encode()):
            raise ControlError('Not allowed')

    def attach(self, body):
        """The page says which body is on stage and what it can be told to do. A new session every time."""
        caps = body.get('capabilities') if isinstance(body, dict) else None
        if not (isinstance(body.get('avatar') if isinstance(body, dict) else None, str) and NAME.match(body['avatar'])
                and isinstance(caps, dict) and set(caps) <= {'emotions', 'reactions', 'actions'}
                and all(isinstance(v, list) and len(v) <= 64 and all(isinstance(n, str) and NAME.match(n) for n in v) for v in caps.values())):
            raise ControlError('Attach needs an avatar name and its emotions, reactions and actions')
        with self.lock:
            self.controller = Controller({'avatar': body['avatar'], 'capabilities': {
                'emotions': caps.get('emotions', []), 'reactions': caps.get('reactions', []), 'actions': caps.get('actions', [])}}, clock=self.clock)
            self.polled = self.clock()
            return {'session': self.controller.session}

    def command(self, body, token):
        self._allowed(token)
        if not isinstance(body, dict) or not {'op', 'value'} <= set(body) or set(body) - {'op', 'value', 'ttl_ms'}:
            raise ControlError('A command is {"op", "value", "ttl_ms"?}')
        with self.lock:
            c = self.controller
            if c is None or self.clock() - self.polled > ATTACH_MS:
                raise ControlError('No avatar attached')
        return c.send(body['op'], body['value'], body.get('ttl_ms', 5000))

    def state(self, session=None):
        """The page that attached polls with its session; only that keeps the link alive. The newest page wins: an
        older tab is told the link is taken, and may attach again once the newer one has gone."""
        with self.lock:
            c = self.controller
            if c is None:
                return {'attached': False}
            if session != c.session:
                return {'attached': False, 'taken': True} if self.clock() - self.polled <= ATTACH_MS else {'attached': False}
            self.polled = self.clock()
        return {**c.snapshot(), 'attached': True}

    def put_audio(self, wav, token):
        self._allowed(token)
        if not isinstance(wav, (bytes, bytearray)) or not 0 < len(wav) <= CLIP_BYTES:
            raise ControlError('A clip is 1 byte to 10 MB of audio')
        clip = secrets.token_hex(6)
        with self.lock:
            self.clips[clip] = bytes(wav)
            while len(self.clips) > CLIPS:
                self.clips.popitem(last=False)
        return '/control/audio/' + clip

    def audio(self, clip):
        with self.lock:
            return self.clips.get(clip)
