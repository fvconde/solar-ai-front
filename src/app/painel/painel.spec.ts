import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CorretorSessao } from '../entrar/entrar-contrato';
import { SessaoStore } from '../sessao/sessao-store';
import { Painel } from './painel';
import { FilaLeadsResponse } from './painel-contrato';

describe('Painel', () => {
  let httpMock: HttpTestingController;
  let sessao: SessaoStore;

  const corretorLogado: CorretorSessao = {
    id: '3f6b9c21-4d0a-4c7e-9a11-000000000001',
    nome: 'Helena Braga',
    especialidade: 'moradia',
  };

  const filaLeadsMock: FilaLeadsResponse = {
    total: 4,
    leads: [
      {
        id: '0191e4b8-0001-7000-8000-000000000001',
        nome: 'Lead Score 100',
        intencao: 'compra',
        score: 100,
        ultimaInteracao: '2026-09-10T10:00:00Z',
        status: 'encaminhado',
        corretorId: '3f6b9c21-4d0a-4c7e-9a11-000000000001',
        corretorNome: 'Helena Braga',
        regiao: 'Pinheiros',
      },
      {
        id: '0191e4b8-0002-7000-8000-000000000002',
        nome: 'Lead Score 80',
        intencao: 'aluguel',
        score: 80,
        ultimaInteracao: '2026-09-10T09:30:00Z',
        status: 'encaminhado',
        corretorId: '3f6b9c21-4d0a-4c7e-9a11-000000000001',
        corretorNome: 'Helena Braga',
        regiao: 'Vila Mariana',
      },
      {
        id: '0191e4b8-0003-7000-8000-000000000003',
        nome: 'Lead Score 70',
        intencao: 'investimento',
        score: 70,
        ultimaInteracao: '2026-09-10T09:00:00Z',
        status: 'encaminhado',
        corretorId: '3f6b9c21-4d0a-4c7e-9a11-000000000002',
        corretorNome: 'Rafael Nunes',
        regiao: 'Moema',
      },
      {
        id: '0191e4b8-0004-7000-8000-000000000004',
        nome: 'Lead Score 45',
        intencao: 'compra',
        score: 45,
        ultimaInteracao: '2026-09-10T08:30:00Z',
        status: 'novo',
        corretorId: null,
        corretorNome: null,
        regiao: 'Butantã',
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Painel],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    sessao = TestBed.inject(SessaoStore);
    sessao.definir(corretorLogado);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function montarComFila(fila: FilaLeadsResponse = filaLeadsMock) {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url === '/painel/leads').flush(fila);
    fixture.detectChanges();
    return fixture;
  }

  it('carrega a fila direto da sessão, sem pedir chave nem mostrar grade de corretores', () => {
    const fixture = montarComFila();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.cartao-identificacao')).toBeNull();
    expect(html.querySelector('.input-chave')).toBeNull();
    expect(html.querySelector('.grade-corretores')).toBeNull();
    expect(html.querySelector('.tabela-leads')).toBeTruthy();
    expect(html.querySelector('.nome-ativo')?.textContent).toContain('Helena Braga');
  });

  it('não envia X-Chave-Privacidade nem X-Corretor-Id e usa credenciais do cookie', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/painel/leads');
    expect(req.request.headers.has('X-Chave-Privacidade')).toBeFalse();
    expect(req.request.headers.has('X-Corretor-Id')).toBeFalse();
    expect(req.request.headers.has('X-Admin-Key')).toBeFalse();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.withCredentials).toBeTrue();
    req.flush(filaLeadsMock);
  });

  it('nunca chama o endpoint removido /painel/corretores', () => {
    montarComFila();
    expect(httpMock.match('/painel/corretores').length).toBe(0);
  });

  it('ordenação coloca score 100 acima do 45', () => {
    const fixture = montarComFila();
    const html = fixture.nativeElement as HTMLElement;
    const scores = Array.from(html.querySelectorAll('.badge-score')).map((el) =>
      el.textContent?.trim()
    );

    expect(scores[0]).toBe('100');
    expect(scores[3]).toBe('45');
  });

  it('tabela não exibe colunas de contato nem telefone nem email (LGPD)', () => {
    const fixture = montarComFila();
    const html = fixture.nativeElement as HTMLElement;
    const headers = Array.from(html.querySelectorAll('th')).map((th) => th.textContent?.trim());

    expect(headers).not.toContain('Contato');
    expect(headers).not.toContain('Telefone');
    expect(headers).not.toContain('Email');
    expect(html.querySelector('.celula-contato')).toBeNull();
  });

  it('lead sem corretor aparece marcado e não escondido', () => {
    const fixture = montarComFila();
    const html = fixture.nativeElement as HTMLElement;
    const semCorretor = html.querySelector('.badge-sem-corretor');

    expect(semCorretor).toBeTruthy();
    expect(semCorretor?.textContent).toContain('Sem corretor');
  });

  it('filtro meus leads refaz a chamada sem cabeçalho de identidade', () => {
    const fixture = montarComFila();
    expect(fixture.componentInstance.leads().length).toBe(4);

    fixture.componentInstance.alternarFiltroMeusLeads();
    fixture.detectChanges();

    const reqMeus = httpMock.expectOne((req) => req.url === '/painel/leads');
    expect(reqMeus.request.headers.has('X-Corretor-Id')).toBeFalse();
    expect(reqMeus.request.params.get('meusLeads')).toBe('true');

    reqMeus.flush({ total: 2, leads: filaLeadsMock.leads.slice(0, 2) });
    fixture.detectChanges();

    expect(fixture.componentInstance.leads().length).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.linha-lead').length).toBe(2);
  });

  it('fila vazia mostra estado vazio e não tabela em branco', () => {
    const fixture = montarComFila({ total: 0, leads: [] });
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.estado-vazio')).toBeTruthy();
    expect(html.querySelector('.estado-vazio')?.textContent).toContain('Nenhum lead na fila');
    expect(html.querySelector('.tabela-leads')).toBeNull();
  });

  it('401 na fila limpa a sessão em memória e volta para o login', () => {
    const router = TestBed.inject(Router);
    const navegou = spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    httpMock
      .expectOne((req) => req.url === '/painel/leads')
      .flush('Sessão inválida', { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(sessao.corretor()).toBeNull();
    expect(navegou).toHaveBeenCalledWith(['/entrar']);
    expect(fixture.componentInstance.leads().length).toBe(0);
  });
});
