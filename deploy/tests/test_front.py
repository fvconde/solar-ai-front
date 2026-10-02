import base64
from concurrent.futures import ThreadPoolExecutor
from contextlib import redirect_stderr
import io
import json
from pathlib import Path
import sys
import threading
import traceback
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import front


AUDIENCE = 'https://solar-api.test'


def jwt(exp=3600, aud=AUDIENCE):
    payload = base64.urlsafe_b64encode(json.dumps({'exp': exp, 'aud': aud}).encode()).decode().rstrip('=')
    return 'eyJhbGciOiJSUzI1NiJ9.' + payload + '.SENTINELA_TOKEN_FALSO'


def settings(**values):
    return front.Settings({'FRONT_API_URL': AUDIENCE, 'FRONT_TRUSTED_PROXY_CIDRS': '10.0.0.0/24', **values})


class ConfigurationTests(unittest.TestCase):
    def test_audiencia_canonica_com_e_sem_barra(self):
        for url in (AUDIENCE, AUDIENCE + '/'):
            self.assertEqual(settings(FRONT_API_URL=url).audience, AUDIENCE)

    def test_producao_padrao_e_config_invalida_falha_fechado(self):
        self.assertEqual(settings().mode, 'iam')
        invalid = [dict(FRONT_API_URL=url) for url in (
            'http://solar-api.test', AUDIENCE + '/api', AUDIENCE + '?token=falso',
            'https://user:password@solar-api.test', 'https://bad;host', AUDIENCE + ':0')]
        invalid += [dict(FRONT_TRUSTED_HOPS=value) for value in ('0', '9', '-1', 'x')]
        invalid += [dict(FRONT_TRUSTED_PROXY_CIDRS=value) for value in ('', '0.0.0.0/0', '::/0', 'invalid')]
        for values in invalid:
            with self.subTest(values=values), self.assertRaises(front.ConfigurationError):
                settings(**values)

    def test_dns_runtime_tls_sni_e_rota_interna(self):
        template = Path(front.__file__).with_name('nginx.conf.template').read_text()
        rendered = front.render(settings(), template, 'nameserver 127.0.0.11\nnameserver 2001:db8::1\n')
        for expected in ('resolver 127.0.0.11 [2001:db8::1] valid=30s;',
                         'proxy_ssl_verify on;', 'proxy_ssl_server_name on;',
                         'proxy_ssl_name solar-api.test;', 'internal;',
                         'proxy_pass $api_url$request_uri;', 'proxy_set_header X-Forwarded-For $client_ip;'):
            self.assertIn(expected, rendered)
        self.assertNotIn('@@', rendered)
        with self.assertRaises(front.ConfigurationError):
            front.render(settings(), template, '')

    def test_header_proprio_usa_apenas_IP_normalizado_sem_copiar_cliente(self):
        template = Path(front.__file__).with_name('nginx.conf.template').read_text()
        rendered = front.render(settings(), template, 'nameserver 127.0.0.11\n')
        self.assertIn('proxy_set_header X-Solar-Client-IP $client_ip;', rendered)
        self.assertNotIn('proxy_set_header X-Solar-Client-IP "";', rendered)
        self.assertNotIn('$http_x_solar_client_ip', rendered)


class ForwardedTests(unittest.TestCase):
    def test_prefixo_falso_descartado(self):
        self.assertEqual(settings().client_ip('10.0.0.2', 'falso, 1.1.1.1, 203.0.113.7'), '203.0.113.7')

    def test_peer_desconhecido_nao_confia_em_xff(self):
        self.assertEqual(settings().client_ip('192.0.2.5', '203.0.113.7'), '192.0.2.5')

    def test_cadeia_finita_e_intermediario_validado(self):
        config = settings(FRONT_TRUSTED_HOPS='2')
        self.assertEqual(config.client_ip('10.0.0.2', '1.1.1.1, 203.0.113.8, 10.0.0.3'), '203.0.113.8')
        for xff in ('203.0.113.8', '203.0.113.8, 192.0.2.3', '203.0.113.8, invalid', ''):
            with self.subTest(xff=xff), self.assertRaises(ValueError):
                config.client_ip('10.0.0.2', xff)

    def test_ipv6_normalizado_e_clientes_distintos(self):
        config = settings()
        self.assertEqual(config.client_ip('10.0.0.2', '2001:0db8:0:0::1'), '2001:db8::1')
        self.assertNotEqual(config.client_ip('10.0.0.2', '203.0.113.7'), config.client_ip('10.0.0.2', '203.0.113.8'))


