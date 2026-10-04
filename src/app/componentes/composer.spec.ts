import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Composer } from './composer';

describe('Composer', () => {
  let fixture: ComponentFixture<Composer>;
  let component: Composer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Composer],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Composer);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('envioDisponivel', true);
    fixture.componentRef.setInput('campoEditavel', true);
    fixture.detectChanges();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('exibe rodape com link de privacidade e oculta botao apagar quando podeApagar for false', () => {
    fixture.componentRef.setInput('podeApagar', false);
    fixture.detectChanges();

    const nav = el().querySelector('nav[aria-label="Seus dados"]');
    expect(nav).toBeTruthy();

    const link = nav?.querySelector('a');
    expect(link?.textContent?.trim()).toBe('Como a Solar usa seus dados');
    expect(link?.getAttribute('href')).toBe('/privacidade');

    const botaoApagar = nav?.querySelector('.botao-apagar');
    expect(botaoApagar).toBeNull();
  });

  it('exibe botao apagar com aria-haspopup quando podeApagar for true e emite evento ao clicar', () => {
    fixture.componentRef.setInput('podeApagar', true);
    fixture.detectChanges();

    const nav = el().querySelector('nav[aria-label="Seus dados"]');
    const botaoApagar = nav?.querySelector<HTMLButtonElement>('.botao-apagar');
    expect(botaoApagar).toBeTruthy();
    expect(botaoApagar?.textContent?.trim()).toBe('Apagar conversa');
    expect(botaoApagar?.getAttribute('aria-haspopup')).toBe('dialog');

    let emitido: HTMLElement | undefined;
    component.apagar.subscribe((elemento) => {
      emitido = elemento;
    });

    botaoApagar?.click();
    expect(emitido).toBe(botaoApagar);
  });

  it('quando recolhido for true oculta campo e botao enviar mas mantem rodape acessivel', () => {
    fixture.componentRef.setInput('recolhido', true);
    fixture.componentRef.setInput('podeApagar', true);
    fixture.detectChanges();

    expect(el().querySelector('textarea')).toBeNull();
    expect(el().querySelector('.enviar')).toBeNull();
    expect(el().querySelector('nav[aria-label="Seus dados"]')).toBeTruthy();
    expect(el().querySelector('.botao-apagar')).toBeTruthy();
  });

  it('limpar reseta texto e altura do campo sem focar o elemento', () => {
    const textarea = el().querySelector('textarea')!;
    textarea.value = 'Rascunho de teste';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(textarea.value).toBe('Rascunho de teste');

    component.limpar();
    fixture.detectChanges();

    expect(textarea.value).toBe('');
    expect(document.activeElement).not.toBe(textarea);
  });
});
