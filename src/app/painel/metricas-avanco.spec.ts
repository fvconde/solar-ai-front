import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetricasAvanco } from './metricas-avanco';
import { AvancoMetricasPainel } from './metricas-contrato';
import { formatadorMetricas } from './formatador-metricas';

describe('MetricasAvanco', () => {
  let fixture: ComponentFixture<MetricasAvanco>;
  let component: MetricasAvanco;

  const etapasReais: AvancoMetricasPainel[] = [
    { etapa: 'iniciadas', conversas: 14 },
    { etapa: 'intencao', conversas: 12 },
    { etapa: 'essenciais', conversas: 8 },
    { etapa: 'encaminhamento', conversas: 9, semEssenciais: 2 },
    { etapa: 'corretor', conversas: 7 },
    { etapa: 'horario', conversas: 4 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetricasAvanco],
    }).compileComponents();

    fixture = TestBed.createComponent(MetricasAvanco);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('etapas', etapasReais);
    fixture.componentRef.setInput('compacto', false);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('renderiza ol e buttons na ordem com os seis aria-labels completos', () => {
    const ol = fixture.nativeElement.querySelector('ol');
    expect(ol).not.toBeNull();
    expect(ol.getAttribute('aria-label')).toBe(formatadorMetricas.ariaAvanco(etapasReais));

    const botoes: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.botao-barra');
    expect(botoes.length).toBe(6);

    etapasReais.forEach((item, i) => {
      const esperado = formatadorMetricas.ariaEtapa(item, 14, i === 0, 'iniciadas');
      expect(botoes[i].getAttribute('aria-label')).toBe(esperado);
    });
  });

  it('mostra percentuais 100%, 86%, 57%, 64%, 50%, 29% abaixo das barras', () => {
    const pcts = fixture.nativeElement.querySelectorAll('.percentual-etapa');
    expect(pcts.length).toBe(6);
    expect(pcts[0].textContent.trim()).toBe('100%');
    expect(pcts[1].textContent.trim()).toBe('86%');
    expect(pcts[2].textContent.trim()).toBe('57%');
    expect(pcts[3].textContent.trim()).toBe('64%');
    expect(pcts[4].textContent.trim()).toBe('50%');
    expect(pcts[5].textContent.trim()).toBe('29%');
  });

  it('renderiza encaminhamento (9) visualmente maior que essenciais (8)', () => {
    const barras: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.barra');
    expect(barras.length).toBe(6);
    const altEssenciais = parseFloat(barras[2].style.height);
    const altEncaminhamento = parseFloat(barras[3].style.height);
    expect(altEncaminhamento).toBeGreaterThan(altEssenciais);
  });

  it('foco no botão abre detalhe com referência correta e nota semEssenciais', () => {
    const botoes: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.botao-barra');
    botoes[3].dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();

    expect(component.indiceAtivo()).toBe(3);
    expect(botoes[3].getAttribute('aria-describedby')).toBe(component.idCaixa());

    const caixa = fixture.nativeElement.querySelector('.caixa-detalhe');
    expect(caixa).not.toBeNull();
    expect(caixa.textContent).toContain('Encaminhamento solicitado');
    expect(caixa.textContent).toContain('9 conversas');
    expect(caixa.textContent).toContain('64% das conversas iniciadas');
    expect(caixa.textContent).toContain('5 conversas ainda não atingiram esta etapa');
    expect(caixa.textContent).toContain('Inclui 2 conversas sem os dados essenciais.');

    botoes[0].dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(caixa.textContent).toContain('Conversas iniciadas');
    expect(caixa.textContent).toContain('14 conversas');
    expect(caixa.textContent).toContain('Grupo de referência do período');
    expect(caixa.textContent).not.toContain('ainda não atingiram');
  });

  it('hover troca ativo e reduz opacidade das outras barras para 0.45', () => {
    const botoes: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.botao-barra');
    botoes[1].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(component.indiceAtivo()).toBe(1);
    expect(botoes[1].style.opacity).toBe('1');
    expect(botoes[0].style.opacity).toBe('0.45');
    expect(botoes[2].style.opacity).toBe('0.45');
    expect(botoes[3].style.opacity).toBe('0.45');
    expect(botoes[4].style.opacity).toBe('0.45');
    expect(botoes[5].style.opacity).toBe('0.45');
  });

  it('blur e Escape fecham o detalhe sem alterar contagens', () => {
    const botoes: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.botao-barra');
    component.abrir(1);
    fixture.detectChanges();
    expect(component.indiceAtivo()).toBe(1);

    botoes[1].dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(component.indiceAtivo()).toBeNull();

    const valoresTopo: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.valor-topo');
    expect(valoresTopo[0].textContent.trim()).toBe('14');
    expect(valoresTopo[1].textContent.trim()).toBe('12');
    expect(valoresTopo[2].textContent.trim()).toBe('8');
    expect(valoresTopo[3].textContent.trim()).toBe('9');
    expect(valoresTopo[4].textContent.trim()).toBe('7');
    expect(valoresTopo[5].textContent.trim()).toBe('4');

    component.abrir(2);
    fixture.detectChanges();
    expect(component.indiceAtivo()).toBe(2);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.indiceAtivo()).toBeNull();

    expect(valoresTopo[2].textContent.trim()).toBe('8');
  });

  it('click abre detalhe para toque', () => {
    const botoes: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.botao-barra');
    botoes[4].dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(component.indiceAtivo()).toBe(4);
  });

  it('posiciona primeira e última caixa dentro dos limites da viewport', () => {
    component.abrir(0);
    fixture.detectChanges();
    const caixa = fixture.nativeElement.querySelector('.caixa-detalhe');
    const leftPrimeira = parseFloat(caixa.style.left);
    expect(leftPrimeira).toBeGreaterThanOrEqual(12);

    component.abrir(5);
    fixture.detectChanges();
    const leftUltima = parseFloat(caixa.style.left);
    expect(leftUltima).toBeLessThanOrEqual(window.innerWidth - 12);
  });

  it('série de duas barras do corretor (atribuídas 3 / horário 2) usa 67% e não mostra etapas de supervisor', () => {
    const etapasCorretor: AvancoMetricasPainel[] = [
      { etapa: 'atribuidas', conversas: 3 },
      { etapa: 'horario', conversas: 2 },
    ];
    fixture.componentRef.setInput('etapas', etapasCorretor);
    fixture.detectChanges();

    const botoes: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.botao-barra');
    expect(botoes.length).toBe(2);

    const textoTotal = fixture.nativeElement.textContent;
    expect(textoTotal).not.toContain('Intenção identificada');
    expect(textoTotal).not.toContain('Dados essenciais preenchidos');
    expect(textoTotal).not.toContain('Encaminhamento solicitado');
    expect(textoTotal).not.toContain('Corretor atribuído');

    const pcts = fixture.nativeElement.querySelectorAll('.percentual-etapa');
    expect(pcts.length).toBe(2);
    expect(pcts[0].textContent.trim()).toBe('100%');
    expect(pcts[1].textContent.trim()).toBe('67%');
    expect(botoes[1].getAttribute('aria-label')).toContain('67% das conversas atribuídas');
  });

  it('base vazia com seis e duas barras exibe zeros, —, apenas trilhos e nenhuma cor de preenchimento', () => {
    const etapasZero6: AvancoMetricasPainel[] = [
      { etapa: 'iniciadas', conversas: 0 },
      { etapa: 'intencao', conversas: 0 },
      { etapa: 'essenciais', conversas: 0 },
      { etapa: 'encaminhamento', conversas: 0 },
      { etapa: 'corretor', conversas: 0 },
      { etapa: 'horario', conversas: 0 },
    ];
    fixture.componentRef.setInput('etapas', etapasZero6);
    fixture.detectChanges();

    const valores = fixture.nativeElement.querySelectorAll('.valor-topo');
    valores.forEach((v: Element) => expect(v.textContent?.trim()).toBe('0'));

    const pcts = fixture.nativeElement.querySelectorAll('.percentual-etapa');
    pcts.forEach((p: Element) => expect(p.textContent?.trim()).toBe('—'));

    const texto = fixture.nativeElement.textContent;
    expect(texto).not.toContain('NaN');
    expect(texto).not.toContain('Infinity');

    const barras: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.barra');
    barras.forEach((b) => {
      expect(b.style.background).toContain('var(--inativo-fundo)');
      expect(b.style.background).not.toContain('var(--neutro)');
      expect(b.style.background).not.toContain('var(--marca)');
      expect(b.style.height).toBe('2px');
    });

    const etapasZero2: AvancoMetricasPainel[] = [
      { etapa: 'atribuidas', conversas: 0 },
      { etapa: 'horario', conversas: 0 },
    ];
    fixture.componentRef.setInput('etapas', etapasZero2);
    fixture.detectChanges();

    const barras2: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.barra');
    expect(barras2.length).toBe(2);
    barras2.forEach((b) => {
      expect(b.style.background).toContain('var(--inativo-fundo)');
      expect(b.style.height).toBe('2px');
    });
    const pcts2 = fixture.nativeElement.querySelectorAll('.percentual-etapa');
    pcts2.forEach((p: Element) => expect(p.textContent?.trim()).toBe('—'));
  });

  it('modo compacto não tem eixo e exibe frase de resumo com 29% mantendo buttons e detalhe', () => {
    fixture.componentRef.setInput('etapas', etapasReais);
    fixture.componentRef.setInput('compacto', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.eixo')).toBeNull();
    expect(fixture.nativeElement.querySelector('.grade-completa')).toBeNull();
    expect(fixture.nativeElement.querySelector('.compacto-container')).not.toBeNull();

    const frase = fixture.nativeElement.querySelector('.compacto-frase');
    expect(frase).not.toBeNull();
    expect(frase.textContent).toContain('29% das conversas tiveram horário confirmado');

    const botoes: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.compacto-botao');
    expect(botoes.length).toBe(6);

    botoes[0].dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(component.indiceAtivo()).toBe(0);

    const caixa = fixture.nativeElement.querySelector('.caixa-detalhe');
    expect(caixa.textContent).toContain('Conversas iniciadas');
  });
});
