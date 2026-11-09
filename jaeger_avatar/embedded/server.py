"""Read-only loopback host. Commands enter through the Python Controller API."""
import json
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import secrets
import threading
from urllib.parse import urlparse,parse_qs

class RuntimeServer:
    def __init__(self, root, controller):
        self.started=False;self.root=Path(root).resolve();self.controller=controller;self.token=secrets.token_urlsafe(24)
        owner=self
        class Handler(SimpleHTTPRequestHandler):
            def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(owner.root),**kwargs)
            def log_message(self,*args):pass
            def do_GET(self):
                route=urlparse(self.path)
                if route.path=='/state':
                    if parse_qs(route.query).get('token')!=[owner.token]:self.send_error(403);return
                    body=json.dumps(owner.controller.snapshot()).encode()
                    self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
                super().do_GET()
        self.http=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True)
    @property
    def url(self):return f'http://127.0.0.1:{self.http.server_port}/index.html?token={self.token}'
    def start(self):self.thread.start();self.started=True;return self.url
    def close(self):
        self.controller.send('stop')
        if self.started:self.http.shutdown();self.thread.join(timeout=2)
        self.http.server_close()
