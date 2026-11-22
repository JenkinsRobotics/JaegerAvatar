"""A character sheet as words: everything a pack says about who a character is reaches whoever plays it.

Before November 22, 2026 only the expression traits at the far ends did (0.7 and up, 0.15 and down): a dial moved from
30% to 60% changed nothing, and the personality model, the ability scores, the interests, the mannerisms, the habits and
the ideals were never said at all.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from jaeger_avatar.character import EXPRESSION, MANNER, dynamics, manner, profile, who  # noqa: E402


def told(**traits):
    return profile({'traits': traits})


def how(**dials):
    return manner({'traits': {'expression': dials}})


class MannerTest(unittest.TestCase):
    """Her expression dials (humor, sarcasm, warmth...) are her manner: rules the agent says with each turn, which a small model follows."""

    def test_turning_a_dial_changes_what_she_is_told_to_do(self):
        for trait in EXPRESSION:
            low, middle, high = how(**{trait: 0.1}), how(**{trait: 0.5}), how(**{trait: 0.9})
            self.assertEqual(middle, '', trait)                                  # in the middle the sheet speaks for her
            self.assertTrue(low and high and low != high, trait)
            self.assertEqual((low, high), MANNER[trait])
        self.assertNotEqual(how(humor=0.3), how(humor=0.6))                      # 30% and 60% are not the same character
        self.assertEqual(how(humor=0.7), how(humor=1.0))                         # one rule a side: a small model has no finer step

    def test_each_rule_is_something_a_reply_can_be_checked_against(self):
        self.assertIn('no contractions', how(formality=0.9)); self.assertIn('no exclamation marks', how(formality=0.9))
        self.assertIn('at most ten words', how(verbosity=0.0))
        self.assertIn('Do not joke', how(humor=0.1)); self.assertIn('joke or a pun in most replies', how(humor=0.9))
        self.assertIn('Never be sarcastic', how(sarcasm=0.1)); self.assertIn('deadpan', how(sarcasm=0.9))

    def test_several_dials_are_several_rules_in_the_sheets_order(self):
        self.assertEqual(how(sarcasm=0.9, warmth=0.5, verbosity=0.1), MANNER['sarcasm'][1] + ' ' + MANNER['verbosity'][0])

    def test_a_dial_with_no_rule_or_no_number_says_nothing(self):
        self.assertEqual(how(whimsy=0.9), '')
        for bad in ('high', None, float('nan'), True):
            self.assertEqual(how(humor=bad), '', bad)
        self.assertEqual(how(humor=7), MANNER['humor'][1])                       # past the end of the dial is the end of the dial

    def test_her_manner_is_not_in_the_middle_of_the_sheet(self):
        """Said there, as numbers and adjectives, it changed nothing (50 turns, 2026-11-22). The agent says it with each turn."""
        self.assertEqual(told(expression={'humor': 0.9}), '')


class PersonalityTest(unittest.TestCase):
    def test_who_she_is_is_said_where_she_is_far_from_the_middle(self):
        text = told(hexaco={'extraversion': 0.9, 'neuroticism': 0.1, 'openness': 0.5})
        self.assertIn('outgoing', text); self.assertIn('calm', text)
        self.assertNotIn('curious', text); self.assertNotIn('familiar', text)   # the middle says nothing
        self.assertIn('quiet', told(hexaco={'extraversion': 0.1}))
        self.assertNotEqual(told(hexaco={'extraversion': 0.75}), told(hexaco={'extraversion': 0.95}))   # somewhat, or very

    def test_what_she_loves_and_what_she_knows_little_about(self):
        text = told(domains={'nature': 0.9, 'art': 0.7, 'combat': 0.05, 'science': 0.4})
        self.assertIn('nature', text.split('know little')[0]); self.assertIn('art', text.split('know little')[0])
        self.assertIn('combat', text.split('know little')[1])
        self.assertNotIn('science', text)

    def test_how_she_sees_herself(self):
        text = told(special={'charisma': 0.9, 'strength': 0.1, 'luck': 0.5})
        self.assertIn('charming', text); self.assertIn('weak', text); self.assertNotIn('luck', text)


class SheetTest(unittest.TestCase):
    SHEET = {'identity': {'role': 'a small companion robot', 'voice_tone': 'bright'},
             'prompt': {'custom_instructions': 'Stay curious and kind.', 'speech_patterns': ['Short questions']},
             'lore': {'quotes': ['Ooh!'], 'mannerisms': ['Tilts its head when curious', 'Bounces when excited', 'Asks why a lot', 'Hums'],
                      'behaviors': ['Offers to help eagerly'], 'ideals': ['Kindness to everyone']},
             'traits': {'expression': {'humor': 0.7}, 'hexaco': {'agreeableness': 0.95}}}

    def test_what_she_does_and_believes_in_is_said(self):
        text = profile(self.SHEET)
        for part in ('You are a small companion robot.', 'Stay curious and kind.', 'Your voice: bright.', 'Short questions', 'Ooh!',
                     'Offers to help eagerly', 'Kindness to everyone', 'very easygoing'):
            self.assertIn(part, text)

    def test_her_mannerisms_are_not_put_into_words(self):
        """Told "flicks her cat ears when excited", the model wrote it into its replies as a stage direction (5 of 5, 2026-11-22)."""
        self.assertNotIn('Tilts its head', profile(self.SHEET)); self.assertNotIn('mannerisms', profile(self.SHEET).lower())

    def test_a_sheet_with_nothing_in_it_says_nothing(self):
        self.assertEqual(profile({}), '')
        self.assertEqual(who({}, 'Mochi'), 'You are Mochi, an AI character. ')


class DynamicsTest(unittest.TestCase):
    def test_how_lively_her_body_is_comes_from_who_she_is(self):
        """The page's Expression dial (0.5 to 1.5) starts where the character's own liveliness puts it."""
        self.assertEqual(dynamics({}), 1.0)                                     # a sheet that says nothing: as before
        lively = dynamics({'traits': {'hexaco': {'extraversion': 0.95}, 'expression': {'warmth': 1.0, 'humor': 0.9}}})
        quiet = dynamics({'traits': {'hexaco': {'extraversion': 0.1}, 'expression': {'warmth': 0.2, 'humor': 0.1}}})
        self.assertGreater(lively, 1.15); self.assertLess(quiet, 0.85)
        self.assertTrue(0.5 <= quiet < lively <= 1.5)
        self.assertEqual(dynamics({'performance': {'energy': 1.4}, 'traits': {'hexaco': {'extraversion': 0.1}}}), 1.4)   # a pack that says it outright


if __name__ == '__main__':
    unittest.main()
