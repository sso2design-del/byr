#!/usr/bin/env python3
"""캐시 금지 정적 서버.

    python3 serve.py [port] [dir]

기본 `http.server`는 Last-Modified만 보내서 브라우저가 이전 HTML/CSS를 계속 쓴다.
Playwright는 매번 새 컨텍스트라 캐시가 없으므로, 나에게는 정상으로 보이는데
사용자 화면만 옛 버전인 상태가 만들어진다. 처음부터 이걸로 띄운다.
"""
import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8960
ROOT = sys.argv[2] if len(sys.argv) > 2 else '.'


class NoCache(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), NoCache) as httpd:
        print(f'http://localhost:{PORT}  (root: {os.path.abspath(ROOT)}, no-store)')
        httpd.serve_forever()
