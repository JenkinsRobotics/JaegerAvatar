"""A character sheet as words: who a character is, for whoever will play it.

The sheet is pack data (a profile's `character`, or the character.yaml a bundle carries). What a character in a body
is then told about replying and about its body is the agent's to write (jaeger-module-agent, jaeger_agent/body/persona.py).
"""


def profile(character):
    """A character sheet (a pack profile's `character`, or the character.yaml a bundle carries) as the words the model is given."""
    prompt, identity, lore = character.get('prompt', {}), character.get('identity', {}), character.get('lore', {})
    lines = [str(prompt[k]) for k in ('custom_instructions', 'soul', 'backstory') if prompt.get(k)]
    if identity.get('role'): lines.insert(0, f"You are {identity['role']}.")
    if identity.get('voice_tone'): lines.append(f"Your voice: {identity['voice_tone']}.")
    if prompt.get('speech_patterns'): lines.append('How you talk: ' + '; '.join(map(str, prompt['speech_patterns'])) + '.')
    if lore.get('quotes'): lines.append('Things you have said: ' + ' / '.join(map(str, lore['quotes'][:4])))
    # Only the traits far from the middle change how a reply sounds; the rest would be noise in the prompt.
    style = character.get('traits', {}).get('expression', {})
    high = [k for k, v in style.items() if isinstance(v, (int, float)) and v >= .7]
    low = [k for k, v in style.items() if isinstance(v, (int, float)) and v <= .15]
    if high or low: lines.append('Style: ' + ', '.join([f'very high {k}' for k in high] + [f'almost no {k}' for k in low]) + '.')
    return '\n'.join(lines)


def who(character, name):
    """The first line of the instructions: an AI character, by name, then its profile."""
    return f"You are {name}, an AI character. {profile(character)}"
