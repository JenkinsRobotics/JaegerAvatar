"""The language-model files (GGUF) on this machine. The agent loads one inside its own process with llama.cpp:
no model server and no HTTP. LM Studio's folder is read only because the files are already there."""
import os
from pathlib import Path
import struct

ROOTS = [Path(p).expanduser() for p in os.environ.get('JAEGER_MODEL_DIRS', '~/.lmstudio/models:~/models').split(':')]
DEFAULT = os.environ.get('GEMMA_MODEL', 'gemma-4-E4B-it-Q4_K_M')   # the file's name without .gguf


def _is_chat_model(path):
    """True when the file's header says general.type = model (not a vision add-on or a part of another model)."""
    # ponytail: reads only the first two header entries, where every file on this Mac keeps it; older GGUF files
    # that lack general.type are skipped. Read the whole header if such a model ever needs listing.
    try:
        with open(path, 'rb') as f:
            if f.read(4) != b'GGUF':
                return False
            count = struct.unpack('<IQQ', f.read(20))[2]
            text = lambda: f.read(struct.unpack('<Q', f.read(8))[0]).decode()
            for _ in range(min(count, 2)):
                key = text()
                if struct.unpack('<I', f.read(4))[0] != 8:   # 8 = a string value
                    return False
                if (key, text()) == ('general.type', 'model'):
                    return True
    except (OSError, struct.error, UnicodeDecodeError):
        pass
    return False


def found(roots=None):
    """{name: path} of the chat models on this machine. The first folder wins a name."""
    out = {}
    for root in roots or ROOTS:
        for path in sorted(root.rglob('*.gguf')):
            if path.stem not in out and _is_chat_model(path):
                out[path.stem] = path
    return out


def pick(name, models):
    """The model to load: the one asked for if its file is here, else the default, else any that is here, else None."""
    return name if name in models else DEFAULT if DEFAULT in models else next(iter(models), None)


if __name__ == '__main__':   # python app/models.py: fails if the checks stop holding
    import tempfile
    def gguf(path, *pairs):
        s = lambda t: struct.pack('<Q', len(t)) + t.encode()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'GGUF' + struct.pack('<IQQ', 3, 0, len(pairs)) + b''.join(s(k) + struct.pack('<I', 8) + s(v) for k, v in pairs))
    with tempfile.TemporaryDirectory() as d:
        a, b = Path(d, 'a'), Path(d, 'b')
        gguf(a / 'x/chat-Q4.gguf', ('general.architecture', 'gemma4'), ('general.type', 'model'))
        gguf(a / 'x/mmproj-chat.gguf', ('general.architecture', 'clip'), ('general.type', 'mmproj'))   # a vision add-on
        gguf(a / 'x/voice.gguf', ('general.architecture', 'hifigan2'))                                # part of another model
        (a / 'x/broken.gguf').write_bytes(b'nope')
        gguf(b / 'chat-Q4.gguf', ('general.architecture', 'gemma4'), ('general.type', 'model'))        # same name, later folder
        gguf(b / 'big.gguf', ('general.architecture', 'qwen3'), ('general.type', 'model'))
        m = found([a, b, Path(d, 'missing')])
        assert m == {'chat-Q4': a / 'x/chat-Q4.gguf', 'big': b / 'big.gguf'}, m
        assert pick('big', m) == 'big' and pick('google/gemma-4-e4b', m) == 'chat-Q4' and pick('x', {}) is None
        assert pick('x', {DEFAULT: 1, 'big': 2}) == DEFAULT
    print('ok')
