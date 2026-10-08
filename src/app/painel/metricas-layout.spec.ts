import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessaoStore } from '../sessao/sessao-store';
import { Painel } from './painel';
import { metricasParaTeste } from './metricas-painel.fixture';
import { formatadorMetricas } from './formatador-metricas';

describe('Layout real das métricas por viewport (S-22/S-48)', () => {
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
    window.focus();
    localStorage.removeItem('solar.metricas.teste-layout');
  });

  for (const perfil of ['supervisor', 'corretor'] as const) {
    for (const tema of ['claro', 'escuro'] as const) {
      for (const [largura, altura] of [[1440, 900], [861, 600], [860, 700], [390, 844], [390, 568]]) {
        it(`${perfil}, tema ${tema}, ${largura}×${altura}: Visão geral sem métricas, aba Métricas completa e sem expandida`, async () => {
          TestBed.inject(SessaoStore).definir({
            usuario: { id: 'teste-layout', nome: 'Conta', email: 'conta@solar.com.br' },
            perfil,
            statusCorretor: 'aprovado',
            corretorId: perfil === 'corretor' ? 'c1' : null,
            vinculoAtivo: true,
            filtrosPermitidos: perfil === 'corretor' ? ['meus_leads'] : ['visao_geral'],
            filtroInicial: perfil === 'corretor' ? 'meus_leads' : 'visao_geral',
            pendentesAprovacao: 1,
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
              id: 'lead-layout',
              nomeExibicao: null,
              referencia: '123',
              pedidoResumo: 'Comprar · Moema',
              criadoEm: '2026-10-03T15:00:00Z',
              qualificacao: 50,
              leadStatus: 'encaminhado',
              encaminhamentoStatus: 'atribuido',
              corretor: { id: 'c1', nome: 'Corretor', iniciais: 'CO' },
            }],
          });
          fixture.detectChanges();

          const quadro = document.createElement('iframe');
          quadros.push(quadro);
          quadro.style.cssText = `width:${largura}px;height:${altura}px;border:0;position:fixed;left:0;top:0;`;
          document.body.appendChild(quadro);
          const doc = quadro.contentDocument!;
          const obterCss = () => [...Array.from(document.styleSheets), ...document.adoptedStyleSheets]
            .map(folha => {
              try { return Array.from(folha.cssRules).map(regra => regra.cssText).join('\n'); }
              catch { return ''; }
            }).join('\n');

          doc.open();
          doc.write(`<!doctype html><html lang="pt-BR" data-tema="${tema}"><head><base href="${document.baseURI}"><style>${obterCss()}\nhtml,body{margin:0;height:100%;}body{display:flex;flex-direction:column;}</style></head><body>${fixture.nativeElement.outerHTML}</body></html>`);
          doc.close();
          await new Promise<void>(resolve => quadro.contentWindow!.requestAnimationFrame(() => resolve()));
          const win = quadro.contentWindow!;

          const shell = doc.querySelector<HTMLElement>('.painel-shell')!;
          const nav = doc.querySelector<HTMLElement>('nav')!;
          const painelFila = doc.querySelector<HTMLElement>('#painel-fila-leads')!;
          const corpo = doc.querySelector<HTMLElement>('.corpo-painel')!;
          const shellRect = shell.getBoundingClientRect();
          const navRect = nav.getBoundingClientRect();
          const painelFilaRect = painelFila.getBoundingClientRect();
          const corpoRect = corpo.getBoundingClientRect();
          const navMargemInferior = parseFloat(win.getComputedStyle(nav).marginBottom);
          const areaDisponivelFila = shellRect.bottom - (navRect.bottom + navMargemInferior);

          expect(doc.querySelector('app-metricas-painel')).toBeNull();
          expect(doc.querySelector('.metricas')).toBeNull();
          expect(painelFila.classList.contains('oculto')).toBeFalse();
          expect(doc.querySelector('#painel-metricas')?.classList.contains('oculto')).toBeTrue();

          expect(Math.abs(painelFilaRect.bottom - shellRect.bottom)).toBeLessThanOrEqual(2);
          expect(Math.abs(painelFilaRect.height - areaDisponivelFila)).toBeLessThanOrEqual(2);
          expect(Math.abs(corpoRect.bottom - shellRect.bottom)).toBeLessThanOrEqual(2);
          expect(Math.abs(corpoRect.height - (shellRect.bottom - corpoRect.top))).toBeLessThanOrEqual(2);

          if (largura > 860) {
            const colunaFila = doc.querySelector<HTMLElement>('.coluna-fila')!;
            const colunaDetalhe = doc.querySelector<HTMLElement>('.coluna-detalhe')!;
            const listaLeads = doc.querySelector<HTMLElement>('.lista-leads')!;
            expect(listaLeads).not.toBeNull();
            expect(colunaFila).not.toBeNull();
            expect(colunaDetalhe).not.toBeNull();
            expect(win.getComputedStyle(listaLeads).display).not.toBe('none');
            expect(win.getComputedStyle(colunaDetalhe).display).not.toBe('none');
            expect(Math.abs(colunaFila.getBoundingClientRect().height - corpoRect.height)).toBeLessThanOrEqual(2);
            expect(Math.abs(colunaDetalhe.getBoundingClientRect().height - corpoRect.height)).toBeLessThanOrEqual(2);
          } else {
            const colunaFila = doc.querySelector<HTMLElement>('.coluna-fila')!;
            const colunaDetalhe = doc.querySelector<HTMLElement>('.coluna-detalhe')!;
            expect(colunaFila).not.toBeNull();
            expect(win.getComputedStyle(colunaFila).display).not.toBe('none');
            expect(win.getComputedStyle(colunaDetalhe).display).toBe('none');
          }

          fixture.componentInstance.selecionarMetricas();
          fixture.detectChanges();
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

          doc.head.querySelector('style')!.textContent = `${obterCss()}\nhtml,body{margin:0;height:100%;}body{display:flex;flex-direction:column;}`;
          doc.body.innerHTML = fixture.nativeElement.outerHTML;
          await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));

          expect(doc.querySelector('#painel-fila-leads')?.classList.contains('oculto')).toBeTrue();
          expect(doc.querySelector('#painel-metricas')?.classList.contains('oculto')).toBeFalse();
          expect(doc.querySelector('app-metricas-painel')).not.toBeNull();

          const painelMetricas = doc.querySelector<HTMLElement>('#painel-metricas')!;
          const appMetricas = doc.querySelector<HTMLElement>('app-metricas-painel')!;
          const faixa = doc.querySelector<HTMLElement>('.metricas')!;
          expect(faixa).not.toBeNull();
          expect(faixa.classList.contains('expandida')).toBeFalse();
          expect(doc.querySelector('.alternar')).toBeNull();
          expect(doc.querySelector('.mini-grafico-celular')).toBeNull();
          expect(doc.querySelector('.resumo-celular')).toBeNull();

          const painelMetricasRect = painelMetricas.getBoundingClientRect();
          const appMetricasRect = appMetricas.getBoundingClientRect();
          const faixaRect = faixa.getBoundingClientRect();
          const areaDisponivelMetricas = shellRect.bottom - (navRect.bottom + navMargemInferior);

          expect(Math.abs(painelMetricasRect.bottom - shellRect.bottom)).toBeLessThanOrEqual(2);
          expect(Math.abs(painelMetricasRect.height - areaDisponivelMetricas)).toBeLessThanOrEqual(2);
          expect(Math.abs(appMetricasRect.height - painelMetricasRect.height)).toBeLessThanOrEqual(2);
          expect(Math.abs(faixaRect.height - painelMetricasRect.height)).toBeLessThanOrEqual(2);

          expect(faixaRect.height).toBeGreaterThan(altura * 0.4);
          expect(win.getComputedStyle(faixa).height).not.toContain('40vh');
          expect(win.getComputedStyle(faixa).height).not.toContain('40dvh');
          expect(win.getComputedStyle(faixa).maxHeight).toBe('none');
          expect(win.getComputedStyle(appMetricas).maxHeight).toBe('none');

          const principais = doc.querySelector<HTMLElement>('.principais')!;
          expect(principais).not.toBeNull();
          expect(win.getComputedStyle(principais).display).not.toBe('none');
          if (largura <= 860) {
            expect(win.getComputedStyle(principais).display).toBe('flex');
            expect(win.getComputedStyle(principais).flexDirection).toBe('column');
          }

          const extras = doc.querySelector<HTMLElement>('.extras')!;
          expect(extras).not.toBeNull();
          expect(extras.hidden).toBeFalse();
          expect(win.getComputedStyle(extras).display).not.toBe('none');
          expect(extras.querySelectorAll('.grade-extras .cartao').length).toBe(7);

          const grafico = doc.querySelector<HTMLElement>('.principais .card-grafico')!;
          expect(grafico).not.toBeNull();
          const barras = Array.from(doc.querySelectorAll<HTMLElement>('.card-grafico .item-barra'));
          expect(barras.length).toBe(perfil === 'supervisor' ? 6 : 2);

          const rotuloCard = doc.querySelector<HTMLElement>('.card-grafico .rotulo-etapa')!;
          expect(rotuloCard).not.toBeNull();
          if (largura > 860) {
            expect(win.getComputedStyle(rotuloCard).webkitLineClamp).toBe('2');
            expect(win.getComputedStyle(rotuloCard).overflow).toBe('hidden');
          } else {
            expect(win.getComputedStyle(rotuloCard).display).toBe('block');
            expect(win.getComputedStyle(rotuloCard).overflow).toBe('visible');
            expect(win.getComputedStyle(rotuloCard).webkitLineClamp).not.toBe('2');
          }

          if (perfil === 'supervisor') {
            const blocosSupervisor = Array.from(doc.querySelectorAll<HTMLElement>('.area-rotulos .bloco-rotulo'));
            const rotulosSupervisor = Array.from(doc.querySelectorAll<HTMLElement>('.area-rotulos .rotulo-etapa'));
            expect(blocosSupervisor.length).toBe(6);
            expect(rotulosSupervisor.length).toBe(6);

            for (let i = 0; i < 6; i++) {
              const bRect = blocosSupervisor[i].getBoundingClientRect();
              const rRect = rotulosSupervisor[i].getBoundingClientRect();
              const barraRect = barras[i].getBoundingClientRect();

              expect(Math.abs(bRect.left - barraRect.left)).toBeLessThanOrEqual(2);
              expect(Math.abs(bRect.right - barraRect.right)).toBeLessThanOrEqual(2);

              if (largura <= 860) {
                expect(rRect.left).toBeGreaterThanOrEqual(bRect.left - 2);
                expect(rRect.right).toBeLessThanOrEqual(bRect.right + 2);

                const range = doc.createRange();
                const textNode = rotulosSupervisor[i].firstChild;
                if (textNode) {
                  range.selectNodeContents(textNode);
                  const rects = Array.from(range.getClientRects());
                  for (const r of rects) {
                    expect(r.left).toBeGreaterThanOrEqual(bRect.left - 2);
                    expect(r.right).toBeLessThanOrEqual(bRect.right + 2);
                  }
                }
              }

              if (i < 5) {
                const proxRRect = rotulosSupervisor[i + 1].getBoundingClientRect();
                expect(rRect.right).toBeLessThanOrEqual(proxRRect.left + 2);
              }
            }
          }

          const cards = Array.from(doc.querySelectorAll<HTMLElement>('.principais .bloco-cards > .cartao'));
          expect(cards.length).toBe(perfil === 'supervisor' ? 4 : 3);
          for (const card of cards) {
            expect(card.getBoundingClientRect().width).toBeGreaterThan(0);
          }

          expect(win.innerWidth).toBe(largura);
          expect(win.innerHeight).toBe(altura);
          expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(largura);
          expect(win.getComputedStyle(faixa).overflowY).toBe('auto');
          faixa.focus();
          expect(doc.activeElement).toBe(faixa);

          expect(win.getComputedStyle(doc.querySelector('.cartao')!).backgroundColor)
            .toBe(tema === 'claro' ? 'rgb(255, 255, 255)' : 'rgb(36, 35, 29)');
          expect(win.getComputedStyle(doc.querySelector('.numero')!).fontVariantNumeric).toBe('tabular-nums');
          expect(doc.querySelector('.equipe') === null).toBe(perfil === 'corretor');

          if (perfil === 'supervisor') {
            const pendentes = doc.querySelector<HTMLButtonElement>('.principais .equipe .pendentes')!;
            pendentes.focus();
            await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));
            expect(doc.activeElement).toBe(pendentes);
            expect(pendentes.textContent).toContain('aprovação');
          }

          const miolo = doc.querySelector<HTMLElement>('.miolo')!;
          expect(win.getComputedStyle(miolo).overflowY).toBe('visible');
          expect(win.getComputedStyle(extras).overflowY).toBe('visible');

          if (altura <= 600 || largura <= 860) {
            expect(faixa.scrollHeight).toBeGreaterThan(faixa.clientHeight);
          }

          const rolaveis = [faixa, ...Array.from(faixa.querySelectorAll<HTMLElement>('*'))]
            .filter(elemento => ['auto', 'scroll'].includes(win.getComputedStyle(elemento).overflowY)
              && elemento.scrollHeight > elemento.clientHeight);
          expect(rolaveis).toEqual(faixa.scrollHeight > faixa.clientHeight ? [faixa] : []);

          const privacidade = extras.querySelector<HTMLElement>('.grade-extras > .cartao:last-child')!;
          const titulo = privacidade.querySelector<HTMLElement>('h3')!;
          expect(titulo.textContent).toContain('Privacidade');
          titulo.scrollIntoView({ block: 'start' });
          await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));
          expect(titulo.getBoundingClientRect().top).toBeGreaterThanOrEqual(faixa.getBoundingClientRect().top - 2);
          expect(titulo.getBoundingClientRect().bottom).toBeLessThanOrEqual(faixa.getBoundingClientRect().bottom + 2);

          const ultimoTexto = privacidade.querySelector<HTMLElement>('p:last-child')!;
          ultimoTexto.scrollIntoView({ block: 'end' });
          await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));
          expect(ultimoTexto.getBoundingClientRect().top).toBeGreaterThanOrEqual(faixa.getBoundingClientRect().top - 2);
          expect(ultimoTexto.getBoundingClientRect().bottom).toBeLessThanOrEqual(faixa.getBoundingClientRect().bottom + 2);

          if (altura <= 600 || largura <= 860) {
            expect(faixa.scrollHeight).toBeGreaterThan(faixa.clientHeight);
            expect(faixa.scrollTop).toBeGreaterThan(0);
          }
          expect(miolo.scrollTop).toBe(0);
          expect(extras.scrollTop).toBe(0);

          if (perfil === 'supervisor') {
            fixture.componentInstance.selecionarFiltro('visao_geral');
            http.expectOne(r => r.url === '/api/painel/leads').flush({
              total: 1,
              itens: [{
                id: 'lead-layout',
                nomeExibicao: null,
                referencia: '123',
                pedidoResumo: 'Comprar · Moema',
                criadoEm: '2026-10-03T15:00:00Z',
                qualificacao: 50,
                leadStatus: 'encaminhado',
                encaminhamentoStatus: 'atribuido',
                corretor: { id: 'c1', nome: 'Corretor', iniciais: 'CO' },
              }],
            });
          } else {
            fixture.componentInstance.retomarMeusLeads();
          }
          fixture.detectChanges();
          doc.head.querySelector('style')!.textContent = `${obterCss()}\nhtml,body{margin:0;height:100%;}body{display:flex;flex-direction:column;}`;
          doc.body.innerHTML = fixture.nativeElement.outerHTML;
          await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));

          expect(doc.querySelector('app-metricas-painel')).toBeNull();
          expect(doc.querySelector('.metricas')).toBeNull();
          const painelFilaFinal = doc.querySelector<HTMLElement>('#painel-fila-leads')!;
          const corpoFinal = doc.querySelector<HTMLElement>('.corpo-painel')!;
          expect(painelFilaFinal.classList.contains('oculto')).toBeFalse();
          expect(doc.querySelector('#painel-metricas')?.classList.contains('oculto')).toBeTrue();

          const corpoFinalRect = corpoFinal.getBoundingClientRect();
          expect(Math.abs(painelFilaFinal.getBoundingClientRect().bottom - shellRect.bottom)).toBeLessThanOrEqual(2);
          expect(Math.abs(corpoFinalRect.bottom - shellRect.bottom)).toBeLessThanOrEqual(2);
          expect(Math.abs(corpoFinalRect.height - (shellRect.bottom - corpoFinalRect.top))).toBeLessThanOrEqual(2);

          if (largura > 860) {
            const colunaFilaFinal = doc.querySelector<HTMLElement>('.coluna-fila')!;
            const colunaDetalheFinal = doc.querySelector<HTMLElement>('.coluna-detalhe')!;
            expect(colunaFilaFinal).not.toBeNull();
            expect(colunaDetalheFinal).not.toBeNull();
            expect(Math.abs(colunaFilaFinal.getBoundingClientRect().height - corpoFinalRect.height)).toBeLessThanOrEqual(2);
            expect(Math.abs(colunaDetalheFinal.getBoundingClientRect().height - corpoFinalRect.height)).toBeLessThanOrEqual(2);
          } else {
            const colunaFilaFinal = doc.querySelector<HTMLElement>('.coluna-fila')!;
            const colunaDetalheFinal = doc.querySelector<HTMLElement>('.coluna-detalhe')!;
            expect(colunaFilaFinal).not.toBeNull();
            expect(win.getComputedStyle(colunaFilaFinal).display).not.toBe('none');
            expect(win.getComputedStyle(colunaDetalheFinal).display).toBe('none');
          }
        });
      }
    }
  }

  for (const tema of ['claro', 'escuro'] as const) {
    it(`supervisor, tema ${tema}, 390px: rótulos das seis etapas quebram dentro da coluna sem sobreposição`, async () => {
      TestBed.inject(SessaoStore).definir({
        usuario: { id: 'teste-layout', nome: 'Supervisor', email: 'supervisor@solar.com.br' },
        perfil: 'supervisor',
        statusCorretor: 'aprovado',
        corretorId: null,
        vinculoAtivo: true,
        filtrosPermitidos: ['visao_geral'],
        filtroInicial: 'visao_geral',
        pendentesAprovacao: 1,
      });

      const fixture = TestBed.createComponent(Painel);
      fixture.detectChanges();
      fixture.componentInstance.selecionarFiltro('visao_geral');
      fixture.detectChanges();

      http.expectOne(r => r.url === '/api/painel/leads').flush({
        total: 1,
        itens: [{
          id: 'lead-layout',
          nomeExibicao: null,
          referencia: '123',
          pedidoResumo: 'Comprar · Moema',
          criadoEm: '2026-10-03T15:00:00Z',
          qualificacao: 50,
          leadStatus: 'encaminhado',
          encaminhamentoStatus: 'atribuido',
          corretor: { id: 'c1', nome: 'Corretor', iniciais: 'CO' },
        }],
      });
      fixture.detectChanges();

      fixture.componentInstance.selecionarMetricas();
      fixture.detectChanges();
      const [bloco] = await fixture.getDeferBlocks();
      await bloco.render(DeferBlockState.Complete);

      const dados = metricasParaTeste();
      http.expectOne('/api/painel/metricas?dias=30').flush(dados);
      fixture.detectChanges();

      const quadro = document.createElement('iframe');
      quadros.push(quadro);
      quadro.style.cssText = 'width:390px;height:844px;border:0;position:fixed;left:0;top:0;';
      document.body.appendChild(quadro);
      const doc = quadro.contentDocument!;
      const obterCss = () => [...Array.from(document.styleSheets), ...document.adoptedStyleSheets]
        .map(folha => {
          try { return Array.from(folha.cssRules).map(regra => regra.cssText).join('\n'); }
          catch { return ''; }
        }).join('\n');

      doc.open();
      doc.write(`<!doctype html><html lang="pt-BR" data-tema="${tema}"><head><base href="${document.baseURI}"><style>${obterCss()}\nhtml,body{margin:0;height:100%;}body{display:flex;flex-direction:column;}</style></head><body>${fixture.nativeElement.outerHTML}</body></html>`);
      doc.close();
      await new Promise<void>(resolve => quadro.contentWindow!.requestAnimationFrame(() => resolve()));
      const win = quadro.contentWindow!;

      const cardGrafico = doc.querySelector<HTMLElement>('.principais .card-grafico')!;
      const gradeCompleta = doc.querySelector<HTMLElement>('.grade-completa')!;
      const areaRotulos = doc.querySelector<HTMLElement>('.area-rotulos')!;
      const blocoCards = doc.querySelector<HTMLElement>('.principais .bloco-cards')!;
      expect(cardGrafico).not.toBeNull();
      expect(gradeCompleta).not.toBeNull();
      expect(areaRotulos).not.toBeNull();
      expect(blocoCards).not.toBeNull();

      const barras = Array.from(doc.querySelectorAll<HTMLElement>('.card-grafico .item-barra'));
      const blocos = Array.from(doc.querySelectorAll<HTMLElement>('.area-rotulos .bloco-rotulo'));
      const rotulos = Array.from(doc.querySelectorAll<HTMLElement>('.area-rotulos .rotulo-etapa'));
      const percentuais = Array.from(doc.querySelectorAll<HTMLElement>('.area-rotulos .percentual-etapa'));

      expect(barras.length).toBe(6);
      expect(blocos.length).toBe(6);
      expect(rotulos.length).toBe(6);
      expect(percentuais.length).toBe(6);

      const etapasEsperadas = ['iniciadas', 'intencao', 'essenciais', 'encaminhamento', 'corretor', 'horario'] as const;
      for (let i = 0; i < 6; i++) {
        const etapa = etapasEsperadas[i];
        const textoEsperado = formatadorMetricas.tituloEtapa(etapa);
        expect(rotulos[i].textContent?.trim()).toBe(textoEsperado);

        const partesTexto = textoEsperado.split(' ');
        const ultimaPalavra = partesTexto[partesTexto.length - 1];
        expect(rotulos[i].textContent).toContain(ultimaPalavra);

        const valorTopo = barras[i].querySelector('.valor-topo')!;
        expect(valorTopo.textContent?.trim()).toBe(formatadorMetricas.numero(dados.avanco[i].conversas));
        expect(percentuais[i].textContent?.trim()).toBe(formatadorMetricas.percentual(dados.avanco[i].conversas, dados.avanco[0].conversas));

        const blocoRect = blocos[i].getBoundingClientRect();
        const barraRect = barras[i].getBoundingClientRect();
        const rotuloRect = rotulos[i].getBoundingClientRect();

        expect(Math.abs(blocoRect.left - barraRect.left)).toBeLessThanOrEqual(2);
        expect(Math.abs(blocoRect.right - barraRect.right)).toBeLessThanOrEqual(2);

        expect(rotuloRect.left).toBeGreaterThanOrEqual(blocoRect.left - 2);
        expect(rotuloRect.right).toBeLessThanOrEqual(blocoRect.right + 2);

        expect(win.getComputedStyle(rotulos[i]).display).toBe('block');
        expect(win.getComputedStyle(rotulos[i]).overflow).toBe('visible');

        const range = doc.createRange();
        const textNode = rotulos[i].firstChild!;
        expect(textNode).not.toBeNull();
        range.selectNodeContents(textNode);
        const rects = Array.from(range.getClientRects());
        expect(rects.length).toBeGreaterThan(1);

        for (const r of rects) {
          expect(r.left).toBeGreaterThanOrEqual(blocoRect.left - 2);
          expect(r.right).toBeLessThanOrEqual(blocoRect.right + 2);
          expect(r.top).toBeGreaterThanOrEqual(rotuloRect.top - 2);
          expect(r.bottom).toBeLessThanOrEqual(rotuloRect.bottom + 2);
          expect(r.width).toBeLessThanOrEqual(blocoRect.width + 2);
        }

        const ultimoRect = rects[rects.length - 1];
        expect(ultimoRect.bottom).toBeLessThanOrEqual(rotuloRect.bottom + 2);

        const textoCompleto = textNode.textContent!;
        const indiceUltimaPalavra = textoCompleto.lastIndexOf(ultimaPalavra);
        expect(indiceUltimaPalavra).toBeGreaterThan(-1);
        const rangeUltima = doc.createRange();
        rangeUltima.setStart(textNode, indiceUltimaPalavra);
        rangeUltima.setEnd(textNode, indiceUltimaPalavra + ultimaPalavra.length);
        const rectsUltima = Array.from(rangeUltima.getClientRects());
        expect(rectsUltima.length).toBeGreaterThanOrEqual(1);
        for (const ru of rectsUltima) {
          expect(ru.left).toBeGreaterThanOrEqual(blocoRect.left - 2);
          expect(ru.right).toBeLessThanOrEqual(blocoRect.right + 2);
          expect(ru.bottom).toBeLessThanOrEqual(rotuloRect.bottom + 2);
          expect(ru.top).toBeGreaterThanOrEqual(rotuloRect.top - 2);
        }

        if (i < 5) {
          const proximoBlocoRect = blocos[i + 1].getBoundingClientRect();
          const proximoRotuloRect = rotulos[i + 1].getBoundingClientRect();
          expect(blocoRect.right).toBeLessThanOrEqual(proximoBlocoRect.left + 2);
          expect(rotuloRect.right).toBeLessThanOrEqual(proximoRotuloRect.left + 2);
        }
      }

      expect(cardGrafico.scrollWidth).toBeLessThanOrEqual(cardGrafico.clientWidth + 1);
      expect(gradeCompleta.scrollWidth).toBeLessThanOrEqual(gradeCompleta.clientWidth + 1);
      expect(areaRotulos.scrollWidth).toBeLessThanOrEqual(areaRotulos.clientWidth + 1);

      const areaRotulosRect = areaRotulos.getBoundingClientRect();
      const cardGraficoRect = cardGrafico.getBoundingClientRect();
      const blocoCardsRect = blocoCards.getBoundingClientRect();

      expect(areaRotulosRect.bottom).toBeLessThanOrEqual(cardGraficoRect.bottom + 2);
      expect(cardGraficoRect.bottom).toBeLessThanOrEqual(blocoCardsRect.top + 2);
    });
  }
});
