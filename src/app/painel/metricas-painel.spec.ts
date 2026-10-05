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
  const chave = 'solar.metricas.teste-metricas';

  beforeEach(async () => {
    localStorage.removeItem(chave);
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
    localStorage.removeItem(chave);
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
  function expandir() {
    (fixture.nativeElement.querySelector('.alternar') as HTMLButtonElement).click();
    fixture.detectChanges();
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
    expect(html.querySelector('.resumo-celular')?.textContent).toContain('com dados essenciais');
    expect(html.querySelector('.resumo-celular')?.textContent).toContain('conversas com horário confirmado');
    expect(html.querySelector('.resumo-celular .cartao:last-child strong')?.textContent).toBe('4');
    expect(html.querySelector('.mini-grafico-celular')).not.toBeNull();
    expect(fixture.componentInstance.criterio('iniciadas')).toContain('atualmente atribuídas a você');
  });
  it('expansão tem cinco extras completos, controle ARIA e persiste por usuário', () => {
    const html = montar();
    expect(html.querySelector<HTMLElement>('.extras')?.hidden).toBeTrue();
    expandir();
    expect(html.querySelector<HTMLElement>('.extras')?.hidden).toBeFalse();
    expect(html.querySelector('.alternar')?.getAttribute('aria-expanded')).toBe('true');
    expect(html.querySelector('.alternar')?.getAttribute('aria-controls')).toBe('extras-metricas');
    expect(html.querySelectorAll('.grade-extras .cartao').length).toBe(5);
    expect(localStorage.getItem(chave)).toBe('1');
    expect(html.querySelector('.extras')?.textContent).toContain('IMV-001');
    expect(html.querySelector('.extras')?.textContent).toContain('MOEMA');
    expect(html.querySelector('.extras')?.textContent).toContain('12 de 14 leads informaram região');
    expect(html.querySelector('.extras')?.textContent).toContain('9 leads em outras regiões');
    expect(html.querySelector('.extras time')?.getAttribute('datetime')).toBe('2026-10-04T18:00:00Z');
    expect(html.querySelector('.extras')?.textContent).toContain('Completam 1 mês sem contato');
    expect(html.querySelector('.extras')?.textContent).toContain('100%');
  });
  it('restaura a preferência do usuário', () => {
    localStorage.setItem(chave, '1');
    montar();
    expect(fixture.componentInstance.expandido()).toBeTrue();
  });
  it('vazio mostra zeros, travessão, barras de largura zero e listas vazias', () => {
    const html = montar(metricasParaTeste(true));
    expandir();
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
    expandir();
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
    expandir();
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
    expandir();
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
    expandir();
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
    expandir();
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
  it('faixa inteira fechada e expandida respeita 40% da viewport e tem uma única rolagem vertical', () => {
    const html = montar();
    const faixa = html.querySelector<HTMLElement>('.metricas')!;
    expect(faixa.getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight * .4 + 1);
    expandir();
    expect(faixa.getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight * .4 + 1);
    const miolo = html.querySelector<HTMLElement>('.miolo')!;
    expect(getComputedStyle(faixa).overflowY).toBe('auto');
    expect(faixa.scrollHeight).toBeGreaterThan(faixa.clientHeight);
    expect(faixa.getAttribute('tabindex')).toBe('0');
    expect(getComputedStyle(miolo).overflowY).toBe('visible');
    expect(getComputedStyle(html.querySelector('.extras')!).overflowY).toBe('visible');
    if (window.innerWidth <= 860) {
      expect(html.querySelector('.alternar')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(getComputedStyle(html.querySelector('.resumo-celular')!).display).toBe('grid');
    }
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
});
