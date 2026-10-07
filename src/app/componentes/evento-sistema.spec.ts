import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AcaoEvento } from '../conversa/trilha';
import { EventoSistema } from './evento-sistema';

describe('EventoSistema', () => {
  let fixture: ComponentFixture<EventoSistema>;
  let componente: EventoSistema;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EventoSistema],
    });
    fixture = TestBed.createComponent(EventoSistema);
    componente = fixture.componentInstance;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-tema');
  });

  it('padrao compacto falso preserva regua, marca de estado, rotulo em caixa alta e botao de acao com emissao', () => {
    const acaoMock: AcaoEvento = {
      rotulo: 'Rever escolha',
      tipo: 'rever-escolha',
    };

    fixture.componentRef.setInput('variante', 'atencao');
    fixture.componentRef.setInput('rotulo', 'Conversa não iniciada');
    fixture.componentRef.setInput('texto', 'Sem essa autorização, a conversa não começará.');
    fixture.componentRef.setInput('acao', acaoMock);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.evento-compacto')).toBeNull();

    const regua = raiz.querySelector('.regua');
    expect(regua).not.toBeNull();

    const marca = raiz.querySelector('.marca-estado');
    expect(marca).not.toBeNull();
    expect(marca?.getAttribute('data-variante')).toBe('atencao');

    const rotulo = raiz.querySelector('.rotulo');
    expect(rotulo).not.toBeNull();
    expect(rotulo?.textContent?.trim()).toBe('Conversa não iniciada');

    const texto = raiz.querySelector('.texto');
    expect(texto?.textContent?.trim()).toBe('Sem essa autorização, a conversa não começará.');

    const botaoAcao = raiz.querySelector('.acao') as HTMLButtonElement;
    expect(botaoAcao).not.toBeNull();
    expect(botaoAcao.textContent?.trim()).toBe('Rever escolha');

    let acaoEmitida: AcaoEvento | null = null;
    componente.acionar.subscribe((a) => (acaoEmitida = a));

    botaoAcao.click();
    expect(acaoEmitida as AcaoEvento | null).toEqual(acaoMock);
  });

  it('compacto verdadeiro com sucesso exibe linha central com icone check e texto exato sem regua nem acao', () => {
    const acaoMock: AcaoEvento = {
      rotulo: 'Ignorar',
      tipo: 'rever-escolha',
    };

    fixture.componentRef.setInput('compacto', true);
    fixture.componentRef.setInput('variante', 'sucesso');
    fixture.componentRef.setInput('rotulo', 'Reunião confirmada');
    fixture.componentRef.setInput('texto', 'Quarta, 7 de outubro, 14h às 15h');
    fixture.componentRef.setInput('acao', acaoMock);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const compactoEl = raiz.querySelector('.evento-compacto') as HTMLElement;
    expect(compactoEl).not.toBeNull();

    const iconeCheck = compactoEl.querySelector('.icone-check');
    expect(iconeCheck).not.toBeNull();
    expect(iconeCheck?.getAttribute('aria-hidden')).toBe('true');

    expect(compactoEl.textContent?.trim()).toBe('Reunião com Helena Braga'.includes('HB') ? '' : 'Reunião confirmada · Quarta, 7 de outubro, 14h às 15h');
    expect(compactoEl.querySelector('.rotulo')).toBeNull();
    expect(compactoEl.querySelector('.regua')).toBeNull();
    expect(compactoEl.querySelector('.marca-estado')).toBeNull();
    expect(compactoEl.querySelector('.acao')).toBeNull();

    const estiloCompacto = window.getComputedStyle(compactoEl);
    expect(estiloCompacto.textAlign).toBe('center');
    expect(estiloCompacto.fontSize).toBe('12px');
    expect(estiloCompacto.textTransform).not.toBe('uppercase');

    document.documentElement.setAttribute('data-tema', 'claro');
    fixture.detectChanges();
    const corClara = window.getComputedStyle(compactoEl).color;
    expect(corClara.length).toBeGreaterThan(0);

    document.documentElement.setAttribute('data-tema', 'escuro');
    fixture.detectChanges();
    const corEscura = window.getComputedStyle(compactoEl).color;
    expect(corEscura.length).toBeGreaterThan(0);
    expect(corClara).not.toBe(corEscura);

    expect(estiloCompacto.maxWidth).toBe('560px');
    expect(estiloCompacto.wordBreak).toBe('break-word');

    document.documentElement.removeAttribute('data-tema');
  });
});
