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
        it(`${perfil}, tema ${tema}, ${largura}×${altura}: rolagem única até Privacidade, faixa até 40% e fila visível`, async () => {
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
          if (perfil === 'corretor') {
            dados.equipe = null;
            dados.avanco = [
              { etapa: 'atribuidas', conversas: 14 },
              { etapa: 'horario', conversas: 4 },
            ];
            dados.dadosEssenciaisPreenchidos = 8;
          }
          http.expectOne('/api/painel/metricas?dias=30').flush(dados);
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
          const verificarAlternar = (expandido: boolean) => {
            const faixa = doc.querySelector<HTMLElement>('.metricas')!;
            const botao = doc.querySelector<HTMLButtonElement>('.alternar')!;
            const seta = botao.querySelector<SVGSVGElement>('svg')!;
            const rotulo = botao.querySelector<HTMLElement>(largura <= 860 ? '.rotulo-celular' : '.rotulo-desktop')!;
            const centro = (elemento: Element) => {
              const caixa = elemento.getBoundingClientRect();
              return caixa.top + caixa.height / 2;
            };
            expect(botao.getAttribute('aria-expanded')).toBe(String(expandido));
            expect(seta.getAttribute('aria-hidden')).toBe('true');
            expect(seta.getAttribute('focusable')).toBe('false');
            expect(seta.classList.contains('recolher')).toBe(expandido);
            expect(Math.abs(centro(seta) - centro(rotulo))).toBeLessThanOrEqual(.5);
            expect(win.getComputedStyle(botao).marginBottom).toBe('8px');
            expect(win.getComputedStyle(botao).position).toBe('static');
            botao.focus();
            expect(doc.activeElement).toBe(botao);
            if (largura <= 860) {
              expect(botao.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
              const borda = parseFloat(win.getComputedStyle(faixa).borderTopWidth);
              const fimBotao = botao.getBoundingClientRect().bottom - faixa.getBoundingClientRect().top - borda + faixa.scrollTop;
              const espacoInferior = faixa.scrollHeight - fimBotao;
              expect(espacoInferior).toBeGreaterThanOrEqual(8 + parseFloat(win.getComputedStyle(faixa).paddingBottom) - 1);
            } else {
              const miolo = doc.querySelector<HTMLElement>('.miolo')!;
              expect(miolo.getBoundingClientRect().top - botao.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(20 - 1);
            }
            expect(faixa.getBoundingClientRect().height).toBeLessThanOrEqual(altura * .4 + 1);
            const fila = doc.querySelector<HTMLElement>('.corpo-painel')!;
            expect(fila.getBoundingClientRect().height).toBeGreaterThan(0);
            expect(fila.getBoundingClientRect().top).toBeLessThan(altura);
          };
          verificarAlternar(false);
          if (largura <= 860) {
            const mini = doc.querySelector<HTMLElement>('.mini-grafico-celular')!;
            expect(win.getComputedStyle(mini).display).not.toBe('none');
            const botoesCompactos = Array.from(doc.querySelectorAll<HTMLElement>('.compacto-botao'));
            expect(botoesCompactos.length).toBe(perfil === 'supervisor' ? 6 : 2);
            for (const b of botoesCompactos) {
              expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
            }
            expect(win.getComputedStyle(doc.querySelector('.principais')!).display).toBe('none');
          }
          fixture.nativeElement.querySelector('.alternar').click();
          fixture.detectChanges();
          doc.body.innerHTML = fixture.nativeElement.outerHTML;
          await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));
          verificarAlternar(true);
          const faixa = doc.querySelector<HTMLElement>('.metricas')!;
          const fila = doc.querySelector<HTMLElement>('.corpo-painel')!;
          const miolo = doc.querySelector<HTMLElement>('.miolo')!;
          const extras = doc.querySelector<HTMLElement>('.extras')!;
          expect(win.innerWidth).toBe(largura);
          expect(win.innerHeight).toBe(altura);
          expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(largura);
          expect(faixa.getBoundingClientRect().height).toBeLessThanOrEqual(altura * .4 + 1);
          expect(faixa.getBoundingClientRect().height).toBeGreaterThan(100);
          expect(fila.getBoundingClientRect().height).toBeGreaterThan(0);
          expect(fila.getBoundingClientRect().top).toBeLessThan(altura);
          expect(win.getComputedStyle(faixa).overflowY).toBe('auto');
          expect(faixa.scrollHeight).toBeGreaterThan(faixa.clientHeight);
          expect(win.getComputedStyle(miolo).overflowY).toBe('visible');
          expect(win.getComputedStyle(extras).overflowY).toBe('visible');
          const rolaveis = [faixa, ...Array.from(faixa.querySelectorAll<HTMLElement>('*'))]
            .filter(elemento => ['auto', 'scroll'].includes(win.getComputedStyle(elemento).overflowY)
              && elemento.scrollHeight > elemento.clientHeight);
          expect(rolaveis).toEqual([faixa]);
          faixa.focus();
          expect(doc.activeElement).toBe(faixa);
          if (largura <= 860) {
            expect(doc.querySelector('.alternar')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
            expect(win.getComputedStyle(doc.querySelector('.resumo-celular')!).display).toBe('grid');
            expect(doc.querySelector('.mini-grafico-celular')).toBeNull();
            expect(doc.querySelectorAll('.card-grafico').length).toBe(1);
          } else {
            const grafico = doc.querySelector<HTMLElement>('.principais .card-grafico')!;
            expect(grafico).not.toBeNull();
            const barras = Array.from(doc.querySelectorAll<HTMLElement>('.card-grafico .item-barra'));
            expect(barras.length).toBe(perfil === 'supervisor' ? 6 : 2);
            const cards = Array.from(doc.querySelectorAll<HTMLElement>('.principais .bloco-cards > .cartao'));
            expect(cards.length).toBe(perfil === 'supervisor' ? 4 : 3);
            for (const card of cards) {
              expect(card.getBoundingClientRect().width).toBeGreaterThanOrEqual(240);
            }
            if (perfil === 'supervisor' && largura === 861) {
              const equipe = doc.querySelector<HTMLElement>('.principais .equipe')!;
              expect(equipe.getBoundingClientRect().top).toBeGreaterThan(cards[0].getBoundingClientRect().top);
            }
          }
          if (perfil === 'supervisor') {
            const pendentes = doc.querySelector<HTMLButtonElement>('.principais .equipe .pendentes')!;
            pendentes.focus();
            await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));
            expect(doc.activeElement).toBe(pendentes);
            expect(pendentes.getBoundingClientRect().top).toBeGreaterThanOrEqual(faixa.getBoundingClientRect().top);
            expect(pendentes.getBoundingClientRect().bottom).toBeLessThanOrEqual(faixa.getBoundingClientRect().bottom);
          }
          const privacidade = extras.querySelector<HTMLElement>('.grade-extras > .cartao:last-child')!;
          const titulo = privacidade.querySelector<HTMLElement>('h3')!;
          expect(titulo.textContent).toContain('Privacidade');
          titulo.scrollIntoView({ block: 'start' });
          await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));
          expect(titulo.getBoundingClientRect().top).toBeGreaterThanOrEqual(faixa.getBoundingClientRect().top);
          expect(titulo.getBoundingClientRect().bottom).toBeLessThanOrEqual(faixa.getBoundingClientRect().bottom);
          const ultimoTexto = privacidade.querySelector<HTMLElement>('p:last-child')!;
          ultimoTexto.scrollIntoView({ block: 'end' });
          await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));
          expect(ultimoTexto.getBoundingClientRect().top).toBeGreaterThanOrEqual(faixa.getBoundingClientRect().top);
          expect(ultimoTexto.getBoundingClientRect().bottom).toBeLessThanOrEqual(faixa.getBoundingClientRect().bottom);
          expect(faixa.scrollTop).toBeGreaterThan(0);
          expect(miolo.scrollTop).toBe(0);
          expect(extras.scrollTop).toBe(0);
          expect(faixa.getBoundingClientRect().height).toBeLessThanOrEqual(altura * .4 + 1);
          expect(fila.getBoundingClientRect().height).toBeGreaterThan(0);
          expect(fila.getBoundingClientRect().top).toBeLessThan(altura);
          expect(win.getComputedStyle(doc.querySelector('.cartao')!).backgroundColor)
            .toBe(tema === 'claro' ? 'rgb(255, 255, 255)' : 'rgb(36, 35, 29)');
          expect(win.getComputedStyle(doc.querySelector('.numero')!).fontVariantNumeric).toBe('tabular-nums');
          expect(doc.querySelector('.equipe') === null).toBe(perfil === 'corretor');
        });
      }
    }
  }
});
