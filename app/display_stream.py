"""The device streams, outside the browser: what a robot reads to light its own panel.

The page draws each device output at its own size (app/web/hardware.js: JP01's 64 x 64 face and its two 24-LED
rings) and posts the frames here while someone is reading that output. A reader gets plain pixels. Each frame is
8 bytes (width and height as 16-bit numbers, then a frame number as 32-bit, little-endian) followed by
width x height x 3 bytes of red, green, blue, row by row from the top left. Turning that into a device's own wire
form (JP01: FM[...] to its matrix controller) is the device driver's job, not the avatar's.
"""
import struct
import threading
import time
from collections import Counter

LIMIT = 256 * 256 * 4                     # the largest frame the page may post: Mochi's 256 x 256 screen, as RGBA
frames, readers, new = {}, Counter(), threading.Condition()


def put(key, w, h, rgba):
    """A frame from the page, as RGBA. Returns whether anyone is reading that output."""
    if not 0 < len(rgba) <= LIMIT or w * h * 4 != len(rgba):
        raise ValueError('The frame is not width x height x 4 bytes')
    rgb = bytearray(w * h * 3)
    rgb[0::3], rgb[1::3], rgb[2::3] = rgba[0::4], rgba[1::4], rgba[2::4]
    with new:
        frames[key] = (frames.get(key, (0,))[0] + 1, w, h, bytes(rgb))
        new.notify_all()
        return readers[key] > 0


def wanted():
    """The outputs someone is reading: the page posts only these."""
    with new:
        return sorted(key for key, count in readers.items() if count > 0)


def read(key, fps=30, still=1.0):
    """Frames for one reader: always the newest, at most `fps` a second. When nothing new has come for `still`
    seconds the last frame is sent again, so a panel that missed it recovers and a reader that has gone is noticed;
    while there is no picture yet that is an empty frame (0 x 0)."""
    with new:
        readers[key] += 1
    try:
        seen = -1
        while True:
            with new:
                new.wait_for(lambda: frames.get(key, (0,))[0] != seen, timeout=still)
                seen, w, h, rgb = frames.get(key, (0, 0, 0, b''))
            yield struct.pack('<HHI', w, h, seen) + rgb
            time.sleep(1 / fps)
    finally:
        with new:
            readers[key] -= 1
