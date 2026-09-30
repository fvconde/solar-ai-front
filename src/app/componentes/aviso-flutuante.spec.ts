import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvisoFlutuante, Avisos } from './aviso-flutuante';

describe('AvisoFlutuante', () => {
  let fixture: ComponentFixture<AvisoFlutuante>;
  let chat: HTMLElement;
  let campo: HTMLTextAreaElement;

  function elementoRegiao(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.regiao')!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AvisoFlutuante] }).compileComponents();
    fixture = TestBed.createComponent(AvisoFlutuante);

    chat = document.createElement('app-chat');
    const composer = document.createElement('app-composer');
    campo = document.createElement('textarea');
    campo.setAttribute('aria-label', 'Escreva sua mensagem');
    composer.append(campo);
    chat.append(composer);
    document.body.append(chat);
  });

  afterEach(() => {
    TestBed.inject(Avisos).fechar();
    chat.remove();
  });

  it('centraliza o aviso sobre o campo e mantém uma folga curta', async () => {
    const topoCampo = window.innerHeight - 120;
    spyOn(campo, 'getBoundingClientRect').and.returnValue({
      left: 740,
      right: 868,
      top: topoCampo,
      bottom: topoCampo + 52,
      width: 128,
      height: 52,
      x: 740,
      y: 760,
      toJSON: () => ({}),
    });
    TestBed.inject(Avisos).mostrar('Conta criada. Esta conversa já está salva.', 'composer');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const regiao = elementoRegiao();
    expect(regiao.style.left).toBe('804px');
    expect(regiao.style.bottom).toBe('132px');
    expect(regiao.classList.contains('ancorada')).toBeTrue();
    expect(regiao.getAttribute('role')).toBe('status');
    expect(regiao.getAttribute('aria-live')).toBe('polite');
  });

  it('acompanha a posição do campo após redimensionar a tela', async () => {
    const retangulo = jasmine.createSpy('getBoundingClientRect');
    retangulo.and.returnValue({
      left: 24,
      right: 244,
      top: 640,
      bottom: 688,
      width: 220,
      height: 48,
      x: 24,
      y: 640,
      toJSON: () => ({}),
    });
    spyOn(campo, 'getBoundingClientRect').and.callFake(() => retangulo());
    TestBed.inject(Avisos).mostrar('Conta criada. Você já está dentro.', 'composer');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(elementoRegiao().style.left).toBe('134px');

    retangulo.and.returnValue({
      left: 16,
      right: 304,
      top: 620,
      bottom: 668,
      width: 288,
      height: 48,
      x: 16,
      y: 620,
      toJSON: () => ({}),
    });
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(elementoRegiao().style.left).toBe('160px');
  });

  it('mantém os outros avisos na posição global atual', () => {
    TestBed.inject(Avisos).mostrar('Outro aviso.');
    fixture.detectChanges();

    const regiao = elementoRegiao();
    expect(regiao.classList.contains('ancorada')).toBeFalse();
    expect(regiao.style.left).toBe('');
    expect(regiao.style.bottom).toBe('');
  });
});
