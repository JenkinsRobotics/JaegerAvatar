"""The device streams outside the browser: plain pixels a robot can read to light its own panel."""
import struct
import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
import display_stream as stream


def frame(reader):
    """One frame off a reader: (width, height, number, rgb bytes)."""
    chunk = next(reader)
    return (*struct.unpack('<HHI', chunk[:8]), chunk[8:])


class DisplayStreamTest(unittest.TestCase):
    def test_a_reader_gets_the_pages_frame_as_rgb_rows(self):
        reader = stream.read('t1/face', fps=1000)
        self.addCleanup(reader.close)
        self.assertEqual(frame(reader), (0, 0, 0, b''))                    # nobody has drawn anything yet: an empty frame, not a hang
        self.assertIn('t1/face', stream.wanted())                           # the page is told someone is reading
        self.assertTrue(stream.put('t1/face', 2, 1, bytes([1, 2, 3, 255, 4, 5, 6, 255])))
        self.assertEqual(frame(reader), (2, 1, 1, bytes([1, 2, 3, 4, 5, 6])))   # alpha dropped: the device wants red, green, blue
        stream.put('t1/face', 2, 1, bytes(8)); stream.put('t1/face', 2, 1, bytes([9] * 8))
        self.assertEqual(frame(reader), (2, 1, 3, bytes([9] * 6)))          # a slow reader gets the newest frame, not a backlog
        reader.close()
        self.assertNotIn('t1/face', stream.wanted())                        # and the page stops sending when it leaves

    def test_a_still_picture_is_sent_again_so_a_panel_that_missed_it_recovers(self):
        stream.put('t2/face', 1, 1, bytes([7, 7, 7, 255]))
        reader = stream.read('t2/face', fps=1000, still=0.01)
        self.addCleanup(reader.close)
        self.assertEqual([frame(reader), frame(reader)], [(1, 1, 1, bytes([7, 7, 7]))] * 2)

    def test_a_frame_of_the_wrong_size_is_refused(self):
        with self.assertRaises(ValueError): stream.put('t3/face', 2, 2, bytes(8))
        with self.assertRaises(ValueError): stream.put('t3/face', 0, 0, b'')
        with self.assertRaises(ValueError): stream.put('t3/face', 1024, 1024, bytes(1024 * 1024 * 4))
        self.assertFalse(stream.put('t3/face', 1, 1, bytes(4)))             # taken, but nobody is reading it

    def test_a_waiting_reader_wakes_when_a_frame_arrives(self):
        reader = stream.read('t4/face', fps=1000, still=5)
        self.addCleanup(reader.close)
        frame(reader)
        threading.Timer(0.05, stream.put, ('t4/face', 1, 1, bytes([1, 1, 1, 255]))).start()
        self.assertEqual(frame(reader)[2], 1)


if __name__ == '__main__':
    unittest.main()
