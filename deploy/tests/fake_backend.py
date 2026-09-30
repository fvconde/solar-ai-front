"""Backend exclusivo do smoke: nao importa API, agente, LLM ou SMTP."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import ssl
import threading


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.respond()

    def do_POST(self):
        self.respond()

    def respond(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', '0'))).decode()
        identity = self.headers.get('X-Serverless-Authorization', '')
        data = json.dumps({'path': self.path, 'method': self.command, 'body': body,
                           'xff': self.headers.get('X-Forwarded-For'),
                           'authorization': self.headers.get('Authorization'),
                           'cookie': self.headers.get('Cookie'),
                           'forwarded': self.headers.get('Forwarded'),
                           'iam': identity.startswith('Bearer ') and identity.endswith('.SENTINELA_TOKEN_FALSO'),
                           'identity_absent': not identity}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        # Mesmo headers devolvidos pelo upstream nao devem alcancar o navegador.
        self.send_header('X-Serverless-Authorization', identity)
        self.send_header('X-Solar-Identity', identity)
        self.end_headers()
        self.wfile.write(data)


plain = ThreadingHTTPServer(('0.0.0.0', 8080), Handler)
secure = ThreadingHTTPServer(('0.0.0.0', 8443), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('/fixtures/cert.pem', '/fixtures/key.pem')
secure.socket = context.wrap_socket(secure.socket, server_side=True)
threading.Thread(target=plain.serve_forever, daemon=True).start()
secure.serve_forever()
