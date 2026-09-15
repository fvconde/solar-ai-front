import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CorretorSessao } from '../entrar/entrar-contrato';
import { SessaoStore } from '../sessao/sessao-store';
import { Painel } from './painel';
import { FilaLeadsResponse, LeadDetalheResponse } from './painel-contrato';

describe('Painel (S-21)', () => {
  let httpMock: HttpTestingController;
  let sessao: SessaoStore;
  let router: Router;

  const corretorComum: CorretorSessao = {
    id: 'c-201',
    nome: 'Diego Marques',
    especialidade: 'moradia',
  };

  const filaMock: FilaLeadsResponse = {
    total: 2,
    itens: [
      {
        id: 'l1',
        nomeExibicao: 'Marina Sales',
        referencia: '1001',
        pedidoResumo: 'Apartamento para alugar · 2 quartos · Pinheiros',
        criadoEm: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
        qualificacao: 90,
        leadStatus: 'encaminhado',
        encaminhamentoStatus: 'atribuido',
        corretor: { id: 'c-201', nome: 'Diego Marques', iniciais: 'DM' },
      },
      {
        id: 'l3',
        nomeExibicao: null,
        referencia: '4821',
        pedidoResumo: 'Apartamento para alugar · 2 quartos · Vila Madalena',
        criadoEm: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        qualificacao: 50,
        leadStatus: 'novo',
        encaminhamentoStatus: null,
        corretor: null,
      },
    ],
  };

  const detalheMockComConversa: LeadDetalheResponse = {
    id: 'l1',
    nomeExibicao: 'Marina Sales',
    referencia: '1001',
    pedidoResumo: 'Apartamento para alugar · 2 quartos · Pinheiros',
    criadoEm: '2026-09-15T15:00:00Z',
    leadStatus: 'encaminhado',
    contato: {
      telefone: '(11) 98765-4321',
      email: 'marina.sales@exemplo.com.br',
    },
    qualificacao: {
      valor: 90,
      fatores: [
        { codigo: 'finalidade', rotulo: 'Finalidade da busca', pontos: 15, preenchido: true },
        { codigo: 'bairro', rotulo: 'Bairro dentro da busca', pontos: 20, preenchido: true },
        { codigo: 'quartos', rotulo: 'Número de quartos', pontos: 15, preenchido: true },
        { codigo: 'faixa', rotulo: 'Faixa de aluguel informada', pontos: 20, preenchido: true },
        { codigo: 'prazo', rotulo: 'Prazo de mudança', pontos: 10, preenchido: false },
        {
          codigo: 'contato',
          rotulo: 'Contato confirmado para o corretor',
          pontos: 20,
          preenchido: true,
        },
      ],
    },
    resumo: {
      perfil: 'Procura apartamento de dois quartos em Pinheiros.',
      orcamento: 'Até R$ 3.600.',
      imoveis: 'Perto do metrô e da Faria Lima.',
      objecoes: 'Não aceita imóvel sem vaga.',
      proximoPasso: 'Agendar visita presencial.',
    },
    encaminhamento: {
      id: 42,
      status: 'atribuido',
      corretor: { id: 'c-201', nome: 'Renata Costa', iniciais: 'RC' },
      atribuidoEm: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    agendamento: {
      dataHora: '2026-09-18T15:30:00Z',
      status: 'confirmado',
    },
    imoveisSugeridos: [
      {
        id: 'im-1',
        tipo: 'Apartamento',
        bairro: 'Pinheiros',
        quartos: 2,
        metragem: 68,
        precoVenda: null,
        precoAluguel: 3400,
        motivo: 'Dois quartos ao lado da estação Fradique Coutinho.',
      },
    ],
    transcricao: [
      {
        papel: 'lead',
        texto: 'Olá, gostaria de ver opções em Pinheiros.',
        em: '2026-09-15T15:00:00Z',
      },
      {
        papel: 'lia',
        texto: 'Olá! Posso te ajudar. Quantos quartos procura?',
        em: '2026-09-15T15:01:00Z',
      },
      { papel: 'lead', texto: 'Preciso de 2 quartos com vaga.', em: '2026-09-15T15:02:00Z' },
      { papel: 'lia', texto: 'Qual sua faixa de valor para aluguel?', em: '2026-09-15T15:03:00Z' },
      { papel: 'lead', texto: 'Até 3600 com condomínio.', em: '2026-09-15T15:04:00Z' },
      {
        papel: 'lia',
        texto: 'Perfeito! Tenho ótimas opções para te apresentar.',
        em: '2026-09-15T15:05:00Z',
      },
    ],
  };

  const detalheSemResumoNemAgendamento: LeadDetalheResponse = {
    ...detalheMockComConversa,
    id: 'l2',
    nomeExibicao: 'Cláudia Menezes',
    resumo: null,
    agendamento: null,
    qualificacao: { valor: null, fatores: detalheMockComConversa.qualificacao.fatores },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Painel],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    sessao = TestBed.inject(SessaoStore);
    router = TestBed.inject(Router);

    sessao.definir({
      corretor: corretorComum,
      perfil: 'corretor',
      corretorId: 'c-201',
      vinculoAtivo: true,
      filtrosPermitidos: ['meus_leads'],
      filtroInicial: 'meus_leads',
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  function montarComponente(fila: FilaLeadsResponse = filaMock) {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/painel/leads');
    req.flush(fila);
    fixture.detectChanges();

    return fixture;
  }

  it('1. transcrição exibe os turnos na ordem cronológica certa', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/painel/leads/l1');
    reqDet.flush(detalheMockComConversa);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const liaMensagens = html.querySelectorAll('app-mensagem-lia');
    const pessoaMensagens = html.querySelectorAll('app-mensagem-pessoa');

    expect(liaMensagens.length).toBe(3);
    expect(pessoaMensagens.length).toBe(3);

    const falas = Array.from(html.querySelectorAll('.fala, .bolha')).map((el) =>
      el.textContent?.trim(),
    );
    expect(falas.length).toBe(6);
    expect(falas[0]).toBe('Olá, gostaria de ver opções em Pinheiros.');
    expect(falas[1]).toBe('Olá! Posso te ajudar. Quantos quartos procura?');
    expect(falas[4]).toBe('Até 3600 com condomínio.');
    expect(falas[5]).toBe('Perfeito! Tenho ótimas opções para te apresentar.');
  });

  it('2. seção de agendamento vazia permanece presente na interface', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[1]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/painel/leads/l3');
    reqDet.flush(detalheSemResumoNemAgendamento);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const secaoAgendamento = html.querySelector('.secao-agendamento');
    expect(secaoAgendamento).toBeTruthy();
    expect(secaoAgendamento?.textContent).toContain('Nenhum agendamento confirmado.');
  });

  it('3. resumo nulo exibe frase de ausência e ação "Gerar de novo" chamando sem forcar', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[1]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/painel/leads/l3');
    reqDet.flush(detalheSemResumoNemAgendamento);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const secaoResumo = html.querySelector('.secao-resumo');
    expect(secaoResumo).toBeTruthy();
    expect(secaoResumo?.textContent).toContain('Resumo ainda não disponível.');

    const botaoGerar = html.querySelector('.botao-gerar-resumo') as HTMLButtonElement;
    expect(botaoGerar).toBeTruthy();
    expect(botaoGerar.textContent).toContain('Gerar de novo');

    botaoGerar.click();
    fixture.detectChanges();

    const reqPost = httpMock.expectOne((r) => r.url === '/encaminhamentos/42/resumo');
    expect(reqPost.request.method).toBe('POST');
    expect(reqPost.request.params.has('forcar')).toBeFalse();
    reqPost.flush({
      perfil: 'Perfil gerado agora',
      orcamento: null,
      imoveis: null,
      objecoes: null,
      proximoPasso: null,
    });
    fixture.detectChanges();

    expect(html.querySelector('.secao-resumo')?.textContent).toContain('Perfil gerado agora');
  });

  it('resumo presente chama "Gerar de novo" com forcar=true', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/painel/leads/l1');
    reqDet.flush(detalheMockComConversa);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const botaoGerar = html.querySelector('.botao-gerar-resumo') as HTMLButtonElement;
    expect(botaoGerar).toBeTruthy();

    botaoGerar.click();
    fixture.detectChanges();

    const reqPost = httpMock.expectOne((r) => r.url === '/encaminhamentos/42/resumo');
    expect(reqPost.request.method).toBe('POST');
    expect(reqPost.request.params.get('forcar')).toBe('true');
    reqPost.flush({
      perfil: 'Perfil atualizado',
      orcamento: 'Novo orçamento',
      imoveis: null,
      objecoes: null,
      proximoPasso: null,
    });
    fixture.detectChanges();

    expect(html.querySelector('.secao-resumo')?.textContent).toContain('Perfil atualizado');
  });

  it('4. nenhum POST de resumo dispara em render', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/painel/leads/l1');
    reqDet.flush(detalheMockComConversa);
    fixture.detectChanges();

    const posts = httpMock.match((r) => r.method === 'POST' && r.url.includes('/resumo'));
    expect(posts.length).toBe(0);
  });

  it('5. filtros são derivados exclusivamente de filtrosPermitidos', () => {
    sessao.definir({
      corretor: { id: 's-1', nome: 'Helena Vasques', especialidade: 'moradia' },
      perfil: 'supervisor',
      corretorId: 'c-201',
      vinculoAtivo: true,
      filtrosPermitidos: ['minha_fila', 'sem_corretor', 'visao_geral'],
      filtroInicial: 'minha_fila',
    });

    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/painel/leads');
    expect(req.request.params.get('filtro')).toBe('minha_fila');
    req.flush(filaMock);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const botoes = Array.from(html.querySelectorAll('.botao-filtro')).map((b) =>
      b.textContent?.trim(),
    );
    expect(botoes).toEqual(['Minha fila', 'Sem corretor elegível', 'Visão geral']);
  });

  it('6. supervisor sem vínculo não renderiza "Minha fila" de forma alguma', () => {
    sessao.definir({
      corretor: { id: 's-2', nome: 'Marcelo Tavares', especialidade: 'geral' },
      perfil: 'supervisor',
      corretorId: null,
      vinculoAtivo: false,
      filtrosPermitidos: ['sem_corretor', 'visao_geral'],
      filtroInicial: 'sem_corretor',
    });

    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/painel/leads');
    expect(req.request.params.get('filtro')).toBe('sem_corretor');
    req.flush(filaMock);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const textoTodo = html.textContent || '';
    expect(textoTodo).not.toContain('Minha fila');

    const botoes = Array.from(html.querySelectorAll('.botao-filtro')).map((b) =>
      b.textContent?.trim(),
    );
    expect(botoes).toEqual(['Sem corretor elegível', 'Visão geral']);
  });

  it('7. estado de acesso restrito bloqueia antes de chamada de dados ou em 403', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/painel/leads');
    req.flush(
      { erro: 'perfil_insuficiente', perfilExigido: 'supervisor' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.bloco-acesso-restrito')).toBeTruthy();
    expect(html.querySelector('.titulo-restrito')?.textContent).toContain(
      'Esta área exige perfil supervisor',
    );
    expect(html.querySelector('.frase-restrito')?.textContent).toContain(
      'Sua sessão não tem essa autorização.',
    );
    expect(html.querySelector('.link-voltar-meus')).toBeTruthy();
    expect(html.querySelector('.lista-leads')).toBeNull();
  });

  it('8. telefone e e-mail aparecem em texto claro e sem máscara', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/painel/leads/l1');
    reqDet.flush(detalheMockComConversa);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const contatos = Array.from(html.querySelectorAll('.valor-contato')).map((c) =>
      c.textContent?.trim(),
    );
    expect(contatos).toContain('(11) 98765-4321');
    expect(contatos).toContain('marina.sales@exemplo.com.br');
  });

  it('9. lead fora do escopo responde 404 e exibe mensagem sem revelar existência', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead({ ...filaMock.itens[0], id: 'l999' });
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/painel/leads/l999');
    reqDet.flush({ erro: 'lead_nao_encontrado' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.coluna-detalhe .estado-feedback.erro')?.textContent).toContain(
      'Lead não encontrado.',
    );
  });

  it('10. lead sem nome é formatado como "Lead sem nome · {referencia}"', () => {
    const fixture = montarComponente();
    const html = fixture.nativeElement as HTMLElement;

    const nomes = Array.from(html.querySelectorAll('.nome-lead')).map((n) => n.textContent?.trim());
    expect(nomes).toContain('Lead sem nome · 4821');
  });

  it('11. modal de qualificação abre e exibe fatores e pesos', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/painel/leads/l1');
    reqDet.flush(detalheMockComConversa);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const botaoModal = html.querySelector('.botao-link-qualificacao') as HTMLButtonElement;
    expect(botaoModal).toBeTruthy();

    botaoModal.click();
    fixture.detectChanges();

    const modal = html.querySelector('.modal-conteudo');
    expect(modal).toBeTruthy();
    expect(modal?.textContent).toContain('Como a qualificação é calculada');
    expect(modal?.textContent).toContain('Finalidade da busca');
    expect(modal?.textContent).toContain('+15');
    expect(modal?.textContent).toContain('Informado');

    const botaoFechar = html.querySelector('.botao-fechar-modal') as HTMLButtonElement;
    botaoFechar.click();
    fixture.detectChanges();

    expect(html.querySelector('.modal-conteudo')).toBeNull();
  });

  it('12. 401 na fila limpa a sessão e redireciona para /entrar', () => {
    const navegou = spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/painel/leads')
      .flush('Sessão inválida', { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(sessao.corretor()).toBeNull();
    expect(navegou).toHaveBeenCalledWith(['/entrar']);
  });

  it('13. frases de vazio exibem texto literal com acentuação correta para cada filtro', () => {
    // meus_leads
    const f1 = montarComponente({ total: 0, itens: [] });
    expect(f1.nativeElement.querySelector('.fila-vazia')?.textContent).toContain(
      'Você não tem leads atribuídos agora. Quando a Lia encaminhar um lead para você, ele aparece aqui.',
    );

    // supervisor sem_corretor
    sessao.definir({
      corretor: { id: 's-1', nome: 'Helena', especialidade: 'geral' },
      perfil: 'supervisor',
      corretorId: null,
      vinculoAtivo: false,
      filtrosPermitidos: ['sem_corretor', 'visao_geral'],
      filtroInicial: 'sem_corretor',
    });
    const f2 = TestBed.createComponent(Painel);
    f2.detectChanges();
    httpMock.expectOne((r) => r.url === '/painel/leads').flush({ total: 0, itens: [] });
    f2.detectChanges();
    expect(f2.nativeElement.querySelector('.fila-vazia')?.textContent).toContain(
      'Nenhum lead sem corretor elegível agora.',
    );
  });

  it('14. resumo presente com as cinco seções nulas exibe ausência e chama "Gerar de novo" com forcar=true', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/painel/leads/l1');
    reqDet.flush({
      ...detalheMockComConversa,
      resumo: {
        perfil: null,
        orcamento: null,
        imoveis: null,
        objecoes: null,
        proximoPasso: null,
      },
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.secao-resumo')?.textContent).toContain(
      'Resumo ainda não disponível.',
    );

    const botaoGerar = html.querySelector('.botao-gerar-resumo') as HTMLButtonElement;
    expect(botaoGerar).toBeTruthy();

    botaoGerar.click();
    fixture.detectChanges();

    const reqPost = httpMock.expectOne((r) => r.url === '/encaminhamentos/42/resumo');
    expect(reqPost.request.method).toBe('POST');
    expect(reqPost.request.params.get('forcar')).toBe('true');
    reqPost.flush({
      perfil: 'Perfil regenerado com sucesso',
      orcamento: null,
      imoveis: null,
      objecoes: null,
      proximoPasso: null,
    });
    fixture.detectChanges();

    expect(html.querySelector('.secao-resumo')?.textContent).toContain(
      'Perfil regenerado com sucesso',
    );
  });

  it('15. situação do encaminhamento e linha do corretor usam ponto médio e rótulos sem narrar causa', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    // Caso 1: atribuído com corretor -> "Renata Costa · atribuído há ..."
    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();
    const reqDet1 = httpMock.expectOne('/painel/leads/l1');
    reqDet1.flush(detalheMockComConversa);
    fixture.detectChanges();

    const html1 = fixture.nativeElement as HTMLElement;
    expect(html1.querySelector('.linha-corretor')?.textContent).toContain('Renata Costa ·');

    // Caso 2: encaminhamento nulo -> "Ainda não encaminhado"
    comp.selecionarLead(filaMock.itens[1]);
    fixture.detectChanges();
    const reqDet2 = httpMock.expectOne('/painel/leads/l3');
    reqDet2.flush({
      ...detalheSemResumoNemAgendamento,
      encaminhamento: null,
    });
    fixture.detectChanges();

    const html2 = fixture.nativeElement as HTMLElement;
    expect(html2.querySelector('.linha-corretor')?.textContent?.trim()).toBe(
      'Ainda não encaminhado',
    );

    // Caso 3: encaminhamento aguardando -> "Sem corretor elegível"
    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();
    const reqDet3 = httpMock.expectOne('/painel/leads/l1');
    reqDet3.flush({
      ...detalheMockComConversa,
      encaminhamento: { id: 99, status: 'aguardando', corretor: null, atribuidoEm: '' },
    });
    fixture.detectChanges();

    const html3 = fixture.nativeElement as HTMLElement;
    expect(html3.querySelector('.linha-corretor')?.textContent?.trim()).toBe(
      'Sem corretor elegível',
    );
  });

  it('16. link voltar para Meus leads a partir de acesso restrito redefine filtro e recarrega a fila', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const req403 = httpMock.expectOne((r) => r.url === '/painel/leads');
    req403.flush({ erro: 'perfil_insuficiente' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const linkVoltar = html.querySelector('.link-voltar-meus') as HTMLButtonElement;
    expect(linkVoltar).toBeTruthy();

    linkVoltar.click();
    fixture.detectChanges();

    const reqReload = httpMock.expectOne((r) => r.url === '/painel/leads');
    expect(reqReload.request.params.get('filtro')).toBe('meus_leads');
    reqReload.flush(filaMock);
    fixture.detectChanges();

    expect(html.querySelector('.bloco-acesso-restrito')).toBeNull();
    expect(html.querySelectorAll('.item-lead').length).toBe(2);
  });
});
