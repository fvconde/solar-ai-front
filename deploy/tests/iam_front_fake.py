"""Injecao APENAS no smoke, montada read-only; ausente da imagem publicada."""
import base64
import json
import os
import sys
import time

sys.path.insert(0, '/opt/solar')
import front


def fake_metadata(audience):
    if os.environ.get('SMOKE_METADATA_FAIL') == '1':
        raise RuntimeError('SENTINELA_ERRO_METADATA')
    claims = base64.urlsafe_b64encode(json.dumps({'aud': audience, 'exp': time.time() + 3600}).encode()).decode().rstrip('=')
    return 'eyJhbGciOiJSUzI1NiJ9.' + claims + '.SENTINELA_TOKEN_FALSO'


original = front.TokenCache
front.TokenCache = lambda audience: original(audience, fake_metadata)
raise SystemExit(front.main())
