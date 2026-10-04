import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessaoStore } from '../sessao/sessao-store';
import { Painel } from './painel';
import { metricasParaTeste } from './metricas-painel.fixture';

describe('Layout real das métricas por viewport (S-22)', () => {
  let http: HttpTestingController;
  const quadros: HTMLIFrameElement[] = [];
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Painel],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.match('/api/conta');
    http.match('/api/painel/corretores/pendentes');
    http.verify();
    quadros.splice(0).forEach(q => q.remove());
    localStorage.removeItem('solar.metricas.teste-layout');
  });
  for (const perfil of ['supervisor', 'corretor'] as const) {
    for (const tema of ['claro', 'escuro'] as const) {
      for (const [largura, altura] of [[1440, 900], [861, 600], [390, 844], [390, 568]]) {
        it(`${perfil}, tema ${tema}, ${largura}×${altura}: expansão ocupa no máximo 40%, fila visível e extras rolam internamente`, async () => {
          TestBed.inject(SessaoStore).definir({
            usuario: { id: 'teste-layout', nome: 'Conta', email: 'conta@solar.com.br' },
            perfil, statusCorretor: 'aprovado', corretorId: perfil === 'corretor' ? 'c1' : null,
            vinculoAtivo: true, filtrosPermitidos: perfil === 'corretor' ? ['meus_leads'] : ['visao_geral'],
            filtroInicial: perfil === 'corretor' ? 'meus_leads' : 'visao_geral', pendentesAprovacao: 0,
          });
          const fixture = TestBed.createComponent(Painel);
          fixture.detectChanges();
          if (perfil === 'supervisor') {
            fixture.componentInstance.selecionarFiltro('visao_geral');
            fixture.detectChanges();
          }
          http.expectOne(r => r.url === '/api/painel/leads').flush({
            total: 1,
            itens: [{
              id: 'lead-layout', nomeExibicao: null, referencia: '123', pedidoResumo: 'Comprar · Moema',
              criadoEm: '2026-10-03T15:00:00Z', qualificacao: 50, leadStatus: 'encaminhado',
              encaminhamentoStatus: 'atribuido', corretor: { id: 'c1', nome: 'Corretor', iniciais: 'CO' },
            }],
          });
          const [bloco] = await fixture.getDeferBlocks();
          await bloco.render(DeferBlockState.Complete);
          const dados = metricasParaTeste();
          if (perfil === 'corretor') dados.equipe = null;
          http.expectOne('/api/painel/metricas?dias=30').flush(dados);
          fixture.detectChanges();
          fixture.nativeElement.querySelector('.alternar').click();
          fixture.detectChanges();
          const quadro = document.createElement('iframe');
          quadros.push(quadro);
          quadro.style.cssText = `width:${largura}px;height:${altura}px;border:0;position:fixed;left:0;top:0;`;
          document.body.appendChild(quadro);
          const doc = quadro.contentDocument!;
          const css = [...Array.from(document.styleSheets), ...document.adoptedStyleSheets]
            .map(folha => {
              try { return Array.from(folha.cssRules).map(regra => regra.cssText).join('\n'); }
              catch { return ''; }
            }).join('\n');
          doc.open();
          doc.write(`<!doctype html><html lang="pt-BR" data-tema="${tema}"><head><base href="${document.baseURI}"><style>${css}\nhtml,body{margin:0;height:100%;}body{display:flex;flex-direction:column;}</style></head><body>${fixture.nativeElement.outerHTML}</body></html>`);
          doc.close();
          await new Promise<void>(resolve => quadro.contentWindow!.requestAnimationFrame(() => resolve()));
          const win = quadro.contentWindow!;
          const faixa = doc.querySelector<HTMLElement>('.metricas')!;
          const fila = doc.querySelector<HTMLElement>('.corpo-painel')!;
          const miolo = doc.querySelector<HTMLElement>('.miolo')!;
          expect(win.innerWidth).toBe(largura);
          expect(win.innerHeight).toBe(altura);
          expect(faixa.getBoundingClientRect().height).toBeLessThanOrEqual(altura * .4 + 1);
          expect(faixa.getBoundingClientRect().height).toBeGreaterThan(100);
          expect(fila.getBoundingClientRect().height).toBeGreaterThan(0);
          expect(fila.getBoundingClientRect().top).toBeLessThan(altura);
          expect(win.getComputedStyle(miolo).overflowY).toBe('auto');
          if (largura <= 860) {
            expect(doc.querySelector('.alternar')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
            expect(win.getComputedStyle(doc.querySelector('.resumo-celular')!).display).toBe('grid');
            expect(miolo.scrollHeight).toBeGreaterThan(miolo.clientHeight);
          } else {
            const extras = doc.querySelector<HTMLElement>('.extras')!;
            expect(win.getComputedStyle(extras).overflowY).toBe('auto');
            expect(extras.scrollHeight).toBeGreaterThan(extras.clientHeight);
          }
          expect(win.getComputedStyle(doc.querySelector('.cartao')!).backgroundColor)
            .toBe(tema === 'claro' ? 'rgb(255, 255, 255)' : 'rgb(36, 35, 29)');
          expect(win.getComputedStyle(doc.querySelector('.numero')!).fontVariantNumeric).toBe('tabular-nums');
          expect(doc.querySelector('.equipe') === null).toBe(perfil === 'corretor');
        });
      }
    }
  }
});
