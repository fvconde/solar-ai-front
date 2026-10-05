import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ConfirmacaoExclusao } from './confirmacao-exclusao';

describe('ConfirmacaoExclusao', () => {
  let fixture: ComponentFixture<ConfirmacaoExclusao>;
  let component: ConfirmacaoExclusao;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmacaoExclusao],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmacaoExclusao);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('permanece fechado inicialmente e renderiza dialog e painel com textos ao abrir', fakeAsync(() => {
    expect(component.aberto()).toBeFalse();
    expect(el().querySelector('.painel')).toBeNull();

    component.abrir();
    fixture.detectChanges();
    tick();

    expect(component.aberto()).toBeTrue();
    const painel = el().querySelector('.painel')!;
    expect(painel).toBeTruthy();
    expect(painel.getAttribute('role')).toBe('alertdialog');
    expect(painel.getAttribute('aria-modal')).toBe('true');
    expect(painel.getAttribute('aria-labelledby')).toBe('apagar-titulo');
    expect(painel.getAttribute('aria-describedby')).toBe('apagar-texto');

    expect(painel.querySelector('#apagar-titulo')?.textContent?.trim()).toBe('Apagar esta conversa?');
    expect(painel.querySelector('#apagar-texto')?.textContent?.trim()).toBe(
      'Esta conversa e suas mensagens serão apagadas definitivamente. Não é possível desfazer.',
    );

    const botaoCancelar = painel.querySelector<HTMLButtonElement>('.botao-cancelar')!;
    expect(botaoCancelar.textContent?.trim()).toBe('Cancelar');
    expect(document.activeElement).toBe(botaoCancelar);

    const botaoAcao = painel.querySelector<HTMLButtonElement>('.botao-destrutivo')!;
    expect(botaoAcao.textContent?.trim()).toBe('Apagar conversa');
  }));

  it('cancelar emite cancelou e devolve foco ao gatilho', fakeAsync(() => {
    const gatilho = document.createElement('button');
    document.body.appendChild(gatilho);

    component.abrir(gatilho);
    fixture.detectChanges();
    tick();

    let cancelado = false;
    component.cancelou.subscribe(() => {
      cancelado = true;
    });

    const botaoCancelar = el().querySelector<HTMLButtonElement>('.botao-cancelar')!;
    botaoCancelar.click();
    fixture.detectChanges();

    expect(cancelado).toBeTrue();
    expect(component.aberto()).toBeFalse();
    expect(document.activeElement).toBe(gatilho);

    document.body.removeChild(gatilho);
  }));

  it('confirmar emite evento de confirmacao', fakeAsync(() => {
    component.abrir();
    fixture.detectChanges();
    tick();

    let confirmado = false;
    component.confirmarExclusao.subscribe(() => {
      confirmado = true;
    });

    const botaoAcao = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;
    botaoAcao.click();
    expect(confirmado).toBeTrue();
  }));

  it('durante apagando bloqueia cancelamento, desativa botoes e exibe estado de carregamento', fakeAsync(() => {
    component.abrir();
    fixture.componentRef.setInput('apagando', true);
    fixture.detectChanges();
    tick();

    const painel = el().querySelector('.painel')!;
    expect(painel.getAttribute('aria-busy')).toBe('true');

    const botaoCancelar = el().querySelector<HTMLButtonElement>('.botao-cancelar')!;
    expect(botaoCancelar.disabled).toBeTrue();

    const botaoCarregando = el().querySelector<HTMLButtonElement>('.botao-destrutivo.carregando')!;
    expect(botaoCarregando).toBeTruthy();
    expect(botaoCarregando.getAttribute('aria-disabled')).toBe('true');
    expect(botaoCarregando.textContent).toContain('Apagando…');
    expect(botaoCarregando.querySelector('.spinner')).toBeTruthy();

    const status = el().querySelector('p[role="status"]')!;
    expect(status.textContent?.trim()).toBe('Apagando a conversa…');

    let confirmado = false;
    component.confirmarExclusao.subscribe(() => {
      confirmado = true;
    });
    botaoCarregando.click();
    expect(confirmado).toBeFalse();

    const dialog = el().querySelector('dialog')!;
    const eventoCancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(eventoCancel);
    expect(component.aberto()).toBeTrue();
  }));

  it('falha confirmada exibe alerta com texto especifico e move foco para Tentar de novo', fakeAsync(() => {
    component.abrir();
    fixture.detectChanges();
    tick();

    fixture.componentRef.setInput('erro', 'confirmada');
    fixture.detectChanges();
    tick();

    const alerta = el().querySelector('[role="alert"]')!;
    expect(alerta).toBeTruthy();
    expect(alerta.querySelector('.negrito-erro')?.textContent?.trim()).toBe('Não foi possível apagar.');
    expect(alerta.textContent).toContain('A conversa continua como estava. Confira sua conexão e tente de novo.');

    const botaoAcao = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;
    expect(botaoAcao.textContent?.trim()).toBe('Tentar de novo');
    expect(document.activeElement).toBe(botaoAcao);
  }));

  it('falha incerta exibe alerta sem o texto negrito e exibe botao Tentar de novo', fakeAsync(() => {
    component.abrir();
    fixture.detectChanges();
    tick();

    fixture.componentRef.setInput('erro', 'incerta');
    fixture.detectChanges();
    tick();

    const alerta = el().querySelector('[role="alert"]')!;
    expect(alerta).toBeTruthy();
    expect(alerta.querySelector('.negrito-erro')).toBeNull();
    expect(alerta.textContent?.trim()).toBe(
      'Não foi possível confirmar se a conversa foi apagada. Confira sua conexão e tente de novo.',
    );

    const botaoAcao = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;
    expect(botaoAcao.textContent?.trim()).toBe('Tentar de novo');
  }));

  it('clique fora do painel cancela e clique dentro do painel nao cancela', fakeAsync(() => {
    component.abrir();
    fixture.detectChanges();
    tick();

    const painel = el().querySelector('.painel')!;
    spyOn(painel, 'getBoundingClientRect').and.returnValue({
      left: 100,
      right: 500,
      top: 100,
      bottom: 400,
      width: 400,
      height: 300,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    const dialog = el().querySelector('dialog')!;

    dialog.dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 200, bubbles: true }));
    fixture.detectChanges();
    expect(component.aberto()).toBeTrue();

    dialog.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 50, bubbles: true }));
    fixture.detectChanges();
    expect(component.aberto()).toBeFalse();
  }));

  it('ativação do botão de confirmação via click sem coordenadas emite exatamente uma confirmação e mantém modal aberto mesmo antes de propagar input busy sem cancelou', fakeAsync(() => {
    component.abrir();
    fixture.detectChanges();
    tick();

    let confirmacoes = 0;
    component.confirmarExclusao.subscribe(() => {
      confirmacoes++;
    });

    let cancelado = false;
    component.cancelou.subscribe(() => {
      cancelado = true;
    });

    const botaoAcao = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;
    botaoAcao.click();
    fixture.detectChanges();

    expect(confirmacoes).toBe(1);
    expect(cancelado).toBeFalse();
    expect(component.aberto()).toBeTrue();
  }));

  it('ciclo normal Tab aplica preventDefault e alterna foco entre Cancelar e Apagar conversa', fakeAsync(() => {
    component.abrir();
    fixture.detectChanges();
    tick();

    const dialog = el().querySelector('dialog')!;
    const botaoCancelar = el().querySelector<HTMLButtonElement>('.botao-cancelar')!;
    const botaoAcao = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;

    expect(document.activeElement).toBe(botaoCancelar);

    const eventoTab1 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialog.dispatchEvent(eventoTab1);
    fixture.detectChanges();

    expect(eventoTab1.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(botaoAcao);

    const eventoTab2 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialog.dispatchEvent(eventoTab2);
    fixture.detectChanges();

    expect(eventoTab2.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(botaoCancelar);
  }));

  it('ciclo inverso Shift+Tab aplica preventDefault e alterna foco de forma reversa', fakeAsync(() => {
    component.abrir();
    fixture.detectChanges();
    tick();

    const dialog = el().querySelector('dialog')!;
    const botaoCancelar = el().querySelector<HTMLButtonElement>('.botao-cancelar')!;
    const botaoAcao = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;

    expect(document.activeElement).toBe(botaoCancelar);

    const eventoShiftTab1 = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    dialog.dispatchEvent(eventoShiftTab1);
    fixture.detectChanges();

    expect(eventoShiftTab1.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(botaoAcao);

    const eventoShiftTab2 = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    dialog.dispatchEvent(eventoShiftTab2);
    fixture.detectChanges();

    expect(eventoShiftTab2.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(botaoCancelar);
  }));

  it('ciclo Tab alterna entre Cancelar e Tentar de novo quando erro esta ativo', fakeAsync(() => {
    component.abrir();
    fixture.detectChanges();
    tick();

    fixture.componentRef.setInput('erro', 'confirmada');
    fixture.detectChanges();
    tick();

    const dialog = el().querySelector('dialog')!;
    const botaoCancelar = el().querySelector<HTMLButtonElement>('.botao-cancelar')!;
    const botaoAcao = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;

    expect(document.activeElement).toBe(botaoAcao);

    const eventoTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialog.dispatchEvent(eventoTab);
    fixture.detectChanges();

    expect(eventoTab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(botaoCancelar);

    const eventoShiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    dialog.dispatchEvent(eventoShiftTab);
    fixture.detectChanges();

    expect(eventoShiftTab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(botaoAcao);
  }));

  it('durante busy ignora cancelar disabled e mantem foco no unico destrutivo carregando sem disparar clique', fakeAsync(() => {
    component.abrir();
    fixture.componentRef.setInput('apagando', true);
    fixture.detectChanges();
    tick();

    const dialog = el().querySelector('dialog')!;
    const botaoCarregando = el().querySelector<HTMLButtonElement>('.botao-destrutivo.carregando')!;
    const botaoCancelar = el().querySelector<HTMLButtonElement>('.botao-cancelar')!;

    expect(botaoCancelar.disabled).toBeTrue();
    expect(document.activeElement).toBe(botaoCarregando);

    let confirmacoes = 0;
    let cancelamentos = 0;
    component.confirmarExclusao.subscribe(() => {
      confirmacoes++;
    });
    component.cancelou.subscribe(() => {
      cancelamentos++;
    });

    const eventoTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialog.dispatchEvent(eventoTab);
    fixture.detectChanges();

    expect(eventoTab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(botaoCarregando);

    const eventoShiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    dialog.dispatchEvent(eventoShiftTab);
    fixture.detectChanges();

    expect(eventoShiftTab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(botaoCarregando);

    expect(confirmacoes).toBe(0);
    expect(cancelamentos).toBe(0);
  }));

  it('mantem o foco preso no dialog impedindo que elementos do fundo recebam foco', fakeAsync(() => {
    const botaoFundo = document.createElement('button');
    botaoFundo.id = 'botao-fundo';
    document.body.appendChild(botaoFundo);

    component.abrir();
    fixture.detectChanges();
    tick();

    const dialog = el().querySelector('dialog')!;
    const botaoCancelar = el().querySelector<HTMLButtonElement>('.botao-cancelar')!;
    const botaoAcao = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;

    for (let i = 0; i < 6; i++) {
      const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      dialog.dispatchEvent(ev);
      fixture.detectChanges();
      expect(document.activeElement === botaoCancelar || document.activeElement === botaoAcao).toBeTrue();
      expect(document.activeElement).not.toBe(botaoFundo);
    }

    document.body.removeChild(botaoFundo);
  }));

  it('apos erro fecha e reabre mantendo foco inicial em Cancelar e preservando alerta, e move foco para Tentar em nova falha', fakeAsync(() => {
    component.abrir();
    fixture.detectChanges();
    tick();

    fixture.componentRef.setInput('erro', 'confirmada');
    fixture.detectChanges();
    tick();

    const botaoAcao = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;
    expect(botaoAcao.textContent?.trim()).toBe('Tentar de novo');
    expect(document.activeElement).toBe(botaoAcao);
    expect(el().querySelector('[role="alert"]')).toBeTruthy();

    component.fechar();
    fixture.detectChanges();
    tick();
    expect(component.aberto()).toBeFalse();

    component.abrir();
    fixture.detectChanges();
    tick();
    expect(component.aberto()).toBeTrue();

    const botaoCancelar = el().querySelector<HTMLButtonElement>('.botao-cancelar')!;
    expect(document.activeElement).toBe(botaoCancelar);
    expect(el().querySelector('[role="alert"]')).toBeTruthy();

    fixture.componentRef.setInput('erro', null);
    fixture.detectChanges();
    tick();

    fixture.componentRef.setInput('erro', 'confirmada');
    fixture.detectChanges();
    tick();

    const botaoAcaoNovo = el().querySelector<HTMLButtonElement>('.botao-destrutivo')!;
    expect(botaoAcaoNovo.textContent?.trim()).toBe('Tentar de novo');
    expect(document.activeElement).toBe(botaoAcaoNovo);
  }));
});
