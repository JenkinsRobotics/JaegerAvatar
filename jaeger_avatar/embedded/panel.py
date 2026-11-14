"""The avatar's face for a robot's own panel, with no browser: commands in, the panel's pixels out.

    controller = Controller(manifest)            # takes avatar-control/v1 commands: emotion, reaction, gaze, speaking, jaw
    panel = Panel(controller)                    # starts the face program (Node)
    for w, h, number, rgb in panel.frames():     # the 64 x 64 face, then the 24-LED ring, every tick
        ...                                      # hand rgb to the display driver (JP01: build_matrix_frame(rgb.hex()))

The face itself is the page's own arithmetic (kin/panel.js); this only starts it, feeds it the controller's state and
reads its frames. A host that stops (or closes the panel) ends the program.
"""
import json
import struct
import subprocess
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
# In an exported bundle the face program sits beside this file; in the repository it is the page's own copy.
SCRIPT = next((p for p in (HERE / 'panel/kin/panel-run.mjs', HERE.parents[1] / 'app/web/kin/panel-run.mjs') if p.exists()), None)


class Panel:
    def __init__(self, controller, face='mochi_wave', fps=30, node='node', script=SCRIPT):
        self.controller, self.fps = controller, fps
        self.process = subprocess.Popen([node, str(script), '--face', face, '--fps', str(fps)],
                                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        threading.Thread(target=self._feed, daemon=True).start()

    def _feed(self):
        """The controller's state, `fps` times a second: commands expire on their own there, so the face always has the truth."""
        try:
            while self.process.poll() is None:
                self.process.stdin.write((json.dumps(self.controller.snapshot()) + '\n').encode())
                self.process.stdin.flush()
                time.sleep(1 / self.fps)
        except (OSError, ValueError):   # the program ended, or the panel was closed
            pass

    def frames(self):
        """(width, height, number, rgb bytes) for each output of each tick: the face, then the ring."""
        out = self.process.stdout
        while len(head := out.read(8)) == 8:
            w, h, number = struct.unpack('<HHI', head)
            yield w, h, number, out.read(w * h * 3)
        if self.process.wait() not in (0, -15):   # it stopped by itself: say why
            raise RuntimeError(self.process.stderr.read().decode().strip() or 'The face program stopped')

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            self.process.wait(5)
        for pipe in (self.process.stdin, self.process.stdout, self.process.stderr):
            pipe.close()
