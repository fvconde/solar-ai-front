import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { UsuarioSessao } from '../sessao/sessao-contrato';
import { SessaoStore } from '../sessao/sessao-store';
import { Painel } from './painel';
import { FilaLeadsResponse, LeadDetalheResponse } from './painel-contrato';

describe('Painel (S-21)', () => {
  let httpMock: HttpTestingController;
  let sessao: SessaoStore;
  let router: Router;

  const corretorComum: UsuarioSessao = {
    id: 'c-201',
    nome: 'Diego Marques',
    email: 'corretor@solar.com.br',
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
      fim: '2026-09-18T16:30:00Z',
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
      usuario: corretorComum,
      perfil: 'corretor',
      statusCorretor: 'aprovado',
      pendentesAprovacao: null,
      corretorId: 'c-201',
      vinculoAtivo: true,
      filtrosPermitidos: ['meus_leads'],
      filtroInicial: 'meus_leads',
    });
  });

  afterEach(() => {
    httpMock.match('/api/conta');
    httpMock.match('/api/painel/corretores/pendentes');
    httpMock.verify();
  });

  function montarComponente(fila: FilaLeadsResponse = filaMock) {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/api/painel/leads');
    req.flush(fila);
    fixture.detectChanges();

    return fixture;
  }

  it('1. transcrição exibe os turnos na ordem cronológica certa', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
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

    const reqDet = httpMock.expectOne('/api/painel/leads/l3');
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

    const reqDet = httpMock.expectOne('/api/painel/leads/l3');
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

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
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

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
    reqDet.flush(detalheMockComConversa);
    fixture.detectChanges();

    const posts = httpMock.match((r) => r.method === 'POST' && r.url.includes('/resumo'));
    expect(posts.length).toBe(0);
  });

  it('5. filtros são derivados exclusivamente de filtrosPermitidos', () => {
    sessao.definir({
      usuario: { id: 's-1', nome: 'Helena Vasques', email: 'supervisor@solar.com.br' },
      perfil: 'supervisor',
      statusCorretor: 'aprovado',
      pendentesAprovacao: 0,
      corretorId: 'c-201',
      vinculoAtivo: true,
      filtrosPermitidos: ['minha_fila', 'sem_corretor', 'visao_geral'],
      filtroInicial: 'minha_fila',
    });

    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    httpMock.expectOne('/api/painel/corretores/pendentes').flush([]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#aba-minha_fila') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/api/painel/leads');
    expect(req.request.params.get('filtro')).toBe('minha_fila');
    req.flush(filaMock);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelectorAll('[role="tab"]').length).toBe(4);
    expect(html.querySelector('.seletor-filtros')).toBeNull();
    expect(html.querySelector('#aba-minha_fila')?.getAttribute('aria-selected')).toBe('true');
    const botoes = Array.from(html.querySelectorAll('.aba-supervisor')).map((b) =>
      b.textContent?.trim(),
    );
    expect(botoes).toEqual(['Visão geral', 'Minha fila', 'Sem corretor elegível', 'Novos corretores']);
  });

  it('6. supervisor sem vínculo não renderiza "Minha fila" de forma alguma', () => {
    sessao.definir({
      usuario: { id: 's-2', nome: 'Marcelo Tavares', email: 'supervisor@solar.com.br' },
      perfil: 'supervisor',
      statusCorretor: 'aprovado',
      pendentesAprovacao: 0,
      corretorId: null,
      vinculoAtivo: false,
      filtrosPermitidos: ['sem_corretor', 'visao_geral'],
      filtroInicial: 'sem_corretor',
    });

    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    httpMock.expectOne('/api/painel/corretores/pendentes').flush([]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#aba-sem_corretor') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/api/painel/leads');
    expect(req.request.params.get('filtro')).toBe('sem_corretor');
    req.flush(filaMock);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const textoTodo = html.textContent || '';
    expect(textoTodo).not.toContain('Minha fila');

    const botoes = Array.from(html.querySelectorAll('.aba-supervisor')).map((b) =>
      b.textContent?.trim(),
    );
    expect(botoes).toEqual(['Visão geral', 'Sem corretor elegível', 'Novos corretores']);
  });

  it('7. estado de acesso restrito bloqueia antes de chamada de dados ou em 403', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/api/painel/leads');
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

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
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

    const reqDet = httpMock.expectOne('/api/painel/leads/l999');
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

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
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
      .expectOne((r) => r.url === '/api/painel/leads')
      .flush('Sessão inválida', { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(sessao.usuario()).toBeNull();
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
      usuario: { id: 's-1', nome: 'Helena', email: 'supervisor@solar.com.br' },
      perfil: 'supervisor',
      statusCorretor: 'aprovado',
      pendentesAprovacao: 0,
      corretorId: null,
      vinculoAtivo: false,
      filtrosPermitidos: ['sem_corretor', 'visao_geral'],
      filtroInicial: 'sem_corretor',
    });
    const f2 = TestBed.createComponent(Painel);
    f2.detectChanges();
    httpMock.expectOne('/api/painel/corretores/pendentes').flush([]);
    f2.detectChanges();
    (f2.nativeElement.querySelector('#aba-sem_corretor') as HTMLButtonElement).click();
    f2.detectChanges();
    httpMock.expectOne((r) => r.url === '/api/painel/leads').flush({ total: 0, itens: [] });
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

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
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

  it('15. situação do lead e do encaminhamento nunca exibem o mesmo texto (G1)', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    // Caso 1: Na lista (item com encaminhamento nulo não repete 'Ainda não encaminhado')
    const html = fixture.nativeElement as HTMLElement;
    const itens = html.querySelectorAll('.item-lead');
    itens.forEach((item) => {
      const linhaLead = item.querySelector('.linha-status-lead')?.textContent?.trim();
      const linhaEnc = item.querySelector('.linha-status-encaminhamento')?.textContent?.trim();
      if (linhaEnc) {
        expect(linhaLead).not.toEqual(linhaEnc);
      }
    });

    // Caso 2: No detalhe com encaminhamento nulo -> não renderiza linha de encaminhamento
    comp.selecionarLead(filaMock.itens[1]);
    fixture.detectChanges();
    const reqDet2 = httpMock.expectOne('/api/painel/leads/l3');
    reqDet2.flush({
      ...detalheSemResumoNemAgendamento,
      leadStatus: 'novo',
      encaminhamento: null,
    });
    fixture.detectChanges();

    const situacao2 = html.querySelector('.secao-situacao');
    expect(situacao2?.textContent).toContain('Ainda não encaminhado');
    // Não renderiza rótulo Encaminhamento nem repete 'Ainda não encaminhado'
    expect(situacao2?.textContent).not.toContain('Encaminhamento');
    expect(html.querySelector('.linha-corretor')).toBeNull();

    // Caso 3: No detalhe com encaminhamento aguardando -> 'Encaminhado' vs 'Sem corretor elegível'
    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();
    const reqDet3 = httpMock.expectOne('/api/painel/leads/l1');
    reqDet3.flush({
      ...detalheMockComConversa,
      leadStatus: 'encaminhado',
      encaminhamento: { id: 99, status: 'aguardando', corretor: null, atribuidoEm: '' },
    });
    fixture.detectChanges();

    const situacao3 = html.querySelector('.secao-situacao');
    expect(situacao3?.textContent).toContain('Encaminhado');
    expect(situacao3?.textContent).toContain('Sem corretor elegível');
    expect(situacao3?.querySelectorAll('.rotulo-estado')[0]?.textContent?.trim()).toBe(
      'Encaminhado',
    );
    expect(situacao3?.querySelectorAll('.rotulo-estado')[1]?.textContent?.trim()).toBe(
      'Sem corretor elegível',
    );
  });

  it('16. "Atribuído" não tem marca de estado nem no detalhe nem na lista (G2)', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    // Na lista:
    const html = fixture.nativeElement as HTMLElement;
    const atribuidoLista = html.querySelector('.texto-simples-atribuido');
    expect(atribuidoLista).toBeTruthy();
    expect(atribuidoLista?.textContent?.trim()).toBe('Atribuído');
    expect(atribuidoLista?.querySelector('.marca-estado')).toBeNull();
    expect(atribuidoLista?.closest('.badge-estado')).toBeNull();

    // No detalhe:
    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();
    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
    reqDet.flush(detalheMockComConversa);
    fixture.detectChanges();

    const situacao = html.querySelector('.secao-situacao');
    const atribuidoDetalhe = situacao?.querySelector('.texto-simples-atribuido');
    expect(atribuidoDetalhe).toBeTruthy();
    expect(atribuidoDetalhe?.textContent?.trim()).toBe('Atribuído');
    expect(atribuidoDetalhe?.querySelector('.marca-estado')).toBeNull();
    expect(atribuidoDetalhe?.closest('.badge-estado')).toBeNull();
    // A linha do corretor usa ponto médio
    expect(situacao?.querySelector('.linha-corretor')?.textContent).toContain('Renata Costa ·');
  });

  it('17. link voltar para Meus leads a partir de acesso restrito redefine filtro e recarrega a fila', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();

    const req403 = httpMock.expectOne((r) => r.url === '/api/painel/leads');
    req403.flush({ erro: 'perfil_insuficiente' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const linkVoltar = html.querySelector('.link-voltar-meus') as HTMLButtonElement;
    expect(linkVoltar).toBeTruthy();

    linkVoltar.click();
    fixture.detectChanges();

    const reqReload = httpMock.expectOne((r) => r.url === '/api/painel/leads');
    expect(reqReload.request.params.get('filtro')).toBe('meus_leads');
    reqReload.flush(filaMock);
    fixture.detectChanges();

    expect(html.querySelector('.bloco-acesso-restrito')).toBeNull();
    expect(html.querySelectorAll('.item-lead').length).toBe(2);
  });

  it('18. agendamento confirmado exibe bloco OUT 7, intervalo no horario de Brasilia e nome do corretor', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
    reqDet.flush({
      ...detalheMockComConversa,
      encaminhamento: {
        ...detalheMockComConversa.encaminhamento!,
        corretor: { id: 'c-201', nome: 'Helena Braga', iniciais: 'HB' },
      },
      agendamento: {
        dataHora: '2026-10-07T17:00:00Z',
        fim: '2026-10-07T18:00:00Z',
        status: 'confirmado',
      },
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const secao = html.querySelector('.secao-agendamento') as HTMLElement;
    expect(secao).toBeTruthy();

    const bloco = secao.querySelector('.bloco-data-agendamento') as HTMLElement;
    expect(bloco).toBeTruthy();

    const mes = secao.querySelector('.mes-agendamento');
    const dia = secao.querySelector('.dia-agendamento');
    expect(mes?.textContent?.trim()).toBe('OUT');
    expect(dia?.textContent?.trim()).toBe('7');

    const principal = secao.querySelector('.principal-agendamento');
    expect(principal?.textContent?.trim()).toBe('Quarta · 14h às 15h');

    const secundaria = secao.querySelector('.secundaria-agendamento');
    expect(secundaria?.textContent?.trim()).toBe('Com Helena Braga · confirmada pelo lead no chat');

    expect(secao.querySelector('.badge-estado')).toBeNull();
  });

  it('19. agendamento com duracao de 90 minutos exibe termino real e exclui termino presumido de 15h', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
    reqDet.flush({
      ...detalheMockComConversa,
      agendamento: {
        dataHora: '2026-10-07T17:00:00Z',
        fim: '2026-10-07T18:30:00Z',
        status: 'confirmado',
      },
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const secao = html.querySelector('.secao-agendamento') as HTMLElement;
    const principal = secao.querySelector('.principal-agendamento');

    expect(principal?.textContent?.trim()).toBe('Quarta · 14h às 15h30');
    expect(principal?.textContent?.trim().endsWith('15h')).toBeFalse();
    expect(principal?.textContent?.trim()).not.toBe('Quarta · 14h às 15h');
  });

  it('20. agendamento com mudanca de data UTC/SP exibe dia correto em Brasilia e intervalo com minutos', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
    reqDet.flush({
      ...detalheMockComConversa,
      agendamento: {
        dataHora: '2026-10-01T01:30:00Z',
        fim: '2026-10-01T03:00:00Z',
        status: 'confirmado',
      },
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const secao = html.querySelector('.secao-agendamento') as HTMLElement;
    const mes = secao.querySelector('.mes-agendamento');
    const dia = secao.querySelector('.dia-agendamento');
    const principal = secao.querySelector('.principal-agendamento');

    expect(mes?.textContent?.trim()).toBe('SET');
    expect(dia?.textContent?.trim()).toBe('30');
    expect(principal?.textContent?.trim()).toBe('Quarta · 22h30 às 0h');
  });

  it('21. agendamento nulo ou com status nao confirmado preserva frase de ausencia sem bloco de data', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet1 = httpMock.expectOne('/api/painel/leads/l1');
    reqDet1.flush({
      ...detalheMockComConversa,
      agendamento: null,
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const secao1 = html.querySelector('.secao-agendamento') as HTMLElement;
    expect(secao1.textContent).toContain('Nenhum agendamento confirmado.');
    expect(secao1.querySelector('.bloco-data-agendamento')).toBeNull();

    comp.selecionarLead(filaMock.itens[1]);
    fixture.detectChanges();

    const reqDet2 = httpMock.expectOne('/api/painel/leads/l3');
    reqDet2.flush({
      ...detalheMockComConversa,
      id: 'l3',
      agendamento: {
        dataHora: '2026-10-07T17:00:00Z',
        fim: '2026-10-07T18:00:00Z',
        status: 'pendente',
      },
    });
    fixture.detectChanges();

    const secao2 = html.querySelector('.secao-agendamento') as HTMLElement;
    expect(secao2.textContent).toContain('Nenhum agendamento confirmado.');
    expect(secao2.querySelector('.bloco-data-agendamento')).toBeNull();
    expect(secao2.querySelector('.linha-agendamento')).toBeNull();
  });

  it('22. fallback neutro usa Corretor(a) quando encaminhamento, corretor ou nome estao ausentes ou em branco', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet1 = httpMock.expectOne('/api/painel/leads/l1');
    reqDet1.flush({
      ...detalheMockComConversa,
      encaminhamento: null,
      agendamento: {
        dataHora: '2026-10-07T17:00:00Z',
        fim: '2026-10-07T18:00:00Z',
        status: 'confirmado',
      },
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    let sec = html.querySelector('.secundaria-agendamento');
    expect(sec?.textContent?.trim()).toBe('Com Corretor(a) · confirmada pelo lead no chat');

    comp.selecionarLead(filaMock.itens[1]);
    fixture.detectChanges();

    const reqDet2 = httpMock.expectOne('/api/painel/leads/l3');
    reqDet2.flush({
      ...detalheMockComConversa,
      id: 'l3',
      encaminhamento: {
        id: 99,
        status: 'atribuido',
        corretor: null,
        atribuidoEm: '2026-10-07T10:00:00Z',
      },
      agendamento: {
        dataHora: '2026-10-07T17:00:00Z',
        fim: '2026-10-07T18:00:00Z',
        status: 'confirmado',
      },
    });
    fixture.detectChanges();

    sec = html.querySelector('.secundaria-agendamento');
    expect(sec?.textContent?.trim()).toBe('Com Corretor(a) · confirmada pelo lead no chat');

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet3 = httpMock.expectOne('/api/painel/leads/l1');
    reqDet3.flush({
      ...detalheMockComConversa,
      encaminhamento: {
        id: 100,
        status: 'atribuido',
        corretor: { id: 'c-300', nome: '   ', iniciais: '' },
        atribuidoEm: '2026-10-07T10:00:00Z',
      },
      agendamento: {
        dataHora: '2026-10-07T17:00:00Z',
        fim: '2026-10-07T18:00:00Z',
        status: 'confirmado',
      },
    });
    fixture.detectChanges();

    sec = html.querySelector('.secundaria-agendamento');
    expect(sec?.textContent?.trim()).toBe('Com Corretor(a) · confirmada pelo lead no chat');
  });

  it('23. computedStyle nos temas claro e escuro corresponde aos probes dos tokens e respeita dimensoes exatas', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
    reqDet.flush({
      ...detalheMockComConversa,
      agendamento: {
        dataHora: '2026-10-07T17:00:00Z',
        fim: '2026-10-07T18:00:00Z',
        status: 'confirmado',
      },
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const secao = html.querySelector('.secao-agendamento') as HTMLElement;
    const linha = secao.querySelector('.linha-agendamento') as HTMLElement;
    const bloco = secao.querySelector('.bloco-data-agendamento') as HTMLElement;
    const mes = secao.querySelector('.mes-agendamento') as HTMLElement;
    const dia = secao.querySelector('.dia-agendamento') as HTMLElement;
    const info = secao.querySelector('.info-agendamento') as HTMLElement;
    const principal = secao.querySelector('.principal-agendamento') as HTMLElement;
    const secundaria = secao.querySelector('.secundaria-agendamento') as HTMLElement;

    const probeMarca = document.createElement('div');
    probeMarca.style.backgroundColor = 'var(--marca)';
    probeMarca.style.color = 'var(--marca-contraste)';
    const probeTexto = document.createElement('div');
    probeTexto.style.color = 'var(--texto-primario)';
    probeTexto.style.backgroundColor = 'var(--texto-secundario)';
    document.body.appendChild(probeMarca);
    document.body.appendChild(probeTexto);

    try {
      document.documentElement.setAttribute('data-tema', 'claro');
      const estiloMarcaClaro = window.getComputedStyle(probeMarca);
      const estiloTextoClaro = window.getComputedStyle(probeTexto);
      const estiloBlocoClaro = window.getComputedStyle(bloco);
      const estiloPrincClaro = window.getComputedStyle(principal);
      const estiloSecClaro = window.getComputedStyle(secundaria);

      expect(estiloBlocoClaro.backgroundColor).toBe(estiloMarcaClaro.backgroundColor);
      expect(estiloBlocoClaro.color).toBe(estiloMarcaClaro.color);
      expect(estiloPrincClaro.color).toBe(estiloTextoClaro.color);
      expect(estiloSecClaro.color).toBe(estiloTextoClaro.backgroundColor);

      const corMarcaClara = estiloMarcaClaro.backgroundColor;
      const corTextoClara = estiloTextoClaro.color;

      document.documentElement.setAttribute('data-tema', 'escuro');
      const estiloMarcaEscuro = window.getComputedStyle(probeMarca);
      const estiloTextoEscuro = window.getComputedStyle(probeTexto);
      const estiloBlocoEscuro = window.getComputedStyle(bloco);
      const estiloPrincEscuro = window.getComputedStyle(principal);
      const estiloSecEscuro = window.getComputedStyle(secundaria);

      expect(estiloBlocoEscuro.backgroundColor).toBe(estiloMarcaEscuro.backgroundColor);
      expect(estiloBlocoEscuro.color).toBe(estiloMarcaEscuro.color);
      expect(estiloPrincEscuro.color).toBe(estiloTextoEscuro.color);
      expect(estiloSecEscuro.color).toBe(estiloTextoEscuro.backgroundColor);

      expect(estiloMarcaEscuro.backgroundColor).not.toBe(corMarcaClara);
      expect(estiloTextoEscuro.color).not.toBe(corTextoClara);

      expect(estiloBlocoEscuro.width).toBe('64px');
      expect(estiloBlocoEscuro.height).toBe('64px');
      expect(estiloBlocoEscuro.borderRadius).toBe('10px');
      expect(estiloBlocoEscuro.flexShrink).toBe('0');
      expect(estiloBlocoEscuro.fontWeight).toBe('600');
      expect(estiloBlocoEscuro.fontFamily).toContain('Instrument Sans');

      const estiloMes = window.getComputedStyle(mes);
      expect(estiloMes.fontSize).toBe('11px');
      expect(estiloMes.fontWeight).toBe('600');
      expect(estiloMes.textTransform).toBe('uppercase');
      expect(estiloMes.letterSpacing).toMatch(/0\.88px|0\.08em/);

      const estiloDia = window.getComputedStyle(dia);
      expect(estiloDia.fontSize).toBe('26px');
      expect(estiloDia.fontWeight).toBe('600');
      expect(estiloDia.lineHeight).toMatch(/26px|1/);

      const estiloLinha = window.getComputedStyle(linha);
      expect(estiloLinha.gap).toBe('16px');
      expect(estiloLinha.alignItems).toBe('center');

      const estiloInfo = window.getComputedStyle(info);
      expect(estiloInfo.gap).toBe('4px');

      expect(estiloPrincEscuro.fontSize).toBe('18px');
      expect(estiloPrincEscuro.fontWeight).toBe('600');
      expect(estiloPrincEscuro.fontFamily).toContain('Instrument Sans');

      expect(estiloSecEscuro.fontSize).toBe('13px');
    } finally {
      document.documentElement.removeAttribute('data-tema');
      probeMarca.remove();
      probeTexto.remove();
    }
  });

  it('24. geometria real em espaco estreito de 240px preserva bloco 64x64 sem encolhimento e quebra texto sem overflow', () => {
    const fixture = montarComponente();
    const comp = fixture.componentInstance;

    comp.selecionarLead(filaMock.itens[0]);
    fixture.detectChanges();

    const reqDet = httpMock.expectOne('/api/painel/leads/l1');
    reqDet.flush({
      ...detalheMockComConversa,
      encaminhamento: {
        id: 42,
        status: 'atribuido',
        corretor: { id: 'c-201', nome: 'Helena Maria da Silva Braga de Alcantara', iniciais: 'HB' },
        atribuidoEm: '2026-10-07T10:00:00Z',
      },
      agendamento: {
        dataHora: '2026-10-07T17:00:00Z',
        fim: '2026-10-07T18:00:00Z',
        status: 'confirmado',
      },
    });
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const secao = html.querySelector('.secao-agendamento') as HTMLElement;
    const bloco = secao.querySelector('.bloco-data-agendamento') as HTMLElement;
    const info = secao.querySelector('.info-agendamento') as HTMLElement;

    const container = document.createElement('div');
    container.style.width = '240px';
    container.style.boxSizing = 'border-box';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);

    const parenteOriginal = secao.parentElement;
    const proximoIrmao = secao.nextSibling;

    try {
      container.appendChild(secao);

      const rectBloco = bloco.getBoundingClientRect();
      expect(Math.round(rectBloco.width)).toBe(64);
      expect(Math.round(rectBloco.height)).toBe(64);

      expect(secao.scrollWidth).toBeLessThanOrEqual(secao.clientWidth + 1);
      expect(info.scrollWidth).toBeLessThanOrEqual(info.clientWidth + 1);
    } finally {
      if (parenteOriginal) {
        parenteOriginal.insertBefore(secao, proximoIrmao);
      }
      container.remove();
    }
  });
});
