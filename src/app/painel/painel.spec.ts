import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Painel } from './painel';
import { CorretorIdentificacao, FilaLeadsResponse } from './painel-contrato';

describe('Painel', () => {
  let httpMock: HttpTestingController;
  const chaveValida = 'chave_teste_painel_123';

  const corretoresMock: CorretorIdentificacao[] = [
    {
      id: '3f6b9c21-4d0a-4c7e-9a11-000000000001',
      nome: 'Helena Braga',
      especialidade: 'moradia',
    },
    {
      id: '3f6b9c21-4d0a-4c7e-9a11-000000000002',
      nome: 'Rafael Nunes',
      especialidade: 'moradia',
    },
  ];

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
        regiao: 'Perdizes',
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Painel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('inicia pedindo a chave de acesso e não exibe corretores nem fila', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.cartao-identificacao')).toBeTruthy();
    expect(html.querySelector('.input-chave')).toBeTruthy();
    expect(html.querySelector('.grade-corretores')).toBeNull();
    expect(html.querySelector('.tabela-leads')).toBeNull();
  });

  it('valida a chave de acesso, carrega os corretores com header X-Chave-Privacidade e permite identificar', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    fixture.componentInstance.chaveAcesso.set(chaveValida);
    fixture.componentInstance.autenticarChave();
    fixture.detectChanges();

    const reqCorretores = httpMock.expectOne('/painel/corretores');
    expect(reqCorretores.request.method).toBe('GET');
    expect(reqCorretores.request.headers.get('X-Chave-Privacidade')).toBe(chaveValida);
    reqCorretores.flush(corretoresMock);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const botoes = html.querySelectorAll('.botao-corretor');
    expect(botoes.length).toBe(2);
    expect(botoes[0].textContent).toContain('Helena Braga');

    // Identifica corretor Helena Braga
    fixture.componentInstance.identificarCorretor(corretoresMock[0]);
    fixture.detectChanges();

    const reqLeads = httpMock.expectOne((req) => req.url === '/painel/leads');
    expect(reqLeads.request.headers.get('X-Chave-Privacidade')).toBe(chaveValida);
    expect(reqLeads.request.headers.get('X-Corretor-Id')).toBe(corretoresMock[0].id);
    reqLeads.flush(filaLeadsMock);
    fixture.detectChanges();

    expect(html.querySelector('.tabela-leads')).toBeTruthy();
    expect(html.querySelector('.nome-ativo')?.textContent).toContain('Helena Braga');
    expect(html.querySelectorAll('.linha-lead').length).toBe(4);
  });

  it('ordenação coloca score 100 acima do 45', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    fixture.componentInstance.chaveAcesso.set(chaveValida);
    fixture.componentInstance.autenticarChave();

    httpMock.expectOne('/painel/corretores').flush(corretoresMock);
    fixture.componentInstance.identificarCorretor(corretoresMock[0]);

    httpMock.expectOne((req) => req.url === '/painel/leads').flush(filaLeadsMock);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const scores = Array.from(html.querySelectorAll('.badge-score')).map((el) =>
      el.textContent?.trim()
    );

    expect(scores[0]).toBe('100');
    expect(scores[3]).toBe('45');
    expect(Number(scores[0])).toBeGreaterThan(Number(scores[3]));
  });

  it('tabela não exibe colunas de contato nem telefone nem email (LGPD)', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    fixture.componentInstance.chaveAcesso.set(chaveValida);
    fixture.componentInstance.autenticarChave();
    httpMock.expectOne('/painel/corretores').flush(corretoresMock);
    fixture.componentInstance.identificarCorretor(corretoresMock[0]);
    httpMock.expectOne((req) => req.url === '/painel/leads').flush(filaLeadsMock);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const headers = Array.from(html.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).not.toContain('Contato');
    expect(headers).not.toContain('Telefone');
    expect(headers).not.toContain('Email');
    expect(html.querySelector('.celula-contato')).toBeNull();
  });

  it('lead sem corretor aparece marcado e não escondido', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    fixture.componentInstance.chaveAcesso.set(chaveValida);
    fixture.componentInstance.autenticarChave();
    httpMock.expectOne('/painel/corretores').flush(corretoresMock);
    fixture.componentInstance.identificarCorretor(corretoresMock[0]);
    httpMock.expectOne((req) => req.url === '/painel/leads').flush(filaLeadsMock);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const semCorretor = html.querySelector('.badge-sem-corretor');
    expect(semCorretor).toBeTruthy();
    expect(semCorretor?.textContent).toContain('Sem corretor');
  });

  it('filtro meus leads muda a lista enviando ambos os cabeçalhos de segurança', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    fixture.componentInstance.chaveAcesso.set(chaveValida);
    fixture.componentInstance.autenticarChave();
    httpMock.expectOne('/painel/corretores').flush(corretoresMock);
    fixture.componentInstance.identificarCorretor(corretoresMock[0]);
    httpMock.expectOne((req) => req.url === '/painel/leads').flush(filaLeadsMock);
    fixture.detectChanges();

    expect(fixture.componentInstance.leads().length).toBe(4);

    // Ativa filtro "meus leads"
    fixture.componentInstance.alternarFiltroMeusLeads();
    fixture.detectChanges();

    const reqMeus = httpMock.expectOne((req) => req.url === '/painel/leads');
    expect(reqMeus.request.headers.get('X-Chave-Privacidade')).toBe(chaveValida);
    expect(reqMeus.request.headers.get('X-Corretor-Id')).toBe(corretoresMock[0].id);
    expect(reqMeus.request.params.get('meusLeads')).toBe('true');

    const apenasHelena: FilaLeadsResponse = {
      total: 2,
      leads: filaLeadsMock.leads.slice(0, 2),
    };
    reqMeus.flush(apenasHelena);
    fixture.detectChanges();

    expect(fixture.componentInstance.leads().length).toBe(2);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelectorAll('.linha-lead').length).toBe(2);
  });

  it('fila vazia mostra estado vazio e não tabela em branco', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    fixture.componentInstance.chaveAcesso.set(chaveValida);
    fixture.componentInstance.autenticarChave();
    httpMock.expectOne('/painel/corretores').flush(corretoresMock);
    fixture.componentInstance.identificarCorretor(corretoresMock[0]);
    httpMock.expectOne((req) => req.url === '/painel/leads').flush({
      total: 0,
      leads: [],
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.estado-vazio')).toBeTruthy();
    expect(html.querySelector('.estado-vazio')?.textContent).toContain('Nenhum lead na fila');
    expect(html.querySelector('.tabela-leads')).toBeNull();
  });

  it('chave inválida exibe mensagem de erro', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    fixture.componentInstance.chaveAcesso.set('chave_falsa');
    fixture.componentInstance.autenticarChave();

    httpMock.expectOne('/painel/corretores').flush('Chave inválida', {
      status: 403,
      statusText: 'Forbidden',
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.erroAutenticacao()).toContain('inválida');
    expect(html.querySelector('.mensagem-erro')).toBeTruthy();
    expect(fixture.componentInstance.corretores().length).toBe(0);
  });
});
