import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { SessaoStore } from '../sessao/sessao-store';
import { MetricasPainel } from './metricas-painel';
import { metricasParaTeste } from './metricas-painel.fixture';

describe('Faixa de métricas (S-22)', () => {
  let http: HttpTestingController;
  let sessao: SessaoStore;
  let fixture: ComponentFixture<MetricasPainel>;

  beforeEach(async () => {
    localStorage.removeItem('solar.metricas.teste-metricas');
    await TestBed.configureTestingModule({
      imports: [MetricasPainel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    sessao = TestBed.inject(SessaoStore);
    definirPerfil('supervisor');
  });
  afterEach(() => {
    fixture?.destroy();
    http.verify();
    localStorage.removeItem('solar.metricas.teste-metricas');
  });

  function definirPerfil(perfil: 'supervisor' | 'corretor') {
    sessao.definir({
      usuario: { id: 'teste-metricas', nome: 'Supervisor', email: 'teste@solar.com.br' },
      perfil, statusCorretor: 'aprovado', corretorId: perfil === 'corretor' ? 'c1' : null,
      vinculoAtivo: true, filtrosPermitidos: perfil === 'corretor' ? ['meus_leads'] : ['visao_geral'],
      filtroInicial: perfil === 'corretor' ? 'meus_leads' : 'visao_geral', pendentesAprovacao: 1,
    });
  }
  function iniciar() {
    fixture = TestBed.createComponent(MetricasPainel);
    fixture.detectChanges();
    return http.expectOne('/api/painel/metricas?dias=30');
  }
  function montar(dados = metricasParaTeste()) {
    iniciar().flush(dados);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('tem loading próprio, números com espaço reservado e aria-busy', () => {
    const req = iniciar();
    expect(fixture.nativeElement.querySelector('[role=status]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.esqueleto').getBoundingClientRect().height).toBe(24);
    expect(fixture.nativeElement.querySelector('section').getAttribute('aria-busy')).toBe('true');
    req.flush(metricasParaTeste());
  });
  it('exibe erro e tentar novamente faz só a requisição de métricas', () => {
    iniciar().flush({}, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar as métricas.');
    fixture.nativeElement.querySelector('.tentar').click();
    fixture.detectChanges();
    http.expectOne('/api/painel/metricas?dias=30').flush(metricasParaTeste());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-metrica=confirmadas]').textContent).toBe('4');
  });
  it('supervisor vê cards, equipe atual, aguardando e aprovação sem expor nomes visíveis', () => {
    const html = montar();
    expect(html.querySelector('.card-grafico .valor-topo')?.textContent).toBe('14');
    expect(html.querySelector('[data-metrica=confirmadas]')?.textContent).toBe('4');
    expect(html.querySelector('.equipe')?.textContent).toContain('5 conversas com corretor hoje');
    expect(html.querySelector('.aguardando')?.textContent).toContain('2 conversas aguardam');
    expect(html.querySelector('.pendentes')?.textContent).toContain('1 corretor aguarda aprovação');
    expect(html.textContent).not.toContain('Helena Nome Somente Acessível');
    expect(html.querySelector('.carga li')?.getAttribute('aria-label')).toContain('Helena Nome Somente Acessível');
    expect(html.querySelector('.carga li')?.textContent).toContain('HN');
  });
  it('corretor vê o próprio recorte e três números adaptados, sem equipe', () => {
    definirPerfil('corretor');
    const dados = metricasParaTeste();
    dados.equipe = null;
    dados.avanco = [
      { etapa: 'atribuidas', conversas: 14 },
      { etapa: 'horario', conversas: 4 },
    ];
    dados.dadosEssenciaisPreenchidos = 8;
    const html = montar(dados);
    expect(html.textContent).toContain('Conversas atribuídas a você');
    expect(html.querySelector('[data-metrica=essenciais]')?.textContent).toBe('57%');
    expect(html.querySelector('[data-metrica=confirmadas]')?.textContent).toBe('4');
    expect(html.querySelector('.principais')).not.toBeNull();
    expect(html.querySelector('.mini-grafico-celular')).toBeNull();
    expect(html.querySelector('.resumo-celular')).toBeNull();
    expect(fixture.componentInstance.criterio('iniciadas')).toContain('atualmente atribuídas a você');
  });
  it('apresenta sete extras completos permanentemente, sem alternar ou persistência', () => {
    const html = montar();
    expect(html.querySelector('.alternar')).toBeNull();
    expect(html.querySelector<HTMLElement>('.extras')?.hidden).toBeFalsy();
    expect(html.querySelectorAll('.grade-extras .cartao').length).toBe(7);
    expect(localStorage.getItem('solar.metricas.teste-metricas')).toBeNull();
    expect(html.querySelector('.extras')?.textContent).toContain('Tempo mediano até o primeiro encaminhamento');
    expect(html.querySelector('.extras')?.textContent).toContain('Follow-up automático');
    expect(html.querySelector('.extras')?.textContent).toContain('11 min');
    expect(html.querySelector('.extras')?.textContent).toContain('50%');
    expect(html.querySelector('.extras')?.textContent).toContain('IMV-001');
    expect(html.querySelector('.extras')?.textContent).toContain('MOEMA');
    expect(html.querySelector('.extras')?.textContent).toContain('12 de 14 leads informaram região');
    expect(html.querySelector('.extras')?.textContent).toContain('9 leads em outras regiões');
    expect(html.querySelector('.extras time')?.getAttribute('datetime')).toBe('2026-10-04T18:00:00Z');
    expect(html.querySelector('.extras')?.textContent).toContain('Completam 1 mês sem contato');
    expect(html.querySelector('.extras')?.textContent).toContain('100%');
  });
  it('ignora preferência legada de expansão e mantém extras visíveis sem gravar localStorage', () => {
    const chaveLegada = 'solar.metricas.teste-metricas';
    localStorage.setItem(chaveLegada, '0');
    const html = montar();
    expect(html.querySelector<HTMLElement>('.extras')?.hidden).toBeFalsy();
    expect(localStorage.getItem(chaveLegada)).toBe('0');
  });
  it('vazio mostra zeros, travessão, barras de largura zero e listas vazias', () => {
    const html = montar(metricasParaTeste(true));
    expect(html.textContent).toContain('Ainda não há conversas.');
    expect(html.textContent).toContain('Nenhuma sugestão de imóvel ainda.');
    expect(html.textContent).toContain('Nenhum horário marcado.');
    expect(html.textContent).toContain('Sem prazos de retenção correndo.');
    expect(html.textContent).toContain('—');
    expect(html.innerHTML).not.toContain('NaN');
    expect(html.innerHTML).not.toContain('Infinity');
    expect(html.querySelectorAll('.ranking li').length).toBe(0);
    expect(html.querySelector<HTMLElement>('.consentimento > span')?.style.width).toBe('0%');
    expect(html.querySelector<HTMLElement>('.barra-intencao > span')?.style.width).toBe('0%');
    expect(html.querySelector<HTMLElement>('.donut')?.style.background).toBe('var(--inativo-borda)');
  });
  it('percentuais de score excluem sem avaliação e possuem faixas explícitas', () => {
    const html = montar();
    const score = html.querySelector('.score')!;
    expect(score.textContent).toContain('12');
    expect(score.textContent).toContain('Frio · 0–39');
    expect(score.textContent).toContain('Morno · 40–69');
    expect(score.textContent).toContain('Quente · 70–100');
    expect(score.textContent).toContain('33%');
    expect(score.textContent).toContain('42%');
    expect(score.textContent).toContain('25%');
  });
  it('tooltips acessíveis abrem por foco na camada superior e fecham com Escape', () => {
    const html = montar();
    const botao = html.querySelector<HTMLButtonElement>('app-criterio-metrica button')!;
    botao.focus();
    fixture.detectChanges();
    const id = botao.getAttribute('aria-describedby')!;
    const dica = document.getElementById(id)!;
    expect(botao.getAttribute('aria-label')).toBe('Como é calculado: Avanço das conversas no chat');
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(dica.matches(':popover-open')).toBeTrue();
    expect(dica.getAttribute('role')).toBe('tooltip');
    expect(dica.textContent).toContain('Histórico sem mudança');
    expect(dica.getBoundingClientRect().left).toBeGreaterThanOrEqual(12);
    document.dispatchEvent(new Event('scroll'));
    expect(dica.matches(':popover-open')).toBeTrue();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(dica.matches(':popover-open')).toBeFalse();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(botao);
  });
  it('tooltip abre com clique e fecha ao perder foco', () => {
    const html = montar();
    const botao = html.querySelector<HTMLButtonElement>('app-criterio-metrica button')!;
    botao.click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    botao.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
  });
  it('focar segundo critério fecha o primeiro garantindo apenas uma caixa aberta', () => {
    const html = montar();
    const botoes = html.querySelectorAll<HTMLButtonElement>('app-criterio-metrica button');
    expect(botoes.length).toBeGreaterThan(1);
    const primeiro = botoes[0];
    const segundo = botoes[1];

    primeiro.focus();
    fixture.detectChanges();
    const id1 = primeiro.getAttribute('aria-describedby')!;
    const dica1 = document.getElementById(id1)!;
    expect(primeiro.getAttribute('aria-expanded')).toBe('true');
    expect(dica1.matches(':popover-open')).toBeTrue();

    segundo.focus();
    fixture.detectChanges();
    const id2 = segundo.getAttribute('aria-describedby')!;
    const dica2 = document.getElementById(id2)!;
    expect(primeiro.getAttribute('aria-expanded')).toBe('false');
    expect(dica1.matches(':popover-open')).toBeFalse();
    expect(segundo.getAttribute('aria-expanded')).toBe('true');
    expect(dica2.matches(':popover-open')).toBeTrue();
  });
  it('tooltip admite hover do conteúdo e não fecha ao sair com o botão ainda focado', fakeAsync(() => {
    const html = montar();
    const botao = html.querySelector<HTMLButtonElement>('app-criterio-metrica button')!;
    botao.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    const dica = document.getElementById(botao.getAttribute('aria-describedby')!)!;
    botao.dispatchEvent(new MouseEvent('mouseleave'));
    dica.dispatchEvent(new MouseEvent('mouseenter'));
    tick(151);
    expect(dica.matches(':popover-open')).toBeTrue();
    dica.dispatchEvent(new MouseEvent('mouseleave'));
    tick(151);
    expect(dica.matches(':popover-open')).toBeFalse();
    botao.focus();
    botao.dispatchEvent(new MouseEvent('mouseleave'));
    tick(151);
    expect(dica.matches(':popover-open')).toBeTrue();
    botao.blur();
    fixture.detectChanges();
    expect(dica.matches(':popover-open')).toBeFalse();
  }));
  it('critérios explicam janela dos confirmados, reservas e métricas fora da janela', () => {
    montar();
    const comp = fixture.componentInstance;
    expect(comp.criterio('confirmadas')).toContain('iniciadas nos últimos 30 dias');
    expect(comp.criterio('confirmadas')).toContain('incluindo os limites');
    expect(comp.criterio('intencao')).toContain('independentemente dos últimos 30 dias');
    expect(comp.criterio('score')).toContain('sem janela de dias');
    expect(comp.criterio('regioes')).toContain('sem janela de dias');
    expect(comp.criterio('equipe')).toContain('perfil corretor, corretor ativo e status em análise');
    expect(comp.criterio('horarios')).toContain('além dos próximos 7 dias');
  });
  it('retenção usa configuração e fallback fiel, sem hardcode de 12 meses', () => {
    montar();
    const criterio = fixture.componentInstance.criterio('privacidade');
    expect(criterio).toContain('Retenção configurada: 1 mês');
    expect(criterio).toContain('última mensagem do lead em todas as suas conversas');
    expect(criterio).toContain('menor data entre a primeira conversa e a criação do lead');
    expect(criterio).toContain('sem conversa, a criação do lead');
    expect(criterio).toContain('mensagens automáticas não renovam');
    expect(criterio).not.toContain('12 meses');
  });
  it('seção de métricas preenche a altura e tem uma única rolagem vertical', () => {
    const html = montar();
    const faixa = html.querySelector<HTMLElement>('.metricas')!;
    const miolo = html.querySelector<HTMLElement>('.miolo')!;
    expect(faixa.classList.contains('expandida')).toBeFalse();
    expect(html.querySelector('.alternar')).toBeNull();
    expect(getComputedStyle(faixa).overflowY).toBe('auto');
    expect(faixa.getAttribute('tabindex')).toBe('0');
    expect(getComputedStyle(miolo).overflowY).toBe('visible');
    expect(getComputedStyle(html.querySelector('.extras')!).overflowY).toBe('visible');
  });
  it('aprovação é acionável sem depender da expansão', () => {
    montar();
    const acao = spyOn(fixture.componentInstance.abrirPendentes, 'emit');
    fixture.nativeElement.querySelector('.pendentes').click();
    expect(acao).toHaveBeenCalledTimes(1);
  });
  it('integra gráfico de avanço e dados essenciais', () => {
    const html = montar();
    expect(html.textContent).toContain('Avanço das conversas no chat');
    expect(html.textContent).toContain('Dados essenciais preenchidos');
  });
  it('exibe aviso histórico quando inicio é anterior a historicoDesde e omite no limite', () => {
    const dados = metricasParaTeste();
    dados.periodo.inicio = '2026-07-01T00:00:00Z';
    dados.periodo.historicoDesde = '2026-08-01T00:00:00Z';
    const html1 = montar(dados);
    expect(fixture.componentInstance.historicoParcial()).toBeTrue();
    expect(html1.querySelector('.aviso-parcial')?.textContent).toContain('Histórico de avanço disponível desde 01/08');

    fixture.destroy();
    const dadosLimite = metricasParaTeste();
    dadosLimite.periodo.inicio = '2026-08-01T00:00:00Z';
    dadosLimite.periodo.historicoDesde = '2026-08-01T00:00:00Z';
    const html2 = montar(dadosLimite);
    expect(fixture.componentInstance.historicoParcial()).toBeFalse();
    expect(html2.querySelector('.aviso-parcial')).toBeNull();
  });
  it('base histórica menor que conversasIniciadas e leads governa os percentuais, cards e resumo', () => {
    const dados = metricasParaTeste();
    dados.conversasIniciadas = 20;
    dados.extras.privacidade.leads = 30;
    dados.avanco = [
      { etapa: 'iniciadas', conversas: 10 },
      { etapa: 'intencao', conversas: 9 },
      { etapa: 'essenciais', conversas: 6 },
      { etapa: 'encaminhamento', conversas: 5 },
      { etapa: 'corretor', conversas: 4 },
      { etapa: 'horario', conversas: 3 },
    ];
    dados.dadosEssenciaisPreenchidos = 6;
    dados.horariosConfirmados = 3;
    const html = montar(dados);
    expect(fixture.componentInstance.baseAvanco()).toBe(10);
    expect(html.querySelector('[data-metrica=essenciais]')?.textContent).toBe('60%');
    expect(html.querySelector('[data-metrica=confirmadas]')?.textContent).toBe('3');
    expect(html.textContent).toContain('6 de 10 conversas');
    expect(html.textContent).toContain('3 de 10 conversas iniciadas no período');
    expect(html.querySelector('.resumo-celular')).toBeNull();
  });
  it('horários coincide com a última barra e essenciais possui contador próprio para corretor', () => {
    definirPerfil('corretor');
    const dados = metricasParaTeste();
    dados.equipe = null;
    dados.avanco = [
      { etapa: 'atribuidas', conversas: 10 },
      { etapa: 'horario', conversas: 3 },
    ];
    dados.dadosEssenciaisPreenchidos = 5;
    dados.horariosConfirmados = 3;
    const html = montar(dados);
    expect(fixture.componentInstance.ultimaBarra()).toBe(3);
    expect(dados.horariosConfirmados).toBe(fixture.componentInstance.ultimaBarra());
    expect(html.querySelector('[data-metrica=essenciais]')?.textContent).toBe('50%');
    expect(html.querySelector('[data-metrica=confirmadas]')?.textContent).toBe('3');
    expect(html.querySelectorAll('.item-barra').length).toBe(2);
  });
  it('gráfico zero com leads antigos mantém intenção, score, atribuição e privacidade', () => {
    const dados = metricasParaTeste();
    dados.conversasIniciadas = 0;
    dados.dadosEssenciaisPreenchidos = 0;
    dados.horariosConfirmados = 0;
    dados.avanco = [
      { etapa: 'iniciadas', conversas: 0 },
      { etapa: 'intencao', conversas: 0 },
      { etapa: 'essenciais', conversas: 0 },
      { etapa: 'encaminhamento', conversas: 0 },
      { etapa: 'corretor', conversas: 0 },
      { etapa: 'horario', conversas: 0 },
    ];
    dados.extras.privacidade.leads = 10;
    const html = montar(dados);
    expect(fixture.componentInstance.baseAvanco()).toBe(0);
    expect(fixture.componentInstance.vazio()).toBeFalse();
    expect(html.textContent).not.toContain('Ainda não há conversas. Os números aparecem');
    expect(html.textContent).toContain('Ainda não há conversas no período. As barras aparecem quando alguém escrever para a Lia.');
    expect(html.querySelector('.barra-intencao')).not.toBeNull();
    expect(html.querySelector('.equipe')).not.toBeNull();
    expect(html.querySelector('.score')).not.toBeNull();
    expect(html.textContent).toContain('Privacidade');
  });
  it('tempo trata nulo, mediana par, série com lacunas sem ligar pontos e série vazia', () => {
    const dados = metricasParaTeste();
    dados.extras.tempoMedianoMin = null;
    dados.extras.tempoMedianoDiario = [];
    const html = montar(dados);
    expect(html.textContent).toContain('A linha aparece com o primeiro encaminhamento.');
    expect(fixture.componentInstance.sparklineTempo().segmentos.length).toBe(0);
    expect(fixture.componentInstance.sparklineTempo().ultimo).toBeNull();

    fixture.destroy();
    const dadosLacuna = metricasParaTeste();
    dadosLacuna.extras.tempoMedianoMin = 14;
    dadosLacuna.extras.tempoMedianoDiario = [18, null, 14, null, 12, null, 10];
    montar(dadosLacuna);
    const spark = fixture.componentInstance.sparklineTempo();
    expect(spark.segmentos.length).toBe(0);
    expect(spark.isolados.length).toBe(4);
    expect(spark.ultimo).toEqual({ x: 120, y: 30 });
  });
  it('follow-up calcula proporção sobre janelas encerradas e trata janelas recentes e configuração', () => {
    const dados = metricasParaTeste();
    dados.extras.followUp = {
      janelaDias: 7,
      comFollowUp: 5,
      janelaEncerrada: 4,
      responderam: 2,
      emObservacao: 1,
    };
    const html = montar(dados);
    expect(html.textContent).toContain('Responderam em até 7 dias.');
    expect(html.textContent).toContain('2 de 4 · 50%');
    expect(html.textContent).toContain('1 follow-up em observação');

    fixture.destroy();
    const dadosRecentes = metricasParaTeste();
    dadosRecentes.extras.followUp = {
      janelaDias: 3,
      comFollowUp: 3,
      janelaEncerrada: 0,
      responderam: 0,
      emObservacao: 3,
    };
    const htmlRecentes = montar(dadosRecentes);
    expect(htmlRecentes.textContent).toContain('Responderam em até 3 dias.');
    expect(htmlRecentes.textContent).toContain('0 de 0 · —');
    expect(htmlRecentes.textContent).not.toContain('NaN');
    expect(htmlRecentes.textContent).toContain('3 follow-ups em observação');
    expect(fixture.componentInstance.criterio('followUp')).toContain('janela de 3 dias');
  });
  it('gerencia foco, tecla Escape no detalhe do gráfico e isolamento de alvos no mobile', () => {
    const html = montar();
    const botaoBarra = html.querySelector<HTMLButtonElement>('.item-barra button')!;
    botaoBarra.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(botaoBarra.getAttribute('aria-describedby')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(botaoBarra.getAttribute('aria-describedby')).toBeNull();

    expect(html.querySelector('.mini-grafico-celular')).toBeNull();
    expect(html.querySelectorAll('.item-barra button').length).toBe(6);
  });
});
