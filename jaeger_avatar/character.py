"""A character sheet as words: who a character is, for whoever will play it.

The sheet is pack data (a profile's `character`, or the character.yaml a bundle carries). What a character in a body
is then told about replying and about its body is the agent's to write (jaeger-module-agent, jaeger_agent/body/persona.py).

Everything the sheet says is said: its role, its instructions and backstory, how it talks, what it tends to do and
believes in, and its traits. Traits are dials from 0 to 1:

    expression   how she talks: humor, sarcasm, warmth and the rest. These are her manner (manner()): short rules a
                 reply can be checked against, one for each dial near an end. They are not in the sheet's words. The
                 agent says them with each turn, so a dial turned changes her next reply in the same conversation.
                 Measured on gemma-4-E4B, November 22, 2026, same asks: as a number and an adjective in the sheet a
                 dial changed nothing; as rules at the end of the system prompt, one was sometimes followed and
                 three at once were not; said with each turn they were ("no contractions, no exclamation marks":
                 5 and 8 in five replies became 0 and 0; "at most ten words": 23 words a reply became 7). With six
                 rules at once the few-words rule held less well (about 17 words). A dial in the middle says nothing.
    hexaco       who she is. Said only where she is far from the middle.
    domains      what she loves and what she knows little about.
    special      how she sees herself.

Her mannerisms are left out of the words on purpose: told "flicks her cat ears when excited", the model wrote it into
its replies as a stage direction. They belong in her body's moves.
"""
import math

# Her manner: what each expression dial asks of her toward its low end and its high end. Each is something a reply
# can be checked against, because that is what a small model follows.
MANNER = {
    'humor': ('Do not joke or play with words; stay serious.', 'Be playful: put a small joke or a pun in most replies.'),
    'sarcasm': ('Never be sarcastic or ironic; mean exactly what you say.', 'Be dry and sarcastic: deadpan, saying the opposite of what you mean for effect.'),
    'warmth': ('Be cool and distant: no endearments, no gushing, no comforting.', 'Be warm and affectionate: show you care about them in every reply.'),
    'verbosity': ('Use very few words: one short sentence of at most ten words.', 'Be talkative: three or four sentences, with a detail or two.'),
    'formality': ('Be very casual: contractions, slang and loose sentences.', 'Speak formally: full sentences, no contractions, no slang, no exclamation marks, no emoji.'),
    'directness': ('Be gentle and roundabout: soften what you say and suggest rather than state.', 'Be blunt: say exactly what you think, with no cushioning.'),
    'empathy': ('Do not talk about feelings; stick to the facts.', 'Answer their feelings first, before anything else.'),
    'aggression': ('Never be harsh or hostile.', 'Be combative: push back, argue and needle them.'),
}
EXPRESSION = tuple(MANNER)
# Who she is (HEXACO), far from the middle: (low, high).
HEXACO = {
    'openness': ('set in your ways and doubtful of new ideas', 'curious and fond of new ideas'),
    'conscientiousness': ('loose, spontaneous and careless with details', 'careful, orderly and precise'),
    'extraversion': ('quiet and reserved', 'outgoing, energetic and talkative'),
    'agreeableness': ('stubborn and quick to argue', 'easygoing, quick to agree and to forgive'),
    'neuroticism': ('calm and hard to rattle', 'anxious and quick to worry'),
    'honesty_humility': ('boastful and fond of showing off', 'modest and sincere'),
}
# How she sees herself (ability scores), far from the middle: (low, high).
SPECIAL = {
    'strength': ('weak', 'strong'), 'perception': ('unobservant', 'sharp-eyed'), 'endurance': ('quick to tire', 'tireless'),
    'charisma': ('awkward with people', 'charming'), 'intelligence': ('simple in your thinking', 'clever'), 'agility': ('clumsy', 'quick and nimble'),
    'luck': ('unlucky', 'lucky'),
}
FAR, VERY = 0.3, 0.12          # a trait this close to an end of its dial is said; this close, it is "very"


