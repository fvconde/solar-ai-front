"""Helper privado do nginx: IAM e normalizacao de XFF, sem dependencias externas.

Cloud Run front -> nginx -> Cloud Run API (IAM-only) -> API.
Somente a SA do front deve ter run.invoker da API. O token nao autentica o usuario
do painel: cookies/Authorization continuam chegando a API sem alteracao.
FRONT_API_URL = URL HTTPS anunciada da API; audiencia canonica sem barra/caminho.
FRONT_TRUSTED_PROXY_CIDRS = peers/intermediarios OBSERVADOS do ingresso do front.
FRONT_TRUSTED_HOPS = numero exato de saltos confiados, incluindo o peer TCP.
Ex.: peer confiado + XFF 'prefixo falso, cliente' usa 1; com intermediario
confiado adicional no fim do XFF usa 2. Cada intermediario precisa da allow-list.
Nenhum IP do Cloud Run e presumido. Criterio 10 verifica cadeia, peers, suffix do
XFF e configura tambem ProxyTrust finito na API, apos o segundo ingresso Run.
Ranges de proxies nao substituem a fronteira IAM da API. O front publicado so
recebe trafego pelo ingresso Cloud Run; jamais exponha este helper na rede.
"""

import base64
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


class ConfigurationError(ValueError):
    pass


class IdentityUnavailable(RuntimeError):
    pass


def canonical_url(value, mode):
    try:
        url = urlsplit(value)
        if (url.scheme not in (('https',) if mode == 'iam' else ('http', 'https'))
                or not url.hostname or url.username or url.password
                or url.path not in ('', '/') or url.query or url.fragment
                or not re.fullmatch(r'[A-Za-z0-9.-]+', url.hostname)
                or (url.port is not None and not 1 <= url.port <= 65535)):
            raise ValueError()
        return f'{url.scheme}://{url.netloc}', url.hostname, url.netloc
    except (ValueError, TypeError):
        raise ConfigurationError('FRONT_API_URL invalida.') from None


class Settings:
    def __init__(self, env):
        self.mode = env.get('FRONT_AUTH_MODE', 'iam')
        if self.mode not in ('iam', 'local'):
            raise ConfigurationError('FRONT_AUTH_MODE invalido.')
        self.audience, self.host, self.authority = canonical_url(env.get('FRONT_API_URL', ''), self.mode)
        try:
            self.hops = int(env.get('FRONT_TRUSTED_HOPS', '1'))
            self.port = int(env.get('PORT', '8080'))
            self.networks = tuple(ipaddress.ip_network(item.strip(), strict=True)
                                  for item in env.get('FRONT_TRUSTED_PROXY_CIDRS', '').split(',')
                                  if item.strip())
            if (not 1 <= self.hops <= 8 or not 1024 <= self.port <= 65535
                    or len(self.networks) > 32 or any(n.prefixlen == 0 for n in self.networks)
                    or (self.mode == 'iam' and not self.networks)):
                raise ValueError()
        except ValueError:
            raise ConfigurationError('Configuracao de porta/proxies invalida.') from None

    def trusted(self, address):
        return any(address in network for network in self.networks)

    def client_ip(self, peer, forwarded):
        # Nunca confia em um header quando o peer imediato nao esta na allow-list.
        address = ipaddress.ip_address(peer)
        if not self.trusted(address):
            return str(address)
        parts = forwarded.split(',')
        if len(parts) < self.hops or len(forwarded) > 8192:
            raise ValueError('Cadeia de proxies invalida.')
        for part in reversed(parts[-self.hops:]):
            if not self.trusted(address):
                raise ValueError('Intermediario nao confiado.')
            address = ipaddress.ip_address(part.strip())
        # Prefixos arbitrarios a esquerda nao entram no header enviado a API.
        return str(address)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise IdentityUnavailable('Identidade indisponivel.')


