import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImovelSugerido } from '../conversa/contrato';
import { MensagemLia } from './mensagem-lia';

const IMOVEL: ImovelSugerido = {
  id: 'i1',
  tipo: 'apartamento',
  bairro: 'Casa Verde',
  quartos: 3,
  metragem: 88,
  precoVenda: 580000,
  precoAluguel: null,
  motivo: 'Fica abaixo do teto e tem os tres quartos.',
};

describe('MensagemLia', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MensagemLia] }).compileComponents();
  });

  function montar(texto: string, revelar: boolean, imoveis: ImovelSugerido[] = []) {
    const fixture = TestBed.createComponent(MensagemLia);
    fixture.componentRef.setInput('texto', texto);
    fixture.componentRef.setInput('hora', '14:32');
    fixture.componentRef.setInput('revelar', revelar);
    fixture.componentRef.setInput('imoveis', imoveis);
    fixture.detectChanges();
    return fixture;
  }

  function fala(fixture: ComponentFixture<MensagemLia>): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('p.fala')!;
  }

  it('poe a fala que chega ao vivo sob o veu', () => {
    expect(fala(montar('Oi, tudo bem?', true)).classList).toContain('sob-veu');
  });

  it('deixa o historico entrar sem veu', () => {
    expect(fala(montar('Oi, tudo bem?', false)).classList).not.toContain('sob-veu');
  });

  it('da ao veu um tempo proporcional ao tamanho da fala', () => {
    const texto = 'a'.repeat(150);
    expect(fala(montar(texto, true)).style.animationDuration).toBe('1950ms');
  });

  it('segura o veu num minimo para fala curta e num maximo para fala longa', () => {
    expect(fala(montar('Claro.', true)).style.animationDuration).toBe('900ms');
    expect(fala(montar('a'.repeat(1000), true)).style.animationDuration).toBe('2800ms');
  });

  it('tira o veu quando a animacao termina', () => {
    const fixture = montar('Oi, tudo bem?', true);
    fala(fixture).dispatchEvent(new AnimationEvent('animationend'));
    fixture.detectChanges();

    expect(fala(fixture).classList).not.toContain('sob-veu');
  });

  it('solta os cartoes depois do veu, um atras do outro', () => {
    const fixture = montar('a'.repeat(150), true, [
      IMOVEL,
      { ...IMOVEL, id: 'i2' },
      { ...IMOVEL, id: 'i3' },
    ]);
    const cartoes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('app-card-imovel'),
    );

    expect(cartoes.map((cartao) => cartao.style.animationDelay)).toEqual([
      '2370ms',
      '2610ms',
      '2850ms',
    ]);
    expect(cartoes.every((cartao) => cartao.classList.contains('entrando'))).toBeTrue();
  });

  it('nao anima os cartoes do historico', () => {
    const fixture = montar('a'.repeat(150), false, [IMOVEL]);
    const cartao = (fixture.nativeElement as HTMLElement).querySelector('app-card-imovel')!;

    expect(cartao.classList).not.toContain('entrando');
  });
});
