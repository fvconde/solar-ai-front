import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SessaoResponse } from '../sessao/sessao-contrato';
import { SessaoStore } from '../sessao/sessao-store';
import {
  aplicarTema,
  limparTema,
  MARCA_POR_TEMA,
  sessaoCliente,
  sessaoCorretor,
  sessaoSupervisor,
  TEMAS,
} from '../sessao/sessao-teste';
import { Cabecalho } from './cabecalho';

@Component({ template: '' })
class TelaFalsa {}

describe('Cabecalho', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cabecalho],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          ['', 'entrar', 'cadastro', 'seja-corretor', 'painel', 'privacidade', 'conta'].map(
            (path) => ({ path, component: TelaFalsa }),
          ),
        ),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  afterEach(() => limparTema());

  async function montarEm(url: string, sessao: SessaoResponse | null = null) {
    if (sessao) {
      TestBed.inject(SessaoStore).definir(sessao);
    }
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(Cabecalho);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function links(html: HTMLElement): string[] {
    return Array.from(html.querySelectorAll('.navegacao .link-nav')).map(
      (a) => a.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  function ativos(html: HTMLElement): string[] {
    return Array.from(html.querySelectorAll('.navegacao .link-nav.ativo')).map(
      (a) => a.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  it('visitante no chat vê Chat ativo e o botão Entrar, sem Painel do Corretor', async () => {
    const html = await montarEm('/');

    expect(links(html)).toEqual(['Chat']);
    expect(ativos(html)).toEqual(['Chat']);
    expect(html.querySelector('.pilula-entrar')?.textContent?.trim()).toBe('Entrar');
    expect(html.querySelector('.identificacao')?.textContent).toBe('Lia · assistente de IA');
    expect(html.querySelector('.avatar')).toBeNull();
  });

  for (const rota of ['/entrar', '/entrar?token=abc', '/cadastro', '/seja-corretor']) {
    it(`em ${rota} nenhum link fica ativo e o Entrar continua visível`, async () => {
      const html = await montarEm(rota);

      expect(ativos(html)).toEqual([]);
      expect(html.querySelector('.pilula-entrar')).toBeTruthy();
    });
  }

  it('cliente vê Chat, o primeiro nome e as iniciais, sem Entrar nem Painel', async () => {
    const html = await montarEm('/', sessaoCliente());

    expect(links(html)).toEqual(['Chat']);
    expect(ativos(html)).toEqual(['Chat']);
    expect(html.querySelector('.nome-usuario')?.textContent).toBe('Marina');
    expect(html.querySelector('.avatar')?.textContent?.trim()).toBe('MC');
    expect(html.querySelector('.pilula-entrar')).toBeNull();
    expect(html.querySelector('.abas')).toBeNull();
  });

  it('corretor em análise vê Painel do Corretor com o selo "em análise"', async () => {
    const html = await montarEm('/painel', sessaoCorretor('em_analise'));

    expect(html.querySelector('.identificacao')?.textContent).toBe('Painel');
    expect(links(html)).toEqual(['Chat', 'Painel do Corretor em análise']);
    expect(ativos(html)).toEqual(['Painel do Corretor em análise']);
    expect(html.querySelector('.navegacao .selo')?.classList).not.toContain('neutro');
    expect(html.querySelector('.nome-usuario')?.textContent).toBe('Rafael');
    expect(html.querySelector('.avatar')?.textContent?.trim()).toBe('RN');
  });

  it('corretor aprovado vê Painel do Corretor sem selo', async () => {
    const html = await montarEm('/painel', sessaoCorretor('aprovado'));

    expect(links(html)).toEqual(['Chat', 'Painel do Corretor']);
    expect(html.querySelector('.selo')).toBeNull();
  });

  it('supervisor vê o selo com pendentesAprovacao, no singular e no plural', async () => {
    let html = await montarEm('/painel', sessaoSupervisor(2));
    expect(html.querySelector('.navegacao .selo')?.textContent).toBe('2 novos');
    expect(html.querySelector('.navegacao .selo')?.classList).toContain('neutro');

    const sessao = TestBed.inject(SessaoStore);
    sessao.descontarPendente();
    html = await montarEm('/painel');
    expect(html.querySelector('.navegacao .selo')?.textContent).toBe('1 novo');

    sessao.descontarPendente();
    html = await montarEm('/painel');
    expect(html.querySelector('.selo')).toBeNull();
  });

  it('o cabeçalho troca pelo papel, não pela rota: o corretor vê "Painel" também no chat', async () => {
    const html = await montarEm('/', sessaoCorretor('aprovado'));

    expect(html.querySelector('.identificacao')?.textContent).toBe('Painel');
    expect(ativos(html)).toEqual(['Chat']);
  });

  it('em /conta nenhum link fica ativo', async () => {
    const html = await montarEm('/conta', sessaoCorretor('aprovado'));

    expect(ativos(html)).toEqual([]);
  });

  it('mantém Chat ativo na política de privacidade, que se abre a partir do chat', async () => {
    const html = await montarEm('/privacidade');

    expect(ativos(html)).toEqual(['Chat']);
  });

  it('quem tem as duas páginas ganha as abas Chat e Painel para o celular', async () => {
    const html = await montarEm('/painel', sessaoCorretor('em_analise'));
    const abas = Array.from(html.querySelectorAll('.abas .aba')).map((a) =>
      a.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(abas).toEqual(['Chat', 'Painel análise']);
    expect(html.querySelector('.abas .aba.ativo')?.textContent).toContain('Painel');
  });

  for (const tema of TEMAS) {
    it(`no tema ${tema}, o Entrar e o link ativo usam a cor de marca do tema`, async () => {
      aplicarTema(tema);
      const html = await montarEm('/');

      const entrar = html.querySelector<HTMLElement>('.pilula-entrar')!;
      const chat = html.querySelector<HTMLElement>('.link-nav.ativo')!;
      expect(getComputedStyle(entrar).backgroundColor).toBe(MARCA_POR_TEMA[tema]);
      expect(getComputedStyle(chat).color).toBe(MARCA_POR_TEMA[tema]);
    });
  }
});
