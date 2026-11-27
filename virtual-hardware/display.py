#!/usr/bin/env python3
"""A virtual device panel: Mochi's classic virtual LED display, re-homed onto the real stream contract.

It reads the same bytes a physical panel would (app/display_stream.py: 8-byte header, then RGB rows) and
lights its own pixels in a window. The app must be running with the matching body on stage; the server
tells the page an output is being read, and only then are its frames drawn and posted.

  python3 virtual-hardware/display.py jp01/face            # 64 x 64 panel, zoomed
  python3 virtual-hardware/display.py jp01/ringL           # 24 LEDs, drawn as the physical ring
  python3 virtual-hardware/display.py mochi/face --fps 15  # 256 x 256 screen
  python3 virtual-hardware/display.py jp01/face --probe    # no window: wait for one real frame, print it, exit

Python's own tkinter only: no installs. Turning frames into a device's wire form stays the driver's job.
"""
import argparse
import struct
import sys
import time
import urllib.request

HEADER = struct.Struct('<HHI')


def frames(url, timeout=10):
    """The stream's frames, as (w, h, n, rgb). Reconnects when the app restarts."""
    while True:
        try:
            with urllib.request.urlopen(url, timeout=timeout) as stream:
                while True:
                    head = stream.read(HEADER.size)
                    if len(head) < HEADER.size:
                        break
                    w, h, n = HEADER.unpack(head)
                    rgb = stream.read(w * h * 3) if w else b''
                    if w and len(rgb) < w * h * 3:
                        break
                    yield w, h, n, rgb
        except OSError as e:
            print(f'waiting for the app ({e})', file=sys.stderr)
            time.sleep(2)


def probe(url, wait_s=30):
    """One real frame, or a nonzero exit: the runnable check that the stream and its producer are alive."""
    deadline = time.time() + wait_s
    for w, h, n, rgb in frames(url):
        if w and any(rgb):
            print(f'frame {n}: {w} x {h}, {len(rgb)} bytes, first pixel #{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}')
            return 0
        if time.time() > deadline:
            print(f'no picture after {wait_s}s: is the app running with this body on stage?', file=sys.stderr)
            return 1
    return 1


def run_window(args, url):
    import tkinter as tk
    root = tk.Tk()
    root.title(f'Virtual {args.key}')
    root.configure(bg='black')
    canvas = tk.Canvas(root, bg='black', highlightthickness=0)
    canvas.pack(fill='both', expand=True)
    state = {'photo': None, 'leds': [], 'size': None}
    feed = frames(url)

    def ring(w, rgb, side):
        """The physical ring: its LEDs on a circle, not a 24 x 1 strip."""
        if state['size'] != (w, 1):
            canvas.config(width=side, height=side)
            canvas.delete('all')
            import math
            r, c, led = side * .42, side / 2, max(4, side // 16)
            state['leds'] = [canvas.create_oval(c + r * math.sin(a) - led / 2, c - r * math.cos(a) - led / 2,
                                                c + r * math.sin(a) + led / 2, c - r * math.cos(a) + led / 2,
                                                outline='') for i in range(w) for a in [2 * 3.14159265 * i / w]]
            state['size'] = (w, 1)
        for i, item in enumerate(state['leds']):
            canvas.itemconfig(item, fill=f'#{rgb[i * 3]:02x}{rgb[i * 3 + 1]:02x}{rgb[i * 3 + 2]:02x}')

    def panel(w, h, rgb, zoom):
        # ponytail: PhotoImage.put + zoom each frame, plenty for 64x64; drop --fps for the 256x256 screen.
        photo = tk.PhotoImage(width=w, height=h)
        photo.put(' '.join('{' + ' '.join(f'#{rgb[p]:02x}{rgb[p + 1]:02x}{rgb[p + 2]:02x}'
                                          for p in range(y * w * 3, (y + 1) * w * 3, 3)) + '}'
                           for y in range(h)))
        state['photo'] = photo.zoom(zoom)   # kept on state: tkinter shows nothing if the image is garbage-collected
        if state['size'] != (w, h):
            canvas.config(width=w * zoom, height=h * zoom)
            canvas.delete('all')
            canvas.create_image(0, 0, anchor='nw', image=state['photo'], tags='frame')
            state['size'] = (w, h)
        else:
            canvas.itemconfig('frame', image=state['photo'])

    def tick():
        try:
            w, h, n, rgb = next(feed)
        except StopIteration:
            return root.destroy()
        if w and h == 1:
            ring(w, rgb, args.ring_size)
        elif w:
            panel(w, h, rgb, args.zoom or max(1, 512 // w))
        root.after(max(1, 1000 // args.fps), tick)

    tick()
    root.mainloop()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('key', help='device/output: jp01/face, jp01/ringL, jp01/ringR, mochi/face')
    ap.add_argument('--url', default='http://127.0.0.1:8790', help='the app (default: %(default)s)')
    ap.add_argument('--fps', type=int, default=30, help='frames a second to ask for (default: %(default)s)')
    ap.add_argument('--zoom', type=int, default=0, help='pixels per LED (default: sized to about 512 px)')
    ap.add_argument('--ring-size', type=int, default=360, help='window size for a ring, px (default: %(default)s)')
    ap.add_argument('--probe', action='store_true', help='no window: wait for one real frame, print it, exit')
    args = ap.parse_args()
    url = f'{args.url}/hardware/stream/{args.key}?fps={args.fps}'
    sys.exit(probe(url) if args.probe else run_window(args, url))


if __name__ == '__main__':
    main()
