import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConversaApi } from './conversa-api';
import { ExclusaoTitularResponse } from './contrato';

describe('ConversaApi', () => {
  let api: ConversaApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ConversaApi],
    });
    api = TestBed.inject(ConversaApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('apagarConversa envia DELETE com credenciais e sem chave no corpo ou header', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const mockResposta: ExclusaoTitularResponse = {
      leadExcluido: true,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    };

    const promessa = api.apagarConversa(id);

    const req = http.expectOne(`/conversas/${id}/titular`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toBeNull();
    expect(req.request.headers.has('X-Chave-Privacidade')).toBeFalse();
    expect(req.request.headers.has('Cookie')).toBeFalse();

    req.flush(mockResposta);
    const resultado = await promessa;

    expect(resultado).toEqual(mockResposta);
    expect(resultado.escopo).toBe('lead_e_vinculos');
  });

  it('apagarConversa recebe escopo apenas_conversa com sucesso', async () => {
    const id = '22222222-2222-2222-2222-222222222222';
    const mockResposta: ExclusaoTitularResponse = {
      leadExcluido: false,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'apenas_conversa',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    };

    const promessa = api.apagarConversa(id);

    const req = http.expectOne(`/conversas/${id}/titular`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBeTrue();

    req.flush(mockResposta);
    const resultado = await promessa;

    expect(resultado).toEqual(mockResposta);
    expect(resultado.escopo).toBe('apenas_conversa');
  });

  it('obterConversa envia GET com credenciais', async () => {
    const id = '33333333-3333-3333-3333-333333333333';

    const promessa = api.obterConversa(id);

    const req = http.expectOne(`/conversas/${id}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();

    req.flush({
      conversaId: id,
      perfilLead: null,
      mensagens: [],
      contatoPendente: false,
      consentimentoEm: '2026-10-04T12:00:00Z',
      versaoAvisoPrivacidade: '2026-09-11',
    });

    const resultado = await promessa;
    expect(resultado.conversaId).toBe(id);
  });
});