def metadata_token(audience):
    endpoint = ('http://metadata.google.internal/computeMetadata/v1/instance/'
                'service-accounts/default/identity?')
    request = Request(endpoint + urlencode({'audience': audience, 'format': 'full'}),
                      headers={'Metadata-Flavor': 'Google'})
    # Nao usa HTTP_PROXY do ambiente nem segue redirecionamento com o token.
    with build_opener(ProxyHandler({}), NoRedirect()).open(request, timeout=3) as response:
        if response.status != 200 or response.headers.get('Metadata-Flavor') != 'Google':
            raise IdentityUnavailable('Identidade indisponivel.')
        raw = response.read(16385)
        if len(raw) > 16384:
            raise IdentityUnavailable('Identidade indisponivel.')
        return raw.decode('ascii')


class TokenCache:
    def __init__(self, audience, fetch=metadata_token, clock=time.time):
        self.audience, self.fetch, self.clock = audience, fetch, clock
        self.token, self.expires = '', 0
        self.lock = threading.Lock()

    def get(self):
        # Renovacao SOB DEMANDA: nao depende de CPU alocada entre requisicoes.
        with self.lock:
            if self.token and self.clock() < self.expires - 60:
                return self.token
            self.token, self.expires = '', 0
            try:
                token = self.fetch(self.audience)
                if len(token) > 16384 or not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', token):
                    raise ValueError()
                payload = token.split('.')[1]
                claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
                expiry = claims['exp']
                if (claims['aud'] != self.audience or isinstance(expiry, bool)
                        or not isinstance(expiry, (int, float)) or not math.isfinite(expiry)
                        or expiry <= self.clock() + 60):
                    raise ValueError()
                self.token, self.expires = token, expiry
                return token
            except Exception:
                # Nunca propaga resposta/erro/URL do transporte ou token.
                raise IdentityUnavailable('Identidade indisponivel.') from None


def handler_for(settings, cache):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            if self.path != '/authorize':
                self.send_error(404)
                return
            try:
                client = settings.client_ip(self.headers.get('X-Proxy-Peer', ''),
                                            self.headers.get('X-Proxy-Xff', ''))
            except ValueError:
                self.send_error(403, 'Proxy invalido')
                return
            try:
                token = cache.get() if settings.mode == 'iam' else ''
            except IdentityUnavailable:
                self.send_error(503, 'Identidade indisponivel')
                return
            self.send_response(204)
            self.send_header('X-Solar-Client-IP', client)
            if token:
                self.send_header('X-Solar-Identity', 'Bearer ' + token)
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()

    return Handler


class PrivateServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        # Nem traceback de conexao interrompida pode registrar headers.
        pass


def render(settings, template, resolv_conf):
    servers = []
    for line in resolv_conf.splitlines():
        words = line.split()
        if len(words) >= 2 and words[0] == 'nameserver':
            ip = ipaddress.ip_address(words[1])
            servers.append(f'[{ip}]' if ip.version == 6 else str(ip))
    if not servers:
        raise ConfigurationError('Resolver DNS indisponivel.')
    for key, value in {'PORT': str(settings.port), 'API_URL': settings.audience,
                       'API_HOST': settings.host, 'API_AUTHORITY': settings.authority,
                       'RESOLVERS': ' '.join(servers)}.items():
        template = template.replace('@@' + key + '@@', value)
    return template


def main():
    try:
        settings = Settings(os.environ)
        template = Path(__file__).with_name('nginx.conf.template').read_text()
        Path('/tmp/solar-nginx.conf').write_text(render(settings, template, Path('/etc/resolv.conf').read_text()))
        server = PrivateServer(('127.0.0.1', 8090), handler_for(settings, TokenCache(settings.audience)))
    except Exception:
        raise SystemExit('Configuracao do front invalida.') from None
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    nginx = subprocess.Popen(['nginx', '-c', '/tmp/solar-nginx.conf', '-g', 'daemon off;'])
    stop = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stop.set())
    while not stop.wait(0.2) and nginx.poll() is None and thread.is_alive():
        pass
    if nginx.poll() is None:
        nginx.send_signal(signal.SIGQUIT)
        try:
            nginx.wait(timeout=10)
        except subprocess.TimeoutExpired:
            nginx.kill()
            nginx.wait()
    server.shutdown()
    server.server_close()
    return nginx.returncode


if __name__ == '__main__':
    raise SystemExit(main())
