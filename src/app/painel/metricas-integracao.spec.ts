import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SessaoStore } from '../sessao/sessao-store';
import { Painel } from './painel';
import { metricasParaTeste } from './metricas-painel.fixture';

describe('Integração das métricas com as abas e fila (S-22/S-48)', () => {
  let http: HttpTestingController;
  let sessao: SessaoStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Painel],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    sessao = TestBed.inject(SessaoStore);
    sessao.definir({
      usuario: { id: 'teste-integracao', nome: 'Supervisor', email: 's@solar.com.br' },
      perfil: 'supervisor',
      statusCorretor: null,
      corretorId: null,
      vinculoAtivo: true,
      filtrosPermitidos: ['minha_fila', 'sem_corretor', 'visao_geral'],
      filtroInicial: 'visao_geral',
      pendentesAprovacao: 0,
    });
  });

  const hostsFixados: HTMLElement[] = [];

  afterEach(() => {
    hostsFixados.splice(0).forEach(h => h.remove());
    http.match('/api/conta');
    http.match('/api/painel/corretores/pendentes');
    http.verify();
    localStorage.removeItem('solar.metricas.teste-integracao');
  });

  it('Novos corretores não monta a faixa nem consulta métricas', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    expect(fixture.componentInstance.novosCorretoresAtivo()).toBeTrue();
    expect(fixture.nativeElement.querySelector('app-metricas-painel')).toBeNull();
    http.expectNone(r => r.url === '/api/painel/metricas');
  });

  it('ordena as abas do supervisor e mantém escolha inicial e navegação por teclado', () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    const abas = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(abas.map(aba => aba.textContent!.trim())).toEqual([
      'Visão geral', 'Minha fila', 'Sem corretor elegível', 'Métricas', 'Novos corretores',
    ]);
    expect(fixture.componentInstance.filtroAtivo()).toBe('visao_geral');
    expect(fixture.componentInstance.novosCorretoresAtivo()).toBeTrue();
    expect(abas[4].getAttribute('tabindex')).toBe('0');
    for (const [origem, tecla, destino] of [
      [4, 'Home', 0], [0, 'ArrowRight', 1], [1, 'ArrowRight', 2],
      [2, 'ArrowRight', 3], [3, 'ArrowRight', 4], [4, 'ArrowRight', 0],
      [0, 'ArrowLeft', 4], [4, 'ArrowLeft', 3], [3, 'ArrowLeft', 2],
      [0, 'End', 4],
    ] as const) {
      const evento = new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true });
      abas[origem].dispatchEvent(evento);
      expect(evento.defaultPrevented).toBeTrue();
      expect(document.activeElement).toBe(abas[destino]);
    }
    expect(fixture.componentInstance.novosCorretoresAtivo()).toBeTrue();
    http.expectNone(r => r.url === '/api/painel/leads');
  });

  it('a nova ordem mantém somente filtros permitidos e Novos corretores por último', () => {
    sessao.definir({
      usuario: { id: 'teste-integracao', nome: 'Supervisor', email: 's@solar.com.br' },
      perfil: 'supervisor',
      statusCorretor: null,
      corretorId: null,
      vinculoAtivo: true,
      filtrosPermitidos: ['sem_corretor', 'minha_fila'],
      filtroInicial: 'sem_corretor',
      pendentesAprovacao: 0,
    });
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    const abas = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(abas.map(aba => aba.id)).toEqual(['aba-minha_fila', 'aba-sem_corretor', 'aba-metricas', 'aba-novos-corretores']);
    expect(fixture.componentInstance.filtroAtivo()).toBe('sem_corretor');
    expect(fixture.componentInstance.novosCorretoresAtivo()).toBeTrue();
    http.expectNone(r => r.url === '/api/painel/leads');

    sessao.definir({
      usuario: { id: 'teste-corretor', nome: 'Corretor', email: 'c@solar.com.br' },
      perfil: 'corretor',
      statusCorretor: 'aprovado',
      corretorId: 'c1',
      vinculoAtivo: true,
      filtrosPermitidos: ['meus_leads'],
      filtroInicial: 'meus_leads',
      pendentesAprovacao: 0,
    });
    const fCorretor = TestBed.createComponent(Painel);
    fCorretor.detectChanges();
    http.expectOne(r => r.url === '/api/painel/leads').flush({ total: 0, itens: [] });
    fCorretor.detectChanges();
    const abasCorretor = Array.from(fCorretor.nativeElement.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(abasCorretor.map(aba => aba.id)).toEqual(['aba-meus-leads', 'aba-metricas']);
    expect(fCorretor.nativeElement.querySelector('#aba-novos-corretores')).toBeNull();

    sessao.definir({
      usuario: { id: 'teste-analise', nome: 'Em Análise', email: 'a@solar.com.br' },
      perfil: 'corretor',
      statusCorretor: 'em_analise',
      corretorId: 'c2',
      vinculoAtivo: false,
      filtrosPermitidos: [],
      filtroInicial: 'meus_leads',
      pendentesAprovacao: 0,
    });
    const fAnalise = TestBed.createComponent(Painel);
    fAnalise.detectChanges();
    expect(fAnalise.nativeElement.querySelectorAll('[role="tab"]').length).toBe(0);
    expect(fAnalise.nativeElement.querySelector('app-metricas-painel')).toBeNull();
  });

  it('Visão geral não renderiza métricas com fila em altura total e Métricas não tem alternar nem 40vh', async () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    fixture.componentInstance.selecionarFiltro('visao_geral');
    fixture.detectChanges();
    http.expectOne(r => r.url === '/api/painel/leads').flush({
      total: 1,
      itens: [{
        id: 'l-pos',
        nomeExibicao: 'Lead Teste',
        referencia: '99',
        pedidoResumo: 'Comprar',
        criadoEm: '2026-10-01T00:00:00Z',
        qualificacao: 80,
        leadStatus: 'novo',
        encaminhamentoStatus: null,
        corretor: null,
      }],
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:800px;display:flex;flex-direction:column;';
    document.body.appendChild(host);
    hostsFixados.push(host);

    const shell = host.querySelector<HTMLElement>('.painel-shell')!;
    const nav = host.querySelector<HTMLElement>('.abas-supervisor')!;
    const painelFila = host.querySelector<HTMLElement>('#painel-fila-leads')!;
    const corpo = host.querySelector<HTMLElement>('.corpo-painel')!;
    const colunaFila = host.querySelector<HTMLElement>('.coluna-fila')!;
    const listaLeads = host.querySelector<HTMLElement>('.lista-leads')!;
    const colunaDetalhe = host.querySelector<HTMLElement>('.coluna-detalhe')!;

    expect(host.querySelector('app-metricas-painel')).toBeNull();
    expect(host.querySelector('.metricas')).toBeNull();
    expect(painelFila.classList.contains('oculto')).toBeFalse();
    expect(host.querySelector('#painel-metricas')?.classList.contains('oculto')).toBeTrue();

    const shellRect = shell.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const painelFilaRect = painelFila.getBoundingClientRect();
    const corpoRect = corpo.getBoundingClientRect();
    const navMargemInferior = parseFloat(getComputedStyle(nav).marginBottom);
    const areaDisponivelFila = shellRect.bottom - (navRect.bottom + navMargemInferior);

    expect(Math.abs(painelFilaRect.bottom - shellRect.bottom)).toBeLessThanOrEqual(2);
    expect(Math.abs(corpoRect.bottom - shellRect.bottom)).toBeLessThanOrEqual(2);
    expect(Math.abs(corpoRect.height - areaDisponivelFila)).toBeLessThanOrEqual(2);

    expect(colunaFila).not.toBeNull();
    expect(colunaDetalhe).not.toBeNull();
    expect(listaLeads).not.toBeNull();
    expect(getComputedStyle(listaLeads).display).not.toBe('none');
    if (window.innerWidth > 860) {
      expect(getComputedStyle(colunaDetalhe).display).not.toBe('none');
      expect(Math.abs(colunaFila.getBoundingClientRect().height - corpoRect.height)).toBeLessThanOrEqual(2);
      expect(Math.abs(colunaDetalhe.getBoundingClientRect().height - corpoRect.height)).toBeLessThanOrEqual(2);
    } else {
      expect(getComputedStyle(colunaDetalhe).display).toBe('none');
    }

    fixture.componentInstance.selecionarMetricas();
    fixture.detectChanges();
    const [bloco] = await fixture.getDeferBlocks();
    await bloco.render(DeferBlockState.Complete);
    http.expectOne('/api/painel/metricas?dias=30').flush(metricasParaTeste());
    fixture.detectChanges();

    const painelMetricas = host.querySelector<HTMLElement>('#painel-metricas')!;
    expect(painelMetricas.classList.contains('oculto')).toBeFalse();
    expect(painelFila.classList.contains('oculto')).toBeTrue();

    const appMetricas = host.querySelector<HTMLElement>('app-metricas-painel')!;
    expect(appMetricas).not.toBeNull();
    const faixa = host.querySelector<HTMLElement>('.metricas')!;
    expect(faixa).not.toBeNull();
    expect(host.querySelector('.alternar')).toBeNull();
    expect(faixa.classList.contains('expandida')).toBeFalse();

    const painelMetricasRect = painelMetricas.getBoundingClientRect();
    const appMetricasRect = appMetricas.getBoundingClientRect();
    const faixaRect = faixa.getBoundingClientRect();
    const areaDisponivelMetricas = shellRect.bottom - (navRect.bottom + navMargemInferior);

    expect(Math.abs(painelMetricasRect.bottom - shellRect.bottom)).toBeLessThanOrEqual(2);
    expect(Math.abs(painelMetricasRect.height - areaDisponivelMetricas)).toBeLessThanOrEqual(2);
    expect(Math.abs(appMetricasRect.height - painelMetricasRect.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(faixaRect.height - painelMetricasRect.height)).toBeLessThanOrEqual(2);

    expect(faixaRect.height).toBeGreaterThan(800 * 0.4);
    expect(getComputedStyle(faixa).height).not.toContain('40vh');
    expect(getComputedStyle(faixa).height).not.toContain('40dvh');
    expect(getComputedStyle(faixa).maxHeight).toBe('none');
    expect(getComputedStyle(appMetricas).maxHeight).toBe('none');
  });

  it('falha e retry de métricas preservam a fila sem repetir sua consulta', async () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    fixture.componentInstance.selecionarFiltro('visao_geral');
    fixture.detectChanges();
    http.expectOne(r => r.url === '/api/painel/leads').flush({ total: 7, itens: [] });
    fixture.detectChanges();
    expect(fixture.componentInstance.totalLeads()).toBe(7);

    fixture.componentInstance.selecionarMetricas();
    fixture.detectChanges();
    const [bloco] = await fixture.getDeferBlocks();
    await bloco.render(DeferBlockState.Complete);
    http.expectOne('/api/painel/metricas?dias=30').flush({}, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(fixture.componentInstance.totalLeads()).toBe(7);
    expect(fixture.nativeElement.querySelector('.estado[role="alert"]')).not.toBeNull();

    fixture.nativeElement.querySelector('.tentar').click();
    fixture.detectChanges();
    http.expectNone(r => r.url === '/api/painel/leads');
    http.expectOne('/api/painel/metricas?dias=30').flush(metricasParaTeste());
    fixture.detectChanges();
    expect(fixture.componentInstance.totalLeads()).toBe(7);

    fixture.componentInstance.selecionarNovosCorretores();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-metricas-painel')).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/painel'], { queryParams: { filtro: null } });
  });
});
