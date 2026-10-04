import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessaoStore } from '../sessao/sessao-store';
import { Painel } from './painel';
import { metricasParaTeste } from './metricas-painel.fixture';

describe('Integração das métricas com as abas e fila (S-22)', () => {
  let http: HttpTestingController;
  let sessao: SessaoStore;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Painel], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    sessao = TestBed.inject(SessaoStore);
    sessao.definir({
      usuario: { id: 'teste-integracao', nome: 'Supervisor', email: 's@solar.com.br' },
      perfil: 'supervisor', statusCorretor: null, corretorId: null, vinculoAtivo: true,
      filtrosPermitidos: ['minha_fila', 'sem_corretor', 'visao_geral'], filtroInicial: 'visao_geral', pendentesAprovacao: 0,
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
  it('faixa fica entre abas e fila e a expansão mantém a fila visível', async () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    fixture.componentInstance.selecionarFiltro('visao_geral');
    fixture.detectChanges();
    http.expectOne(r => r.url === '/api/painel/leads').flush({ total: 0, itens: [] });
    const [bloco] = await fixture.getDeferBlocks();
    await bloco.render(DeferBlockState.Complete);
    http.expectOne('/api/painel/metricas?dias=30').flush(metricasParaTeste());
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    html.style.height = `${window.innerHeight}px`;
    const faixa = html.querySelector<HTMLElement>('app-metricas-painel')!;
    const fila = html.querySelector<HTMLElement>('.corpo-painel')!;
    expect(html.querySelector('.abas-supervisor')!.compareDocumentPosition(faixa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(faixa.compareDocumentPosition(fila) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    html.querySelector<HTMLButtonElement>('.alternar')!.click();
    fixture.detectChanges();
    expect(faixa.getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight * .4 + 1);
    expect(fila.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(getComputedStyle(fila).display).not.toBe('none');
  });
  it('falha e retry de métricas preservam a fila sem repetir sua consulta', async () => {
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    fixture.componentInstance.selecionarFiltro('visao_geral');
    fixture.detectChanges();
    http.expectOne(r => r.url === '/api/painel/leads').flush({ total: 7, itens: [] });
    const [bloco] = await fixture.getDeferBlocks();
    await bloco.render(DeferBlockState.Complete);
    http.expectOne('/api/painel/metricas?dias=30').flush({}, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(fixture.componentInstance.totalLeads()).toBe(7);
    fixture.nativeElement.querySelector('.tentar').click();
    fixture.detectChanges();
    http.expectNone(r => r.url === '/api/painel/leads');
    http.expectOne('/api/painel/metricas?dias=30').flush(metricasParaTeste());
    fixture.detectChanges();
    expect(fixture.componentInstance.totalLeads()).toBe(7);
    fixture.componentInstance.selecionarNovosCorretores();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-metricas-painel')).toBeNull();
  });
});
