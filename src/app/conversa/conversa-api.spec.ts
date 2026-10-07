import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConversaApi } from './conversa-api';
import {
  AgendamentoDaConversa,
  ExclusaoTitularResponse,
  SlotOferecido,
} from './contrato';

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

  it('obterConversa envia GET com credenciais e le lista de oferta vazia', async () => {
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
      oferta: [],
    });

    const resultado = await promessa;
    expect(resultado.conversaId).toBe(id);
    expect(resultado.oferta).toEqual([]);
  });

  it('obterConversa le lista de oferta populada', async () => {
    const id = '55555555-5555-5555-5555-555555555555';
    const slots: SlotOferecido[] = [
      { id: 1, inicio: '2026-10-07T12:00:00Z', fim: '2026-10-07T13:00:00Z' },
      { id: 2, inicio: '2026-10-07T17:00:00Z', fim: '2026-10-07T18:00:00Z' },
    ];

    const promessa = api.obterConversa(id);

    const req = http.expectOne(`/conversas/${id}`);
    req.flush({
      conversaId: id,
      perfilLead: null,
      mensagens: [],
      contatoPendente: false,
      consentimentoEm: '2026-10-04T12:00:00Z',
      versaoAvisoPrivacidade: '2026-09-11',
      oferta: slots,
    });

    const resultado = await promessa;
    expect(resultado.oferta).toEqual(slots);
    expect(resultado.oferta.length).toBe(2);
  });

  it('registrarContato envia POST e le lista de oferta populada', async () => {
    const id = '66666666-6666-6666-6666-666666666666';
    const slots: SlotOferecido[] = [
      { id: 1, inicio: '2026-10-07T12:00:00Z', fim: '2026-10-07T13:00:00Z' },
    ];

    const promessa = api.registrarContato(id, { nome: 'Ana', telefone: '11999998888', email: null });

    const req = http.expectOne(`/conversas/${id}/contato`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Ana', telefone: '11999998888', email: null });

    req.flush({ leadId: 'lead-1', oferta: slots });
    const resultado = await promessa;

    expect(resultado.leadId).toBe('lead-1');
    expect(resultado.oferta).toEqual(slots);
  });

  it('registrarContato le lista de oferta vazia', async () => {
    const id = '77777777-7777-7777-7777-777777777777';

    const promessa = api.registrarContato(id, { nome: 'Carlos', telefone: null, email: 'c@teste.com' });

    const req = http.expectOne(`/conversas/${id}/contato`);
    req.flush({ leadId: 'lead-2', oferta: [] });
    const resultado = await promessa;

    expect(resultado.leadId).toBe('lead-2');
    expect(resultado.oferta).toEqual([]);
  });

  it('registrarAgendamento envia POST com corpo exato e devolve resposta 200 preservada sem chamar mensagens', async () => {
    const id = '88888888-8888-8888-8888-888888888888';
    const mockResposta: AgendamentoDaConversa = {
      estado: 'confirmado',
      horario: {
        id: 42,
        inicio: '2026-10-07T17:00:00Z',
        fim: '2026-10-07T18:00:00Z',
      },
      alternativas: [],
    };

    const promessa = api.registrarAgendamento(id, 42);

    const req = http.expectOne(`/conversas/${id}/agendamentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ slotId: 42 });
    http.expectNone(`/conversas/${id}/mensagens`);

    req.flush(mockResposta);
    const resultado = await promessa;

    expect(resultado).toEqual(mockResposta);
    expect(resultado.estado).toBe('confirmado');
    expect(resultado.horario?.id).toBe(42);
  });

  it('registrarAgendamento preserva erro 409 com oferta populada na rejeicao', async () => {
    const id = '88888888-8888-8888-8888-888888888888';
    const slots: SlotOferecido[] = [
      { id: 43, inicio: '2026-10-08T17:00:00Z', fim: '2026-10-08T18:00:00Z' },
    ];
    const corpoErro = {
      type: 'about:blank',
      title: 'horario indisponivel',
      status: 409,
      codigo: 'horario_indisponivel',
      oferta: slots,
    };

    const promessa = api.registrarAgendamento(id, 42);

    const req = http.expectOne(`/conversas/${id}/agendamentos`);
    req.flush(corpoErro, { status: 409, statusText: 'Conflict' });

    try {
      await promessa;
      fail('Deveria ter rejeitado');
    } catch (err) {
      expect(err instanceof HttpErrorResponse).toBeTrue();
      const httpErr = err as HttpErrorResponse;
      expect(httpErr.status).toBe(409);
      expect(httpErr.error).toEqual(corpoErro);
      expect(httpErr.error.oferta).toEqual(slots);
      expect(httpErr.error.codigo).toBe('horario_indisponivel');
    }
  });

  it('registrarAgendamento preserva erro 409 com oferta vazia na rejeicao', async () => {
    const id = '88888888-8888-8888-8888-888888888888';
    const corpoErro = {
      type: 'about:blank',
      title: 'horario indisponivel',
      status: 409,
      codigo: 'horario_indisponivel',
      oferta: [],
    };

    const promessa = api.registrarAgendamento(id, 42);

    const req = http.expectOne(`/conversas/${id}/agendamentos`);
    req.flush(corpoErro, { status: 409, statusText: 'Conflict' });

    try {
      await promessa;
      fail('Deveria ter rejeitado');
    } catch (err) {
      expect(err instanceof HttpErrorResponse).toBeTrue();
      const httpErr = err as HttpErrorResponse;
      expect(httpErr.status).toBe(409);
      expect(httpErr.error).toEqual(corpoErro);
      expect(httpErr.error.oferta).toEqual([]);
    }
  });

  it('registrarAgendamento preserva erro 409 sem oferta na rejeicao', async () => {
    const id = '88888888-8888-8888-8888-888888888888';
    const corpoErro = {
      type: 'about:blank',
      title: 'conflito',
      status: 409,
      codigo: 'agendamento_ja_confirmado',
    };

    const promessa = api.registrarAgendamento(id, 42);

    const req = http.expectOne(`/conversas/${id}/agendamentos`);
    req.flush(corpoErro, { status: 409, statusText: 'Conflict' });

    try {
      await promessa;
      fail('Deveria ter rejeitado');
    } catch (err) {
      expect(err instanceof HttpErrorResponse).toBeTrue();
      const httpErr = err as HttpErrorResponse;
      expect(httpErr.status).toBe(409);
      expect(httpErr.error).toEqual(corpoErro);
      expect(httpErr.error.oferta).toBeUndefined();
    }
  });

  it('registrarAgendamento preserva erro 404 na rejeicao', async () => {
    const id = '88888888-8888-8888-8888-888888888888';

    const promessa = api.registrarAgendamento(id, 42);

    const req = http.expectOne(`/conversas/${id}/agendamentos`);
    req.flush('Nao encontrado', { status: 404, statusText: 'Not Found' });

    try {
      await promessa;
      fail('Deveria ter rejeitado');
    } catch (err) {
      expect(err instanceof HttpErrorResponse).toBeTrue();
      const httpErr = err as HttpErrorResponse;
      expect(httpErr.status).toBe(404);
    }
  });
});
