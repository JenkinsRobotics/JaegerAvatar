"""The app's own settings for its agent and its hearing, kept on this machine in app/.cache/settings.json.

Voice settings (which voice, how fast) belong to the viewer and stay in the page.
"""
import json
from pathlib import Path

# faster-whisper model names, with roughly what the first use downloads.
WHISPER = {'tiny.en': '75 MB', 'base.en': '140 MB', 'small.en': '470 MB', 'medium.en': '1.5 GB', 'large-v3-turbo': '1.6 GB'}
LANGUAGES = {'en': 'English', 'auto': 'Detect automatically'}


def defaults(model, stt):
    return {'agent': {'model': model, 'temperature': 0.7, 'max_tokens': 700, 'timeout_s': 60, 'skip_thinking': True}, 'hearing': {'model': stt, 'language': 'en'}}


def _number(v, lo, hi, kind):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and lo <= v <= hi and (kind is float or v == int(v))


def apply(current, patch, models):
    """current plus patch, checked. models: the agent models that can be chosen now. Raises ValueError naming the problem."""
    if not isinstance(patch, dict) or not set(patch) <= {'agent', 'hearing'}:
        raise ValueError('Settings are {agent?, hearing?}')
    a, h = patch.get('agent', {}), patch.get('hearing', {})
    if not (isinstance(a, dict) and set(a) <= set(current['agent']) and isinstance(h, dict) and set(h) <= set(current['hearing'])):
        raise ValueError('Unknown setting')
    if 'model' in a and a['model'] != current['agent']['model'] and a['model'] not in models:
        raise ValueError('That model is not available in LM Studio')
    if 'temperature' in a and not _number(a['temperature'], 0, 1.5, float):
        raise ValueError('Creativity is 0 to 1.5')
    if 'max_tokens' in a and not _number(a['max_tokens'], 100, 4000, int):
        raise ValueError('Longest reply is 100 to 4000 tokens')
    if 'timeout_s' in a and not _number(a['timeout_s'], 5, 600, float):
        raise ValueError('Timeout is 5 to 600 seconds')
    if 'skip_thinking' in a and not isinstance(a['skip_thinking'], bool):
        raise ValueError('Skip thinking is on or off')
    if 'model' in h and h['model'] not in WHISPER:
        raise ValueError('Unknown speech model')
    if 'language' in h and h['language'] not in LANGUAGES:
        raise ValueError('Unknown language')
    out = {'agent': {**current['agent'], **a}, 'hearing': {**current['hearing'], **h}}
    out['agent']['max_tokens'] = int(out['agent']['max_tokens'])
    if out['hearing']['model'].endswith('.en'):
        out['hearing']['language'] = 'en'   # English-only models can't detect a language
    return out


def load(path, base):
    """Saved settings over base; anything missing or broken falls back to base."""
    try:
        saved = json.loads(path.read_text())
        return apply(base, saved, [saved.get('agent', {}).get('model')])
    except (OSError, ValueError, TypeError, AttributeError):
        return base


def save(path, values):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(values, indent=2) + '\n')


if __name__ == '__main__':   # python app/settings.py: fails if the checks stop holding
    base = defaults('gemma', 'base.en')
    assert apply(base, {'agent': {'temperature': 1.2}}, [])['agent']['temperature'] == 1.2
    assert apply(base, {'agent': {'model': 'big'}}, ['big'])['agent']['model'] == 'big'
    assert apply(base, {'hearing': {'model': 'large-v3-turbo', 'language': 'auto'}}, [])['hearing']['language'] == 'auto'
    assert apply(base, {'hearing': {'language': 'auto'}}, [])['hearing']['language'] == 'en'
    assert apply(base, {'agent': {'skip_thinking': False}}, [])['agent']['skip_thinking'] is False
    assert load(Path('/nonexistent'), base) == base
    for bad in ({'agent': {'model': 'nope'}}, {'agent': {'temperature': 2}}, {'agent': {'temperature': True}},
                {'agent': {'max_tokens': 99}}, {'agent': {'max_tokens': 700.5}}, {'agent': {'tools': 1}},
                {'hearing': {'model': '../x'}}, {'voice': {}}, [], {'agent': []}, {'agent': {'skip_thinking': 1}}, {'agent': {'timeout_s': 1}}):
        try:
            apply(base, bad, ['big'])
        except ValueError:
            continue
        raise AssertionError(f'accepted {bad}')
    print('ok')
