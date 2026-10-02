"""Local-only uncached preview and optional scene-capture endpoint."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import re

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / 'docs' / 'overhaul' / 'captures'

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        name = self.path.removeprefix('/__capture/')
        origin = self.headers.get('Origin')
        if not self.path.startswith('/__capture/') or not re.fullmatch(r'[a-z0-9-]{1,48}\.png', name) or (origin and origin != 'http://127.0.0.1:8766'):
            self.send_error(403); return
        try:
            size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.send_error(400); return
        if not 8 < size <= 8_000_000 or self.headers.get('Content-Type') != 'image/png':
            self.send_error(400); return
        data = self.rfile.read(size)
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            self.send_error(400); return
        CAPTURES.mkdir(parents=True, exist_ok=True)
        (CAPTURES / name).write_bytes(data)
        self.send_response(201)
        self.end_headers()
        self.wfile.write(name.encode())

if __name__ == '__main__':
    os.chdir(ROOT)
    ThreadingHTTPServer(('127.0.0.1', 8766), PreviewHandler).serve_forever()
