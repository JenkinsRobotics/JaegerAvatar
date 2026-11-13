"""The agent's hands on the avatar: one tool, any transport.

The tool keeps no list of its own. It passes what the agent asked for to the
body's control link (avatar-control/v1) and hands a refusal back with what
this body offers, so the agent can pick again. In the app the transport is
the control link in the same process; on a robot it is whatever reaches the
body. Register it with the agent's own tool registry:

    register_tool_from_function(avatar_tool(send), name='avatar')
"""
from .control import ControlError

HOLD_MS = 10000   # ponytail: one hold time for a feeling, a move or a look; per call when a body needs it
LOOK = {'left': (-1, 0), 'right': (1, 0), 'up': (0, 1), 'down': (0, -1), 'center': (0, 0)}


def link_transport(link, token):
    """send(op, value, ttl_ms) over a ControlLink in this process."""
    def send(op, value, ttl_ms):
        body = link.controller
        if op == 'offers':   # not a move: what the body on stage can be told, so a scene's moves are checked before it starts
            return {'ok': True, 'offers': body.manifest['capabilities']} if body else {'ok': False, 'error': 'No avatar attached'}
        try:
            link.command({'op': op, 'value': value, 'ttl_ms': ttl_ms}, token)
            return {'ok': True}
        except ControlError as e:
            return {'ok': False, 'error': str(e), 'offers': body.manifest['capabilities'] if body else {}}
    return send


def fitted(call, offers):
    """A scene's call (the avatar tool's emotion, action, look, hold) as this body can make it, and what was left out,
    each with what the body does offer, in words for whoever wrote the scene."""
    left = []
    emotion, action, look = (str(call.get(k, '')).strip() for k in ('emotion', 'action', 'look'))
    moves = [*offers.get('actions', []), *offers.get('reactions', [])]
    if emotion and emotion not in offers.get('emotions', []):
        left.append(('emotion', f"emotion {emotion} (it shows: {', '.join(offers.get('emotions', []))})"))
    if action and action not in moves:
        left.append(('action', f"action {action} (it does: {', '.join(moves)})"))
    if look and not all(w in LOOK for w in look.lower().replace('-', ' ').split()):
        left.append(('look', f"look {look} (left, right, up, down or center)"))
    left += [(name, f'{name} (a move is an emotion, an action or a look)') for name in call if name not in ('emotion', 'action', 'look', 'hold')]
    gone = {name for name, _ in left}
    return {k: v for k, v in call.items() if k not in gone}, [why for _, why in left]


def avatar_tool(send):
    """The tool function. send(op, value, ttl_ms) returns {'ok': True} or {'ok': False, 'error', 'offers'}."""
    def avatar(emotion: str = '', action: str = '', look: str = '') -> dict:
        """Move your avatar body: show a feeling, make a move, or look somewhere.

        emotion: a feeling to show on the face; it holds for about ten seconds.
        action: a gesture or reaction to perform once.
        look: where to look as the viewer sees it: left, right, up, down or center; two may combine ("up left").
        Use only the names this body offers. A refusal lists them.
        """
        did, errors, offers = [], [], {}
        emotion, action, look = ('' if str(v).strip().lower() in ('none', 'null') else v for v in (emotion, action, look))   # a small model fills a slot it does not want

        def tell(label, *tries):
            first = None
            for op, value in tries:
                answer = send(op, value, HOLD_MS)
                if answer.get('ok'):
                    did.append(label)
                    return
                first = first or answer
            errors.append(f"{label}: {first.get('error', 'refused')}")
            offers.update(first.get('offers') or {})

        if emotion:
            tell(f'emotion {emotion}', ('emotion', emotion))
        if action:
            tell(f'action {action}', ('act', action), ('reaction', action))
        if look:
            words = look.lower().replace('-', ' ').split()
            if words and all(w in LOOK for w in words):
                tell(f'look {look}', ('gaze', [max(-1, min(1, sum(LOOK[w][i] for w in words))) for i in (0, 1)]))
            else:
                errors.append(f'look {look}: use ' + ', '.join(LOOK))
        if not (did or errors):
            errors.append('Nothing asked: give an emotion, an action or a look')
        out = {'ok': not errors, 'did': did}
        if errors:
            out['errors'] = errors
        if offers:
            out['offers'] = offers
        return out
    return avatar


def scene_tool(stage):
    """The tool function for a scene the agent writes itself. stage(script) hands the script to the agent's own
    scene performer, to play once this reply's words are spoken; it raises ValueError naming a step it cannot read,
    and returns what was left out because this body cannot do it (see fitted).
    Registered as a performance, the agent ends the turn on it: the scene is the reply, and a refused script
    goes back to the model to fix.

        register_tool_from_function(scene_tool(engine.stage), name='scene', side_effect='performance')
    """
    def scene(script: str) -> dict:
        """Perform a scripted scene with your avatar body: lines you speak, pauses, and moves timed to them. Use it when asked to act something out, or to do things in a set order or for a set time. The scene is your reply.

        script: steps in order, split by " | ".
        say <line>: speak a line. wait <seconds>: stay quiet.
        emotion <name>, action <name>, look <left, right, up, down or center>: a move; it happens as the next line or wait starts.
        hold <seconds>: keep the moves before it that long before going on.
        on <word>: put the moves before it on that word of the line just said.
        Example: "look left | hold 3 | look center | emotion joy | say So, what did you do today? | action bow | on today"
        """
        try:
            left = stage(script)
        except ValueError as exc:
            return {'ok': False, 'error': str(exc)}
        return {'ok': True, 'note': 'The scene plays now' + (', without what this body cannot do: ' + '; '.join(left) if left else '') + '.'}
    return scene
