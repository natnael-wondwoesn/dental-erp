"""Booking relay: receives the appointment form of a landing site and forwards it to the
clinic's Telegram chat through the clinic's own bot.

Standard library only. Settings come from environment variables (never from the request):
  BOT_TOKEN       Telegram bot token (secret)
  CHAT_ID         the clinic's chat that receives requests
  ALLOWED_ORIGIN  e.g. https://dalian.dental.clinic-cms.cc  (requests from elsewhere are refused)
  CLINIC_NAME     shown in the message title
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ['BOT_TOKEN']
CHAT_ID = os.environ['CHAT_ID']
ORIGIN = os.environ.get('ALLOWED_ORIGIN', '')
CLINIC = os.environ.get('CLINIC_NAME', 'Clinic')
FIELDS = [
    ('name', 'Name', 80),
    ('phone', 'Phone', 30),
    ('email', 'Email', 120),
    ('service', 'Service', 120),
    ('date', 'Preferred date', 20),
    ('time', 'Preferred time', 20),
    ('message', 'Message', 800),
]
HITS = defaultdict(deque)  # ip -> timestamps; 5 requests per 10 minutes
CTRL = re.compile(r'[\x00-\x08\x0b-\x1f\x7f]')


def clean(value, limit):
    return CTRL.sub('', str(value or '')).strip()[:limit]


def send(text):
    data = urllib.parse.urlencode({'chat_id': CHAT_ID, 'text': text}).encode()
    req = urllib.request.Request(f'https://api.telegram.org/bot{TOKEN}/sendMessage', data=data)
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.load(res).get('ok') is True


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, body):
        raw = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        self.reply(200, {'ok': True}) if self.path == '/health' else self.reply(404, {'ok': False})

    def do_POST(self):
        if self.path != '/api/book':
            return self.reply(404, {'ok': False})
        if ORIGIN and self.headers.get('Origin') != ORIGIN:
            return self.reply(403, {'ok': False, 'error': 'forbidden'})
        ip = (self.headers.get('X-Forwarded-For') or self.client_address[0]).split(',')[0].strip()
        now = time.time()
        hits = HITS[ip]
        while hits and now - hits[0] > 600:
            hits.popleft()
        if len(hits) >= 5:
            return self.reply(429, {'ok': False, 'error': 'too many requests'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8192:
                raise ValueError
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError
        except (ValueError, TypeError):
            return self.reply(400, {'ok': False, 'error': 'bad request'})
        if body.get('website'):  # honeypot: pretend success
            return self.reply(200, {'ok': True})
        values = {key: clean(body.get(key), limit) for key, _, limit in FIELDS}
        if len(values['name']) < 2 or len(re.sub(r'\D', '', values['phone'])) < 9:
            return self.reply(400, {'ok': False, 'error': 'name and phone required'})
        hits.append(now)
        lines = [f'New appointment request - {CLINIC}']
        lines += [f'{label}: {values[key]}' for key, label, _ in FIELDS if values[key]]
        try:
            ok = send('\n'.join(lines))
        except Exception:
            ok = False
        self.reply(200 if ok else 502, {'ok': ok})

    def log_message(self, *args):
        pass  # never log request contents


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
