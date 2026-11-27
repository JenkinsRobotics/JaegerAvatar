"""Launch the local Jaeger Avatar application: in its own desktop window, or with --browser for a browser tab."""
import argparse
import os
from pathlib import Path
import runpy
import subprocess
import sys
import time
import urllib.request


def server_command(argv):
    """The window's server: this same app in browser mode, with the flags the window was given."""
    return [sys.executable, '-m', 'jaeger_avatar', '--browser', *argv]


def watch_parent(parent):
    """A window's server stops itself, the way Ctrl-C would (so the agent is closed too), once its window's process is
    gone: closing the window stops it, but a killed window process cannot."""
    import signal
    import threading
    def watch():
        while os.getppid() == parent: time.sleep(0.5)
        os.kill(os.getpid(), signal.SIGTERM)
    threading.Thread(target=watch, daemon=True).start()


def windowed(argv, port):
    """Run the server as a child, show its page in a window, and stop the server when the window closes.
    False when there is no window to open (pywebview not installed): the caller serves for a browser instead."""
    try:
        import webview  # noqa: F401
    except ImportError:
        print('No desktop window (pywebview is not installed): serving for a browser instead.', file=sys.stderr)
        return False
    from .window import open_window
    server = subprocess.Popen(server_command(argv), env={**os.environ, 'JAEGER_AVATAR_WINDOW': str(os.getpid())})
    url = f'http://127.0.0.1:{port}/'
    try:
        for _ in range(300):   # the page is served within seconds; the agent keeps loading behind it
            if server.poll() is not None: return True   # the server stopped (its error is on the terminal)
            try:
                urllib.request.urlopen(url + 'health', timeout=1); break
            except OSError:
                time.sleep(0.1)
        open_window(url)
    finally:
        server.terminate()
        try: server.wait(timeout=10)
        except subprocess.TimeoutExpired: server.kill()
    return True


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8790)
    parser.add_argument('--scripted',action='store_true',help='Run without a conversational model')
    parser.add_argument('--browser',action='store_true',help='Serve the app for a browser instead of opening its own window')
    args=parser.parse_args()
    if not args.browser and windowed(sys.argv[1:],args.port):return
    if os.environ.get('JAEGER_AVATAR_WINDOW'):watch_parent(int(os.environ['JAEGER_AVATAR_WINDOW']))   # this server belongs to a window
    root=Path(__file__).resolve().parents[1]
    os.environ['JAEGER_AVATAR_PORT']=str(args.port)
    if args.scripted:os.environ['NORI_BRAIN']='scripted'
    os.environ.setdefault('HF_HOME',str(root/'app/.cache/hf'))
    if os.environ.get('JAEGER_AVATAR_LOOP','1')=='0':   # the old in-app path: a plain model, no tools. The voice loop keeps the agent's tools.
        os.environ.setdefault('JAEGER_AGENT_NO_TOOLS','1')
        os.environ.setdefault('JAEGER_AGENT_NO_SKILLS','1')
    sys.path.insert(0,str(root/'app'))
    runpy.run_path(str(root/'app/server.py'),run_name='__main__')

if __name__=='__main__':main()
