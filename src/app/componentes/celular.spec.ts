import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Chat } from '../chat/chat';
import { SessaoResponse } from '../sessao/sessao-contrato';
import { SessaoStore } from '../sessao/sessao-store';
import { sessaoCliente, sessaoCorretor, sessaoSupervisor } from '../sessao/sessao-teste';
import { Cabecalho } from './cabecalho';

@Component({ template: '' })
class TelaFalsa {}

function regrasNoCelular(largura: number, classe: string): CSSStyleDeclaration[] {
  const seletor = new RegExp(`\\.${classe}(?![\\w-])`);
  const regras: CSSStyleDeclaration[] = [];
  for (const folha of Array.from(document.styleSheets)) {
    for (const regra of Array.from(folha.cssRules)) {
      if (
        regra instanceof CSSMediaRule &&
        regra.conditionText.replace(/\s/g, '') === `(max-width:${largura}px)`
      ) {
        for (const interna of Array.from(regra.cssRules)) {
          if (interna instanceof CSSStyleRule && seletor.test(interna.selectorText)) {
            regras.push(interna.style);
          }
        }
      }
    }
  }
  return regras;
}

describe('Celular (até 640 px)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cabecalho, Chat],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: TelaFalsa },
          { path: 'entrar', component: TelaFalsa },
          { path: 'painel', component: TelaFalsa },
        ]),
      ],
    }).compileComponents();
  });

  async function cabecalho(sessao: SessaoResponse | null, url = '/') {
    if (sessao) {
      TestBed.inject(SessaoStore).definir(sessao);
    }
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(Cabecalho);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('no login, mantém SOLAR e Lia visíveis na linha mobile, sem navegação', async () => {
    const html = await cabecalho(null, '/entrar');

    expect(html.querySelector('.marca')?.textContent).toBe('SOLAR');
    expect(html.querySelector('.identificacao')?.textContent).toBe('Lia · assistente de IA');
    expect(regrasNoCelular(640, 'identificacao').some((r) => r.display === 'inline')).toBeTrue();
    expect(regrasNoCelular(640, 'identificacao').some((r) => r.fontSize === '12px')).toBeTrue();
    expect(regrasNoCelular(640, 'navegacao').some((r) => r.display === 'none')).toBeTrue();
    expect(regrasNoCelular(640, 'abas').some((r) => r.display === 'flex')).toBeTrue();
    expect(regrasNoCelular(640, 'linha').some((r) => r.gap === '8px')).toBeTrue();
    expect(regrasNoCelular(640, 'lado-direito').some((r) => r.flexShrink === '0')).toBeTrue();
    expect(html.querySelector('.pilula-entrar')?.textContent?.trim()).toBe('Entrar');
  });

  it('visitante fica com a marca e o Entrar, sem abas', async () => {
    const html = await cabecalho(null);

    expect(html.querySelector('.marca')?.textContent).toBe('SOLAR');
    expect(html.querySelector('.pilula-entrar')).toBeTruthy();
    expect(html.querySelector('.abas')).toBeNull();
  });

  it('cliente fica com a marca e o ícone de perfil, sem abas, porque só tem o Chat', async () => {
    const html = await cabecalho(sessaoCliente());

    expect(html.querySelector('.avatar')?.textContent?.trim()).toBe('MC');
    expect(html.querySelector('.abas')).toBeNull();
  });

  for (const [papel, sessao] of [
    ['corretor', sessaoCorretor('em_analise')],
    ['supervisor', sessaoSupervisor(1)],
  ] as const) {
    it(`${papel} ganha as abas Chat e Painel abaixo da linha`, async () => {
      const html = await cabecalho(sessao, '/painel');

      const abas = Array.from(html.querySelectorAll('.abas .aba'));
      expect(abas.map((a) => a.getAttribute('href'))).toEqual(['/', '/painel']);
      expect(abas[1].classList).toContain('ativo');
    });
  }

  it('a aba ativa tem alvo de toque de 44 px', async () => {
    await cabecalho(sessaoCorretor('aprovado'));

    expect(regrasNoCelular(640, 'aba').some((r) => r.minHeight === '44px')).toBeTrue();
  });

  it('o histórico do cliente sai da coluna e abre pelo botão Conversas', () => {
    TestBed.inject(SessaoStore).definir(sessaoCliente());
    const fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();

    expect(regrasNoCelular(860, 'coluna-historico').some((r) => r.display === 'none')).toBeTrue();
    expect(regrasNoCelular(860, 'barra-conversas').some((r) => r.display === 'flex')).toBeTrue();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.botao-conversas')?.textContent?.trim(),
    ).toBe('Conversas');
  });

  it('no celular, o cliente abre a lista rolável de conversas', () => {
    TestBed.inject(SessaoStore).definir(sessaoCliente());
    const fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.botao-conversas')!.click();
    fixture.detectChanges();

    const lista = host.querySelector<HTMLElement>('.lista-historico');
    expect(lista?.querySelector('nav')?.getAttribute('aria-label')).toBe('Suas conversas');
    expect(lista?.querySelector('h2')?.textContent?.trim()).toBe('Conversas');
    expect(regrasNoCelular(860, 'barra-conversas').some((r) => r.flexShrink === '0')).toBeTrue();
    expect(regrasNoCelular(860, 'lista-historico').some((r) => r.overflow === 'hidden')).toBeTrue();
  });

  it('não mostra botão nem histórico de conversas ao corretor no celular', () => {
    TestBed.inject(SessaoStore).definir(sessaoCorretor('aprovado'));
    const fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.botao-conversas')).toBeNull();
    expect(host.querySelector('app-historico-conversas')).toBeNull();
  });

  it('o convite encurta para "Guardar esta conversa?" no celular', () => {
    TestBed.createComponent(Chat).detectChanges();

    expect(regrasNoCelular(640, 'convite-longo').some((r) => r.display === 'none')).toBeTrue();
    expect(regrasNoCelular(640, 'convite-curto').some((r) => r.display === 'inline')).toBeTrue();
  });
});
