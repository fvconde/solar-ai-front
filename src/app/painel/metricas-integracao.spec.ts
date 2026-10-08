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

  afterEach(() => {
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

    const html = fixture.nativeElement as HTMLElement;
    html.style.height = `${window.innerHeight}px`;
    const fila = html.querySelector<HTMLElement>('.corpo-painel')!;
    expect(html.querySelector('app-metricas-painel')).toBeNull();
    expect(html.querySelector('.metricas')).toBeNull();
    expect(html.querySelector('#painel-fila-leads')?.classList.contains('oculto')).toBeFalse();
    expect(html.querySelector('#painel-metricas')?.classList.contains('oculto')).toBeTrue();
    expect(fila.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(getComputedStyle(fila).display).not.toBe('none');

    fixture.componentInstance.selecionarMetricas();
    fixture.detectChanges();
    const [bloco] = await fixture.getDeferBlocks();
    await bloco.render(DeferBlockState.Complete);
    http.expectOne('/api/painel/metricas?dias=30').flush(metricasParaTeste());
    fixture.detectChanges();

    const painelMetricas = html.querySelector<HTMLElement>('#painel-metricas')!;
    expect(painelMetricas.classList.contains('oculto')).toBeFalse();
    expect(html.querySelector('#painel-fila-leads')?.classList.contains('oculto')).toBeTrue();

    const appMetricas = html.querySelector<HTMLElement>('app-metricas-painel')!;
    expect(appMetricas).not.toBeNull();
    const faixa = html.querySelector<HTMLElement>('.metricas')!;
    expect(faixa).not.toBeNull();
    expect(html.querySelector('.alternar')).toBeNull();
    expect(faixa.classList.contains('expandida')).toBeFalse();

    expect(getComputedStyle(appMetricas).maxHeight).toBe('none');
    expect(getComputedStyle(faixa).maxHeight).toBe('none');
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
