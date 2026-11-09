import unittest

from jaeger_avatar.packs import PackError, check_look


class PackLookTest(unittest.TestCase):
    def test_accepts_filters_and_anime_palette(self):
        check_look({"adapter": "nori-led", "look": {"filter": {"hue": 35, "saturate": 1.4}}})
        check_look({"adapter": "nori-anime", "look": {"palette": {"rim": [.6, .3, 1], "hair": [[.1, .1, .1], [0, 0, 0]]}}})

    def test_rejects_code_unknown_keys_and_out_of_range_colours(self):
        for render in ({"adapter": "nori-led", "look": {"filter": {"url": 1}}},
                       {"adapter": "nori-led", "look": {"filter": {"hue": "1); alert(1"}}},
                       {"adapter": "nori-led", "look": {"palette": {"rim": [1, 1, 1]}}},
                       {"adapter": "nori-anime", "look": {"palette": {"locks": [1, 1, 1]}}},
                       {"adapter": "nori-anime", "look": {"palette": {"rim": [2, 0, 0]}}},
                       {"adapter": "nori-anime", "look": {"palette": {"hair": [.1, .1, .1]}}}):
            with self.assertRaises(PackError):
                check_look(render)


if __name__ == "__main__":
    unittest.main()
