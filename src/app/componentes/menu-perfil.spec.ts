import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SessaoResponse } from '../sessao/sessao-contrato';
import { SessaoStore } from '../sessao/sessao-store';
import {
  aplicarTema,
  limparTema,
  sessaoCliente,
  sessaoCorretor,
  sessaoSupervisor,
  TEMAS,
} from '../sessao/sessao-teste';
import { Avisos } from './aviso-flutuante';
import { MenuPerfil } from './menu-perfil';

const ERRO_POR_TEMA = { claro: 'rgb(138, 35, 24)', escuro: 'rgb(240, 163, 152)' } as const;

describe('MenuPerfil', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuPerfil],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('solar.conversaId');
    limparTema();
    document.body.querySelectorAll('app-menu-perfil').forEach((el) => el.remove());
  });

  function montar(sessao: SessaoResponse = sessaoCliente()): ComponentFixture<MenuPerfil> {
    TestBed.inject(SessaoStore).definir(sessao);
    const fixture = TestBed.createComponent(MenuPerfil);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  function html(fixture: ComponentFixture<MenuPerfil>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function abrir(fixture: ComponentFixture<MenuPerfil>): void {
    html(fixture).querySelector<HTMLButtonElement>('.gatilho')!.click();
    fixture.detectChanges();
    tick();
  }

  function itens(fixture: ComponentFixture<MenuPerfil>): HTMLElement[] {
    return Array.from(html(fixture).querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  it('fica fechado até clicar no ícone, com aria-expanded acompanhando', fakeAsync(() => {
    const fixture = montar();
    const gatilho = html(fixture).querySelector('.gatilho')!;

    expect(html(fixture).querySelector('[role="menu"]')).toBeNull();
    expect(gatilho.getAttribute('aria-expanded')).toBe('false');
    expect(gatilho.getAttribute('aria-haspopup')).toBe('menu');

    abrir(fixture);

    expect(html(fixture).querySelector('[role="menu"]')).toBeTruthy();
    expect(gatilho.getAttribute('aria-expanded')).toBe('true');
    expect(html(fixture).querySelector('.avatar')?.classList).toContain('foco');
  }));

  it('cliente vê nome completo, e-mail, Minha conta, Privacidade e dados e Sair', fakeAsync(() => {
    const fixture = montar();
    abrir(fixture);

    expect(html(fixture).querySelector('.cabecalho-menu b')?.textContent).toBe('Marina Couto');
    expect(html(fixture).querySelector('.cabecalho-menu span')?.textContent).toBe(
      'marina.couto@email.com',
    );
    expect(itens(fixture).map((i) => i.textContent?.trim())).toEqual([
      'Minha conta',
      'Privacidade e dados',
      'Sair',
    ]);
    expect(itens(fixture)[0].getAttribute('href')).toBe('/conta');
    expect(itens(fixture)[1].getAttribute('href')).toBe('/privacidade');
  }));

  for (const [sessao, descricao] of [
    [sessaoCorretor('em_analise'), 'Corretor · em análise'],
    [sessaoCorretor('aprovado'), 'Corretor · aprovado'],
    [sessaoSupervisor(), 'Supervisor'],
  ] as const) {
    it(`mostra o papel e o status no menu: ${descricao}`, fakeAsync(() => {
      const fixture = montar(sessao);
      abrir(fixture);

      expect(html(fixture).querySelector('.cabecalho-menu span')?.textContent).toBe(descricao);
    }));
  }

  it('abrir foca o primeiro item e as setas percorrem os itens em ciclo', fakeAsync(() => {
    const fixture = montar();
    abrir(fixture);
    const menu = html(fixture).querySelector('[role="menu"]')!;
    const tecla = (key: string) => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };

    expect(document.activeElement?.textContent?.trim()).toBe('Minha conta');
    tecla('ArrowDown');
    expect(document.activeElement?.textContent?.trim()).toBe('Privacidade e dados');
    tecla('End');
    expect(document.activeElement?.textContent?.trim()).toBe('Sair');
    tecla('ArrowDown');
    expect(document.activeElement?.textContent?.trim()).toBe('Minha conta');
    tecla('ArrowUp');
    expect(document.activeElement?.textContent?.trim()).toBe('Sair');
  }));

  it('seta para baixo no ícone abre o menu pelo teclado', fakeAsync(() => {
    const fixture = montar();
    html(fixture)
      .querySelector('.gatilho')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    tick();

    expect(html(fixture).querySelector('[role="menu"]')).toBeTruthy();
    expect(document.activeElement?.textContent?.trim()).toBe('Minha conta');
  }));

  it('Esc fecha o menu e devolve o foco ao ícone', fakeAsync(() => {
    const fixture = montar();
    abrir(fixture);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(html(fixture).querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(html(fixture).querySelector('.gatilho'));
  }));

  it('clique fora fecha o menu; clique dentro não', fakeAsync(() => {
    const fixture = montar();
    abrir(fixture);

    html(fixture).querySelector<HTMLElement>('.cabecalho-menu')!.click();
    fixture.detectChanges();
    expect(html(fixture).querySelector('[role="menu"]')).toBeTruthy();

    document.body.click();
    fixture.detectChanges();
    expect(html(fixture).querySelector('[role="menu"]')).toBeNull();
  }));

  it('Sair encerra a sessão, apaga a conversa do navegador e volta ao chat com o aviso', fakeAsync(() => {
    localStorage.setItem('solar.conversaId', 'conversa-da-conta');
    const navegou = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = montar();
    abrir(fixture);

    itens(fixture)[2].click();
    const req = httpMock.expectOne('/api/sessao');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(null, { status: 204, statusText: 'No Content' });
    tick();

    expect(TestBed.inject(SessaoStore).ativa()).toBeFalse();
    expect(localStorage.getItem('solar.conversaId')).toBeNull();
    expect(TestBed.inject(Avisos).atual()).toBe('Você saiu da sua conta');
    expect(navegou).toHaveBeenCalledWith(['/']);
    tick(5000);
  }));

  it('401 ao sair conta como saída concluída', fakeAsync(() => {
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = montar();
    abrir(fixture);

    itens(fixture)[2].click();
    httpMock.expectOne('/api/sessao').flush(null, { status: 401, statusText: 'Unauthorized' });
    tick();

    expect(TestBed.inject(SessaoStore).ativa()).toBeFalse();
    expect(TestBed.inject(Avisos).atual()).toBe('Você saiu da sua conta');
    tick(5000);
  }));

  for (const tema of TEMAS) {
    it(`no tema ${tema}, Sair usa a cor de erro do tema e o menu tem borda no lugar de sombra`, fakeAsync(() => {
      aplicarTema(tema);
      const fixture = montar();
      abrir(fixture);

      const menu = html(fixture).querySelector<HTMLElement>('.menu')!;
      expect(getComputedStyle(itens(fixture)[2]).color).toBe(ERRO_POR_TEMA[tema]);
      expect(getComputedStyle(menu).boxShadow).toBe('none');
      expect(getComputedStyle(menu).borderTopStyle).toBe('solid');
    }));
  }
});
