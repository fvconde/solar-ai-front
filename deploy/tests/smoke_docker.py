"""Smoke stdlib local. Requer imagens front/API :s26-local e postgres:16-alpine.

Usa HTTP por docker exec (nenhuma porta do host), rede Docker --internal
e certificados ficticios temporarios. A etapa de gerar certificado instala
openssl em container descartavel; nenhum container de aplicacao tem egress.
Postgres exclusivo, sem portas de host, com dados inteiramente ficticios.
Nao le .env. Nao chama metadata real, Gemini, SMTP nem recursos de nuvem.
"""
import base64
import csv
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import uuid

IMAGE = 'solar-ai-front:s26-local'
HERE = Path(__file__).resolve().parent


def docker(*args):
    result = subprocess.run(['docker', *args], capture_output=True, text=True)
    if result.returncode:
        # Estes containers so recebem dados ficticios, mas nem estes vao ao log.
        raise RuntimeError('Comando Docker do smoke falhou: ' + args[0])
    return result.stdout.strip()


class DockerSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.suffix = uuid.uuid4().hex[:10]
        cls.network = 's26-smoke-' + cls.suffix
        cls.backend = 's26-backend-' + cls.suffix
        cls.front = 's26-front-' + cls.suffix
        cls.api = 's26-api-' + cls.suffix
        cls.postgres = 's26-smoke-postgres-' + cls.suffix
        cls.tmp = Path(tempfile.mkdtemp(prefix='s26-smoke-'))
        cls.addClassCleanup(cls.cleanup)
        # Protege o diretorio ANTES de criar qualquer arquivo de configuracao.
        if os.name == 'nt':
            identity = subprocess.run(['whoami', '/user', '/fo', 'csv', '/nh'],
                                      capture_output=True, text=True, check=True)
            sid = next(csv.reader(identity.stdout.strip().splitlines()))[1]
            secured = subprocess.run(['icacls', str(cls.tmp), '/inheritance:r',
                                      '/grant:r', '*' + sid + ':(OI)(CI)F'],
                                     capture_output=True, text=True)
            if secured.returncode:
                raise RuntimeError('Nao foi possivel proteger diretorio temporario.')
        else:
            cls.tmp.chmod(0o700)
        fixtures = cls.tmp.as_posix()
        docker('run', '--rm', '--user', 'root', '--entrypoint', 'sh',
               '-v', fixtures + ':/fixtures', IMAGE, '-c',
               'apk add --no-cache openssl >/dev/null && openssl req -x509 -newkey rsa:2048 -nodes '
               '-keyout /fixtures/key.pem -out /fixtures/cert.pem -days 1 -subj /CN=api-stub '
               '-addext subjectAltName=DNS:api-stub >/dev/null 2>&1 && chmod 644 /fixtures/key.pem')
        docker('network', 'create', '--internal', cls.network)
        cls.subnet = json.loads(docker('network', 'inspect', cls.network))[0]['IPAM']['Config'][0]['Subnet']
        docker('run', '-d', '--name', cls.backend, '--network', cls.network, '--network-alias', 'api-stub',
               '-v', HERE.as_posix() + ':/tests:ro',
               '-v', fixtures + ':/fixtures:ro', '--entrypoint', 'python3', IMAGE, '/tests/fake_backend.py')

    @classmethod
    def cleanup(cls):
        for name in (cls.front, cls.backend, cls.api, cls.postgres):
            subprocess.run(['docker', 'rm', '-f', name], capture_output=True)
        subprocess.run(['docker', 'network', 'rm', cls.network], capture_output=True)
        for filename in ('api.env', 'postgres.env', 'cert.pem', 'key.pem'):
            (cls.tmp / filename).unlink(missing_ok=True)
        cls.tmp.rmdir()

    def boot(self, *, iam=False, failure=False, trust_cert=True, url=None, trusted=True):
        subprocess.run(['docker', 'rm', '-f', self.front], capture_output=True)
        args = ['run', '-d', '--name', self.front, '--network', self.network,
                '-e', 'FRONT_API_URL=' + (url or ('https://api-stub:8443/' if iam else 'http://api-stub:8080')),
                '-e', 'FRONT_TRUSTED_PROXY_CIDRS=' + (self.subnet if trusted else '192.0.2.0/24')]
        if iam:
            args += ['-v', HERE.as_posix() + ':/tests:ro', '--entrypoint', 'python3']
            if trust_cert:
                args += ['-v', self.tmp.as_posix() + '/cert.pem:/etc/ssl/certs/ca-certificates.crt:ro']
            if failure:
                args += ['-e', 'SMOKE_METADATA_FAIL=1']
        else:
            args += ['-e', 'FRONT_AUTH_MODE=local']
        docker(*args, IMAGE, *(['/tests/iam_front_fake.py'] if iam else []))
        for _ in range(100):
            try:
                if self.request('/')[0] == 200:
                    return
            except (URLError, ConnectionError, RuntimeError):
                pass
            time.sleep(0.1)
        self.fail('Front nao iniciou no prazo.')

    def request(self, path, data=None, headers=None):
        headers = {'X-Forwarded-For': '203.0.113.7', **(headers or {})}
        # Cliente em outro container: o peer TCP pertence a subnet do smoke.
        # trusted=False retira essa subnet da allow-list, sem mudar producao.
        # Nenhuma porta do host e publicada.
        script = '\n'.join([
            'import base64,json,urllib.request,urllib.error',
            f'request=urllib.request.Request({("http://" + self.front + ":8080" + path)!r}, data={data!r}, headers={headers or {}!r})',
            'try: response=urllib.request.urlopen(request, timeout=3)',
            'except urllib.error.HTTPError as error: response=error',
            'with response: print(json.dumps([response.code,dict(response.headers),base64.b64encode(response.read()).decode()]))',
        ])
        status, response_headers, body = json.loads(docker('exec', self.backend, 'python3', '-c', script))
        return status, response_headers, base64.b64decode(body)

    def test_local_spa_prefixos_body_cookie_e_404(self):
        self.boot()
        index = self.request('/')[2]
        self.assertIn(b'<app-root', index)
        for path in ('/painel', '/entrar'):
            self.assertEqual(self.request(path)[2], index)
        for path in ('/openapi/v1.json', '/swagger', '/swagger/', '/swagger/index.html', '/_solar_identity'):
            self.assertEqual(self.request(path)[0], 404)
        for path in ('/api/painel/leads?x=1', '/conversas/123', '/turn', '/encaminhamentos', '/health'):
            status, headers, raw = self.request(path, b'{"falso":true}', {
                'X-Forwarded-For': '1.1.1.1, 203.0.113.7', 'X-Serverless-Authorization': 'TOKEN_FORJADO',
                'Forwarded': 'for=1.1.1.1', 'Authorization': 'Bearer usuario-ficticio', 'Cookie': 'sessao=ficticia'})
            data = json.loads(raw)
            self.assertEqual(status, 200)
            self.assertEqual(data['path'], path)
            self.assertEqual(data['body'], '{"falso":true}')
            self.assertEqual(data['method'], 'POST')
            self.assertEqual(data['xff'], '203.0.113.7')
            self.assertTrue(data['identity_absent'])
            self.assertEqual(data['authorization'], 'Bearer usuario-ficticio')
            self.assertEqual(data['cookie'], 'sessao=ficticia')
            self.assertIsNone(data['forwarded'])
            self.assertNotIn('X-Serverless-Authorization', headers)

    def test_iam_sobrescreve_header_sem_vazar_token_no_browser_ou_logs(self):
        self.boot(iam=True)
        status, headers, raw = self.request('/api/prova', headers={
            'X-Forwarded-For': 'falso, 203.0.113.8', 'X-Serverless-Authorization': 'TOKEN_FORJADO'})
        self.assertEqual(status, 200)
        data = json.loads(raw)
        self.assertTrue(data['iam'])
        self.assertEqual(data['xff'], '203.0.113.8')
        self.assertNotIn('X-Solar-Identity', headers)
        self.assertNotIn('X-Serverless-Authorization', headers)
        self.assertNotIn(b'SENTINELA', raw)
        self.assertNotIn('SENTINELA', docker('logs', self.front))
        self.assertEqual(self.request('/_solar_identity')[0], 404)
        # O helper so escuta loopback e nao pode ser acessado por outro container.
        result = docker('exec', self.backend, 'python3', '-c',
                        'import socket; s=socket.socket(); s.settimeout(2); '
                        f'print(s.connect_ex(({self.front!r},8090)) != 0)')
        self.assertEqual(result, 'True')

    def test_metadata_falha_fecha_acesso(self):
        self.boot(iam=True, failure=True)
        status, headers, raw = self.request('/api/prova', headers={'X-Forwarded-For': '203.0.113.7'})
        self.assertEqual(status, 500)
        self.assertNotIn(b'SENTINELA', raw)
        self.assertNotIn('X-Solar-Identity', headers)
        self.assertNotIn('SENTINELA', docker('logs', self.front))

    def test_tls_certificado_nao_confiado_recusado(self):
        self.boot(iam=True, trust_cert=False)
        self.assertEqual(self.request('/api/prova', headers={'X-Forwarded-For': '203.0.113.7'})[0], 502)

    def test_tls_nome_incorreto_recusado(self):
        self.boot(iam=True, url='https://' + self.backend + ':8443')
        self.assertEqual(self.request('/api/prova', headers={'X-Forwarded-For': '203.0.113.7'})[0], 502)

    def test_peer_desconhecido_descarta_spoof(self):
        self.boot(trusted=False)
        status, _, raw = self.request('/api/prova', headers={'X-Forwarded-For': '203.0.113.7'})
        self.assertEqual(status, 200)
        self.assertNotEqual(json.loads(raw)['xff'], '203.0.113.7')
        peer = json.loads(docker('inspect', '--format', '{{json .NetworkSettings.Networks}}',
                                 self.backend))[self.network]['IPAddress']
        self.assertEqual(json.loads(raw)['xff'], peer)

    def test_api_dotnet_real_painel_anonimo_health_sha_e_spa(self):
        # Credenciais exclusivamente ficticias, geradas para este container.
        # Os arquivos ficam fora do build, em diretorio com ACL restrita.
        password = 's26-test-only-' + self.suffix
        pg_env = self.tmp / 'postgres.env'
        pg_env.write_text('POSTGRES_USER=s26_smoke\nPOSTGRES_DB=solar_test\n'
                          'POSTGRES_PASSWORD=' + password + '\n', encoding='utf-8')
        pg_env.chmod(0o600)
        env_file = self.tmp / 'api.env'
        env_file.write_text('ConnectionStrings__Postgres=Host=' + self.postgres
                            + ';Port=5432;Database=solar_test;Username=s26_smoke;Password='
                            + password + '\n', encoding='utf-8')
        env_file.chmod(0o600)
        docker('run', '-d', '--name', self.postgres, '--network', self.network,
               '--env-file', str(pg_env), 'postgres:16-alpine')
        for _ in range(60):
            ready = subprocess.run(['docker', 'exec', self.postgres, 'pg_isready',
                                    '-q', '-h', '127.0.0.1', '-U', 's26_smoke', '-d', 'solar_test'],
                                   capture_output=True)
            if ready.returncode == 0:
                break
            time.sleep(0.5)
        else:
            self.fail('Postgres exclusivo nao ficou pronto no prazo.')
        api_root = HERE.parents[2] / 'solar-ai-api'
        sha = subprocess.run(['git', '-C', str(api_root), 'rev-parse', 'HEAD'],
                             capture_output=True, text=True, check=True).stdout.strip()
        self.assertRegex(sha, r'^[0-9a-f]{40}$')
        docker('run', '-d', '--name', self.api, '--network', self.network,
               '--env-file', str(env_file),
               '-e', 'ASPNETCORE_ENVIRONMENT=Production',
               '-e', 'ASPNETCORE_HTTP_PORTS=8080', '-e', 'SOLAR_VERSION=' + sha,
               '-e', 'Semente__SenhaSupervisor=',
               '-e', 'Agente__BaseUrl=http://127.0.0.1:1',
               '-e', 'Email__Smtp__Host=127.0.0.1', '-e', 'Email__Smtp__Porta=1',
               '-e', 'Logging__LogLevel__Default=None', 'solar-ai-api:s26-local')
        self.boot(url='http://' + self.api + ':8080')
        health = None
        for _ in range(60):
            status, _, body = self.request('/health')
            if status == 200:
                health = json.loads(body)
                break
            time.sleep(0.5)
        self.assertIsNotNone(health, 'API real nao ficou saudavel no prazo.')
        self.assertEqual(health['status'], 'up')
        self.assertEqual(health['version'], sha)
        self.assertEqual(self.request('/api/painel/leads')[0], 401)
        index = self.request('/')[2]
        self.assertIn(b'<app-root', index)
        self.assertEqual(self.request('/painel')[2], index)


if __name__ == '__main__':
    unittest.main(verbosity=2)