def dial(value):
    """A trait's setting, 0 to 1; None for anything that is not a number (a pack's typo is left out, not guessed)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value): return None
    return min(1.0, max(0.0, float(value)))


def dials(group):
    return {str(k): v for k, raw in (group if isinstance(group, dict) else {}).items() if (v := dial(raw)) is not None}


def ends(group, words, very=''):
    """What is said of the traits far from the middle: each one's low or high words."""
    return [(very if min(v, 1 - v) <= VERY else '') + words[name][v >= 0.5]
            for name, v in dials(group).items() if name in words and not FAR < v < 1 - FAR]


def manner(character):
    """Her manner as rules, for the agent to say with each turn: one for each expression dial that is away from the middle (FAR).
    A dial in the middle says nothing, and the rest of the sheet speaks for her."""
    groups = character.get('traits') if isinstance(character.get('traits'), dict) else {}
    return ' '.join(MANNER[name][v >= 0.5] for name, v in dials(groups.get('expression')).items() if name in MANNER and not FAR < v < 1 - FAR)


def traits(character):
    """Who she is, what she loves and how she sees herself, as lines for the model. Her manner is not here: see manner()."""
    groups, lines = character.get('traits') if isinstance(character.get('traits'), dict) else {}, []
    nature = ends(groups.get('hexaco'), HEXACO, very='very ')
    if nature: lines.append('Your nature: ' + '; '.join(nature) + '.')
    interests = dials(groups.get('domains'))
    loves, lacks = [n for n, v in interests.items() if v >= 1 - FAR], [n for n, v in interests.items() if v <= 0.15]
    if loves or lacks:
        lines.append(' '.join(filter(None, [loves and f"You love and know a lot about {', '.join(loves)}.", lacks and f"You know little about {', '.join(lacks)}, and say so."])))
    image = ends(groups.get('special'), SPECIAL)
    if image: lines.append('You see yourself as ' + ', '.join(image) + '.')
    return lines


def profile(character):
    """A character sheet (a pack profile's `character`, or the character.yaml a bundle carries) as the words the model is given."""
    prompt, identity, lore = character.get('prompt', {}), character.get('identity', {}), character.get('lore', {})
    lines = [str(prompt[k]) for k in ('custom_instructions', 'soul', 'backstory') if prompt.get(k)]
    if identity.get('role'): lines.insert(0, f"You are {identity['role']}.")
    if identity.get('voice_tone'): lines.append(f"Your voice: {identity['voice_tone']}.")
    if prompt.get('speech_patterns'): lines.append('How you talk: ' + '; '.join(map(str, prompt['speech_patterns'])) + '.')
    if lore.get('quotes'): lines.append('Things you have said: ' + ' / '.join(map(str, lore['quotes'][:4])))
    for key, lead in (('behaviors', 'What you tend to do'), ('ideals', 'What you believe in')):   # three of each: the prompt stays short
        if isinstance(lore.get(key), list) and lore[key]: lines.append(f"{lead}: " + '; '.join(map(str, lore[key][:3])) + '.')
    return '\n'.join(lines + traits(character))


def who(character, name):
    """The first line of the instructions: an AI character, by name, then its profile."""
    return f"You are {name}, an AI character. {profile(character)}"


def dynamics(character):
    """How lively her body is, as the page's Expression dial takes it (0.5 calm to 1.5 big; 1 is the body as drawn).
    A pack may say it outright (performance.energy); otherwise it follows who she is: outgoing, warm and playful
    characters move more, quiet and cool ones less.
    ponytail: one number from three traits; a dial per kind of motion (gesture size, head, blink) if one number is seen to be too blunt."""
    said = character.get('performance', {}).get('energy') if isinstance(character.get('performance'), dict) else None
    if dial(said) is not None or (isinstance(said, (int, float)) and not isinstance(said, bool) and math.isfinite(said)):
        return round(min(1.5, max(0.5, float(said))), 2)
    groups = character.get('traits') if isinstance(character.get('traits'), dict) else {}
    hexaco, style = dials(groups.get('hexaco')), dials(groups.get('expression'))
    parts = [v for v in (hexaco.get('extraversion'), style.get('warmth'), style.get('humor')) if v is not None]
    return round(0.5 + sum(parts) / len(parts), 2) if parts else 1.0
