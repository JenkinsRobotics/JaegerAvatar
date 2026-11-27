# Virtual hardware

Stand-ins for the real devices, carried over from the archived Mochi repository's
virtual LED display — re-homed onto this app's real device contract instead of a
Qt bus. Each one reads `/hardware/stream/<device>/<output>`: the exact plain-pixel
stream a physical panel decodes (`app/display_stream.py` — an 8-byte header of
width, height and frame number, then red-green-blue rows from the top left).
JP01 is the real integration; these windows light the same bytes it will.

Python's own tkinter, no installs:

```sh
python3 virtual-hardware/display.py jp01/face            # 64 x 64 LED panel, zoomed
python3 virtual-hardware/display.py jp01/ringL           # 24 LEDs, drawn as the physical ring
python3 virtual-hardware/display.py jp01/ringR
python3 virtual-hardware/display.py mochi/face --fps 15  # 256 x 256 screen
python3 virtual-hardware/display.py jp01/face --probe    # no window: one real frame, printed
```

The app must be running (`./run.sh` or `python3 main.py`) with the matching body
on stage: the server tells the page which outputs are being read, and only those
are drawn and posted — a stream exists only while something watches it, virtual
or real. The in-app equivalents live on the Outputs page; a device's own wire
form (JP01's `FM[...]` matrix protocol) remains the device driver's job.