class TokenTests(unittest.TestCase):
    def test_cache_renova_sob_demanda_apos_cpu_congelada(self):
        now, calls = [100], []
        def fetch(audience):
            calls.append(audience)
            return jwt(now[0] + 3600)
        cache = front.TokenCache(AUDIENCE, fetch, lambda: now[0])
        first = cache.get()
        self.assertEqual(cache.get(), first)
        now[0] += 4000
        self.assertNotEqual(cache.get(), first)
        self.assertEqual(calls, [AUDIENCE, AUDIENCE])

    def test_renovacao_concorrente_unica(self):
        calls = []
        cache = front.TokenCache(AUDIENCE, lambda aud: calls.append(aud) or jwt(), lambda: 100)
        with ThreadPoolExecutor(max_workers=8) as pool:
            values = list(pool.map(lambda _: cache.get(), range(16)))
        self.assertEqual(len(set(values)), 1)
        self.assertEqual(len(calls), 1)

    def test_falha_metadata_nao_usa_token_antigo_nem_vaza_erro(self):
        now = [100]
        cache = front.TokenCache(AUDIENCE, lambda _: jwt(), lambda: now[0])
        cache.get()
        now[0] = 3550
        def fail(_):
            raise RuntimeError('SENTINELA_SEGREDO_METADATA')
        cache.fetch = fail
        try:
            cache.get()
            self.fail('Falha metadata deveria fechar acesso')
        except front.IdentityUnavailable:
            self.assertNotIn('SENTINELA', traceback.format_exc())
        self.assertEqual(cache.token, '')

    def test_token_malformado_expirado_ou_audiencia_errada_rejeitado(self):
        for token in (jwt(100), jwt(aud=AUDIENCE + '/'), jwt(float('nan')), 'a.b.c', jwt() + '\r\nX: bad'):
            with self.subTest(), self.assertRaises(front.IdentityUnavailable):
                front.TokenCache(AUDIENCE, lambda _: token, lambda: 100).get()

    def test_metadata_header_audiencia_timeout_sem_proxy_nem_redirect(self):
        class Response:
            status = 200
            headers = {'Metadata-Flavor': 'Google'}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return jwt().encode()
        with patch.object(front, 'build_opener') as build:
            build.return_value.open.return_value = Response()
            front.metadata_token(AUDIENCE)
            request = build.return_value.open.call_args.args[0]
            self.assertEqual(request.get_header('Metadata-flavor'), 'Google')
            self.assertEqual(parse_qs(urlsplit(request.full_url).query), {'audience': [AUDIENCE], 'format': ['full']})
            self.assertEqual(urlsplit(request.full_url).hostname, 'metadata.google.internal')
            self.assertEqual(build.return_value.open.call_args.kwargs['timeout'], 3)
            self.assertEqual(build.call_args.args[0].proxies, {})
            with self.assertRaises(front.IdentityUnavailable):
                build.call_args.args[1].redirect_request(None, None, 302, '', {}, 'http://evil.test')

    def test_resposta_metadata_sem_flavor_rejeitada(self):
        class Response:
            status = 200
            headers = {}
            def __enter__(self): return self
            def __exit__(self, *args): pass
        with patch.object(front, 'build_opener') as build:
            build.return_value.open.return_value = Response()
            with self.assertRaises(front.IdentityUnavailable):
                front.metadata_token(AUDIENCE)


class HelperHttpTests(unittest.TestCase):
    def request(self, config, cache):
        with front.PrivateServer(('127.0.0.1', 0), front.handler_for(config, cache)) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                req = Request(f'http://127.0.0.1:{server.server_port}/authorize', headers={
                    'X-Proxy-Peer': '10.0.0.2', 'X-Proxy-Xff': '1.1.1.1, 203.0.113.7'})
                try:
                    response = urlopen(req)
                except HTTPError as error:
                    response = error
                with response:
                    return response.code, dict(response.headers), response.read()
            finally:
                server.shutdown()
                thread.join()

    def test_local_sem_token_sem_metadata(self):
        class Forbidden:
            def get(self): raise AssertionError('Metadata nao pode ser acessada em modo local')
        status, headers, body = self.request(settings(FRONT_AUTH_MODE='local'), Forbidden())
        self.assertEqual(status, 204)
        self.assertEqual(headers['X-Solar-Client-IP'], '203.0.113.7')
        self.assertNotIn('X-Solar-Identity', headers)
        self.assertEqual(body, b'')

    def test_iam_token_apenas_header_interno_sem_log(self):
        output = io.StringIO()
        with redirect_stderr(output):
            status, headers, body = self.request(settings(), front.TokenCache(AUDIENCE, lambda _: jwt(), lambda: 100))
        self.assertEqual(status, 204)
        self.assertEqual(headers['X-Solar-Identity'], 'Bearer ' + jwt())
        self.assertEqual(body, b'')
        self.assertEqual(output.getvalue(), '')

    def test_erro_http_sanitizado(self):
        def fail(_): raise RuntimeError('SENTINELA_TOKEN_FALSO')
        output = io.StringIO()
        with redirect_stderr(output):
            status, headers, body = self.request(settings(), front.TokenCache(AUDIENCE, fail))
        self.assertEqual(status, 503)
        self.assertNotIn('X-Solar-Identity', headers)
        self.assertNotIn(b'SENTINELA', body)
        self.assertEqual(output.getvalue(), '')


if __name__ == '__main__':
    unittest.main()
