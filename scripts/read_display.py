#!/usr/bin/env python3
"""Read a device stream the way a robot would: plain pixels over HTTP, no browser.

    python3 scripts/read_display.py jp01/face --frames 60 --png face.png

Each frame is 8 bytes (width, height, frame number) then width x height x 3 bytes of RGB, row by row
(app/display_stream.py). A page with that character on stage must be open, since the page draws the frames.
On JP01 a frame goes to the matrix as avc01_driver.build_matrix_frame(rgb.hex()).
"""
import argparse
import struct
import time
import urllib.request
import zlib


def frames(url, output, fps=30):
    """(width, height, number, rgb bytes) for each frame, for as long as the server sends them."""
    with urllib.request.urlopen(f'{url}/hardware/stream/{output}?fps={fps}') as stream:
        while len(head := stream.read(8)) == 8:
            w, h, number = struct.unpack('<HHI', head)
            yield w, h, number, stream.read(w * h * 3)


def png(w, h, rgb):
    def chunk(kind, data): return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    rows = b''.join(b'\0' + rgb[y * w * 3:(y + 1) * w * 3] for y in range(h))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')


if __name__ == '__main__':
    args = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    args.add_argument('output', nargs='?', default='jp01/face')
    args.add_argument('--url', default='http://127.0.0.1:8790')
    args.add_argument('--fps', type=float, default=30)
    args.add_argument('--frames', type=int, default=60, help='stop after this many new frames')
    args.add_argument('--png', help='keep the last frame as a PNG')
    args = args.parse_args()
    began, got, seen, last = time.time(), 0, None, None
    for w, h, number, rgb in frames(args.url, args.output, args.fps):
        if not w or number == seen: continue        # no picture yet, or a still picture sent again
        first = first if got else number
        got, seen, last = got + 1, number, (w, h, rgb)
        if got >= args.frames: break
    if last is None: raise SystemExit('No frames came')
    took, (w, h, rgb) = time.time() - began, last
    print(f'{args.output}: {got} frames of {w} x {h} in {took:.1f} s ({got / took:.0f} a second); the page drew {seen - first + 1}; lit pixels in the last one: {sum(1 for i in range(0, len(rgb), 3) if max(rgb[i:i + 3]) > 40)}')
    if args.png: open(args.png, 'wb').write(png(w, h, rgb))
