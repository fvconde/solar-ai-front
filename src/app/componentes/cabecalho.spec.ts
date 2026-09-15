import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Cabecalho } from './cabecalho';

@Component({ template: '' })
class TelaFalsa {}

describe('Cabecalho', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cabecalho],
      providers: [
        provideRouter([
          { path: '', component: TelaFalsa },
          { path: 'entrar', component: TelaFalsa },
          { path: 'painel', component: TelaFalsa },
          { path: 'privacidade', component: TelaFalsa },
        ]),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  async function montarEm(url: string) {
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(Cabecalho);
    fixture.detectChanges();
    return fixture;
  }

  function linkPainel(fixture: { nativeElement: unknown }): HTMLElement | null {
    const html = fixture.nativeElement as HTMLElement;
    return (
      Array.from(html.querySelectorAll<HTMLElement>('.link-nav')).find((a) =>
        a.textContent?.includes('Painel do Corretor')
      ) ?? null
    );
  }

  function linkChat(fixture: { nativeElement: unknown }): HTMLElement | null {
    const html = fixture.nativeElement as HTMLElement;
    return (
      Array.from(html.querySelectorAll<HTMLElement>('.link-nav')).find(
        (a) => a.textContent?.trim() === 'Chat'
      ) ?? null
    );
  }

  it('marca Painel do Corretor como ativo na tela de login, como no handoff', async () => {
    const fixture = await montarEm('/entrar');

    expect(linkPainel(fixture)?.classList).toContain('ativo');
    expect(linkChat(fixture)?.classList).not.toContain('ativo');
  });

  it('mantém Painel do Corretor ativo no fluxo de nova senha vindo do e-mail', async () => {
    const fixture = await montarEm('/entrar?token=abc123');

    expect(linkPainel(fixture)?.classList).toContain('ativo');
  });

  it('mantém Painel do Corretor ativo dentro do painel', async () => {
    const fixture = await montarEm('/painel');

    expect(linkPainel(fixture)?.classList).toContain('ativo');
    expect(linkChat(fixture)?.classList).not.toContain('ativo');
  });

  it('não marca o painel quando o corretor está no chat', async () => {
    const fixture = await montarEm('/');

    expect(linkPainel(fixture)?.classList).not.toContain('ativo');
    expect(linkChat(fixture)?.classList).toContain('ativo');
  });

  it('mantém Chat ativo na política de privacidade, que se abre a partir do chat', async () => {
    const fixture = await montarEm('/privacidade');

    expect(linkChat(fixture)?.classList).toContain('ativo');
    expect(linkPainel(fixture)?.classList).not.toContain('ativo');
  });

  it('sempre marca exatamente uma aba', async () => {
    for (const rota of ['/', '/privacidade', '/entrar', '/entrar?token=abc', '/painel']) {
      const fixture = await montarEm(rota);
      const ativos = (fixture.nativeElement as HTMLElement).querySelectorAll('.link-nav.ativo');
      expect(ativos.length)
        .withContext(`rota ${rota}`)
        .toBe(1);
    }
  });
});
