import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
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
import { Entrar } from './entrar';

const FUNDO_TRAVADO_POR_TEMA = {
  claro: 'rgb(236, 230, 220)',
  escuro: 'rgb(36, 35, 29)',
} as const;

describe('Entrar', () => {
  let httpMock: HttpTestingController;

  async function configurar(parametros: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [Entrar],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(parametros) } },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  }

  function montar(): ComponentFixture<Entrar> {
    const fixture = TestBed.createComponent(Entrar);
    fixture.detectChanges();
    return fixture;
  }

  function texto(fixture: ComponentFixture<Entrar>): string {
    return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  }

  function elemento<T extends HTMLElement>(fixture: ComponentFixture<Entrar>, seletor: string) {
    return (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
  }

  function preencher(fixture: ComponentFixture<Entrar>, senha = 'senha-correta-123') {
    fixture.componentInstance.email.set('marina.couto@email.com');
    fixture.componentInstance.senha.set(senha);
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('solar.conversaId');
    limparTema();
  });

  describe('sem token na URL', () => {
    beforeEach(async () => {
      await configurar();
    });

    it('padrão: e-mail e senha na mesma tela, sem passo de identificação', () => {
      const fixture = montar();

      expect(texto(fixture)).toContain('Entrar na Solar');
      expect(texto(fixture)).toContain(
        'Use o mesmo acesso para conversar com a Lia ou abrir seu painel.',
      );
      expect(elemento(fixture, '#campo-email')).toBeTruthy();
      expect(elemento(fixture, '#campo-senha')).toBeTruthy();
      expect(texto(fixture)).toContain('Esqueci minha senha');
      expect(texto(fixture)).toContain('Ainda não tem conta? Cadastre-se');
      expect(texto(fixture)).toContain('É corretor de imóveis?');
      expect(texto(fixture)).not.toContain('ainda sem conta');
      expect(elemento(fixture, '.divisor')).toBeNull();
      expect(texto(fixture)).not.toContain('Não encontramos esse e-mail');
      expect(elemento<HTMLButtonElement>(fixture, '.botao-primario')?.disabled).toBeTrue();
      httpMock.expectNone(() => true);
    });

    it('dentro do cartão, depois do Entrar, fica só a linha "Ainda não tem conta? Cadastre-se"', () => {
      const fixture = montar();
      const linha = elemento(fixture, '.cartao .sem-conta')!;
      const link = linha.querySelector('a')!;

      expect(linha.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Ainda não tem conta? Cadastre-se',
      );
      expect(link.getAttribute('href')).toBe('/cadastro');
      expect(getComputedStyle(link).fontWeight).toBe('600');
      expect(getComputedStyle(linha).justifyContent).toBe('center');
      expect(parseFloat(getComputedStyle(linha).minHeight)).toBeGreaterThanOrEqual(44);
      expect(elemento(fixture, '.botao-primario')!.nextElementSibling).toBe(linha);
      expect(elemento(fixture, '.cartao')!.querySelectorAll('a').length).toBe(1);
      expect(linha.textContent).not.toContain('para conversar');
    });

    it('fora e abaixo do cartão, a faixa inteira é um link para /seja-corretor', () => {
      const fixture = montar();
      const faixa = elemento<HTMLAnchorElement>(fixture, '.faixa-corretor')!;
      const estilo = getComputedStyle(faixa);

      expect(faixa.closest('.cartao')).toBeNull();
      expect(elemento(fixture, '.cartao')!.nextElementSibling).toBe(faixa);
      expect(faixa.getAttribute('href')).toBe('/seja-corretor');
      expect(faixa.querySelector('.faixa-titulo')?.textContent).toBe('É corretor de imóveis?');
      expect(faixa.querySelector('.faixa-apoio')?.textContent).toBe(
        'Receba leads que a Lia já qualificou, na sua região e especialidade.',
      );
      expect(faixa.querySelector('.faixa-chamada')?.textContent).toBe('Venha para a Solar →');
      expect(estilo.borderTopStyle).toBe('none');
      expect(estilo.borderTopLeftRadius).toBe('12px');
      expect(estilo.padding).toBe('18px 20px');
      expect(getComputedStyle(elemento(fixture, '.tela-entrar')!).rowGap).toBe('16px');
      expect(faixa.getBoundingClientRect().width).toBe(
        elemento(fixture, '.cartao')!.getBoundingClientRect().width,
      );
      expect(getComputedStyle(faixa.querySelector('.faixa-titulo')!).fontSize).toBe('15px');
      expect(getComputedStyle(faixa.querySelector('.faixa-titulo')!).fontWeight).toBe('600');
      expect(getComputedStyle(faixa.querySelector('.faixa-apoio')!).fontSize).toBe('13px');
      expect(getComputedStyle(faixa.querySelector('.faixa-chamada')!).fontSize).toBe('14px');
    });

    it('no celular a chamada da faixa desce para baixo do texto', () => {
      montar();
      const regra = Array.from(document.styleSheets)
        .flatMap((folha) => Array.from(folha.cssRules))
        .filter(
          (r): r is CSSMediaRule =>
            r instanceof CSSMediaRule && r.conditionText.replace(/\s/g, '') === '(max-width:640px)',
        )
        .flatMap((r) => Array.from(r.cssRules))
        .find(
          (r): r is CSSStyleRule =>
            r instanceof CSSStyleRule && /\.faixa-corretor(?![\w-])/.test(r.selectorText),
        );

      expect(regra?.style.flexDirection).toBe('column');
    });

    it('a faixa some nas telas de redefinir senha', () => {
      const fixture = montar();
      fixture.componentInstance.irParaRecuperacao();
      fixture.detectChanges();

      expect(elemento(fixture, '.faixa-corretor')).toBeNull();
      expect(elemento(fixture, '.sem-conta')).toBeNull();
    });

    it('os rótulos de campo do login e da recuperação usam IBM Plex Mono com peso 600', () => {
      const fixture = montar();
      const pesos = () =>
        Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.rotulo')).map(
          (r) => getComputedStyle(r).fontWeight,
        );
      expect(pesos()).toEqual(['600', '600']);
      const rotulo = elemento(fixture, '.rotulo')!;
      expect(getComputedStyle(rotulo).fontFamily).toContain('IBM Plex Mono');
      expect(getComputedStyle(rotulo).fontSize).toBe('10px');
      expect(getComputedStyle(rotulo).textTransform).toBe('uppercase');

      fixture.componentInstance.irParaRecuperacao();
      fixture.detectChanges();
      expect(pesos()).toEqual(['600']);
    });

    it('Mostrar alterna a senha entre oculta e visível', () => {
      const fixture = montar();
      const campo = elemento<HTMLInputElement>(fixture, '#campo-senha')!;
      expect(campo.type).toBe('password');

      elemento<HTMLButtonElement>(fixture, '.acao-campo')!.click();
      fixture.detectChanges();

      expect(campo.type).toBe('text');
      expect(elemento(fixture, '.acao-campo')?.textContent?.trim()).toBe('Ocultar');
    });

    it('sem conversa guardada no navegador, o aviso da conversa não aparece e o corpo não leva conversaId', () => {
      const fixture = montar();
      expect(texto(fixture)).not.toContain('A conversa que você começou com a Lia');

      preencher(fixture);
      fixture.componentInstance.entrar();

      const req = httpMock.expectOne('/api/sessoes');
      expect(req.request.body).toEqual({
        email: 'marina.couto@email.com',
        senha: 'senha-correta-123',
      });
      req.flush(sessaoCliente());
    });

    it('com conversa sem dono no navegador, mostra o aviso e manda o conversaId no login', () => {
      localStorage.setItem('solar.conversaId', 'conversa-anonima-1');
      const fixture = montar();

      expect(elemento(fixture, '.alerta.info')?.textContent?.trim()).toBe(
        'A conversa que você começou com a Lia fica salva na sua conta.',
      );

      preencher(fixture);
      fixture.componentInstance.entrar();

      const req = httpMock.expectOne('/api/sessoes');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.body.conversaId).toBe('conversa-anonima-1');
      req.flush(sessaoCliente());
    });

    it('carregando: campos travados, giro no botão e saídas apagadas', async () => {
      const fixture = montar();
      preencher(fixture);
      fixture.componentInstance.entrar();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(elemento<HTMLInputElement>(fixture, '#campo-email')?.disabled).toBeTrue();
      expect(elemento<HTMLInputElement>(fixture, '#campo-senha')?.disabled).toBeTrue();
      expect(elemento(fixture, '.botao-primario .verificando')?.getAttribute('aria-label')).toBe(
        'Entrando',
      );
      expect(elemento(fixture, '.sem-conta')?.classList).toContain('apagado');
      expect(elemento(fixture, '.faixa-corretor')?.classList).toContain('apagado');
      expect(elemento(fixture, '.faixa-corretor')?.getAttribute('tabindex')).toBe('-1');

      httpMock.expectOne('/api/sessoes').flush(sessaoCliente());
    });

    it('cliente volta ao chat depois de entrar', () => {
      const navegou = spyOn(TestBed.inject(Router), 'navigate');
      const fixture = montar();
      preencher(fixture);
      fixture.componentInstance.entrar();
      httpMock.expectOne('/api/sessoes').flush(sessaoCliente());

      expect(TestBed.inject(SessaoStore).perfil()).toBe('cliente');
      expect(navegou).toHaveBeenCalledWith(['/']);
    });

    for (const [papel, sessao] of [
      ['corretor', sessaoCorretor('em_analise')],
      ['supervisor', sessaoSupervisor()],
    ] as const) {
      it(`${papel} vai ao painel depois de entrar`, () => {
        const navegou = spyOn(TestBed.inject(Router), 'navigate');
        const fixture = montar();
        preencher(fixture);
        fixture.componentInstance.entrar();
        httpMock.expectOne('/api/sessoes').flush(sessao);

        const store = TestBed.inject(SessaoStore);
        expect(store.perfil()).toBe(papel);
        expect(store.usuario()).toEqual(sessao.usuario);
        expect(navegou).toHaveBeenCalledWith(['/painel']);
      });
    }

    it('erro: a mesma mensagem para qualquer credencial errada, apaga a senha e mantém o e-mail', () => {
      const fixture = montar();
      preencher(fixture, 'errada');
      fixture.componentInstance.entrar();
      httpMock
        .expectOne('/api/sessoes')
        .flush(
          { codigo: 'credenciais_invalidas', mensagem: 'x' },
          { status: 401, statusText: 'Unauthorized' },
        );
      fixture.detectChanges();

      expect(texto(fixture)).toContain('E-mail ou senha incorretos. Confira e tente de novo.');
      expect(texto(fixture)).not.toContain('Restam');
      expect(fixture.componentInstance.senha()).toBe('');
      expect(fixture.componentInstance.email()).toBe('marina.couto@email.com');
      expect(elemento(fixture, '#campo-email')?.classList).toContain('com-erro');
      expect(elemento(fixture, '#campo-senha')?.classList).toContain('com-erro');
      expect(elemento<HTMLButtonElement>(fixture, '.botao-primario')?.disabled).toBeTrue();
    });

    it('bloqueado: usa segundosRestantes, conta para trás em mm:ss e libera sozinho', fakeAsync(() => {
      const fixture = montar();
      preencher(fixture, 'quinta tentativa');
      fixture.componentInstance.entrar();
      httpMock
        .expectOne('/api/sessoes')
        .flush(
          { codigo: 'bloqueado', segundosRestantes: 292 },
          { status: 423, statusText: 'Locked' },
        );
      fixture.detectChanges();
      tick();

      expect(texto(fixture)).toContain(
        'Muitas tentativas seguidas. Tente de novo em 04:52 ou redefina a senha.',
      );
      const senha = elemento<HTMLInputElement>(fixture, '#campo-senha')!;
      expect(senha.disabled).toBeTrue();
      expect(senha.placeholder).toBe('Bloqueado temporariamente');
      expect(elemento<HTMLButtonElement>(fixture, '.botao-primario')?.disabled).toBeTrue();
      expect(elemento(fixture, '.botao-secundario')?.textContent?.trim()).toBe('Redefinir senha');

      tick(2000);
      fixture.detectChanges();
      expect(texto(fixture)).toContain('04:50');

      tick(290000);
      fixture.detectChanges();
      expect(fixture.componentInstance.bloqueado()).toBeFalse();
      expect(texto(fixture)).not.toContain('Muitas tentativas seguidas');
    }));

    it('Redefinir senha no bloqueio abre o pedido de link', fakeAsync(() => {
      const fixture = montar();
      preencher(fixture);
      fixture.componentInstance.entrar();
      httpMock
        .expectOne('/api/sessoes')
        .flush(
          { codigo: 'bloqueado', segundosRestantes: 60 },
          { status: 423, statusText: 'Locked' },
        );
      fixture.detectChanges();

      expect(elemento(fixture, '.sem-conta')).toBeNull();
      expect(elemento(fixture, '.faixa-corretor')).toBeTruthy();

      elemento<HTMLButtonElement>(fixture, '.botao-secundario')!.click();
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Redefinir senha');
      expect(fixture.componentInstance.bloqueado()).toBeFalse();
    }));

    it('pede o link de redefinição no caminho novo, sem revelar se o e-mail existe', fakeAsync(() => {
      const fixture = montar();
      fixture.componentInstance.email.set('marina.couto@email.com');
      fixture.componentInstance.irParaRecuperacao();
      fixture.detectChanges();
      tick();

      expect(texto(fixture)).toContain('← Voltar para o login');
      expect(elemento<HTMLInputElement>(fixture, '#campo-email-recuperacao')?.value).toBe(
        'marina.couto@email.com',
      );

      fixture.componentInstance.enviarLink();
      const req = httpMock.expectOne('/api/senha/recuperacoes');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'marina.couto@email.com' });
      req.flush('nao encontrado', { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Verifique seu e-mail');
      expect(texto(fixture)).toContain('O link expira em 30 minutos.');
    }));

    it('429 no pedido de link não finge que o link foi enviado', () => {
      const fixture = montar();
      fixture.componentInstance.email.set('marina.couto@email.com');
      fixture.componentInstance.irParaRecuperacao();
      fixture.componentInstance.enviarLink();
      httpMock
        .expectOne('/api/senha/recuperacoes')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });
      fixture.detectChanges();

      expect(texto(fixture)).not.toContain('Verifique seu e-mail');
      expect(texto(fixture)).toContain('Muitos pedidos seguidos.');
    });

    it('Voltar para o login retorna à tela única', () => {
      const fixture = montar();
      fixture.componentInstance.irParaRecuperacao();
      fixture.detectChanges();
      fixture.componentInstance.voltarParaLogin();
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Entrar na Solar');
    });

    for (const tema of TEMAS) {
      it(`no tema ${tema}, o botão Entrar habilitado usa a cor de ação do tema`, () => {
        aplicarTema(tema);
        const fixture = montar();
        preencher(fixture);

        const botao = elemento<HTMLButtonElement>(fixture, '.botao-primario')!;
        expect(botao.disabled).toBeFalse();
        expect(getComputedStyle(botao).backgroundColor).toBe(MARCA_POR_TEMA[tema]);
      });

      it(`no tema ${tema}, a faixa usa o fundo travado e a chamada usa a cor de ação`, () => {
        aplicarTema(tema);
        const fixture = montar();
        const faixa = elemento(fixture, '.faixa-corretor')!;

        expect(getComputedStyle(faixa).backgroundColor).toBe(FUNDO_TRAVADO_POR_TEMA[tema]);
        expect(getComputedStyle(faixa.querySelector('.faixa-chamada')!).color).toBe(
          MARCA_POR_TEMA[tema],
        );
        expect(getComputedStyle(elemento(fixture, '.sem-conta a')!).color).toBe(
          MARCA_POR_TEMA[tema],
        );
      });
    }
  });

  it('?redefinir abre direto o pedido de link', async () => {
    await configurar({ redefinir: '1' });
    const fixture = montar();

    expect(texto(fixture)).toContain('Informe seu e-mail. Enviaremos um link');
  });

  describe('com token de redefinição na URL', () => {
    it('valida o token e salva a nova senha no caminho novo, levando cada papel ao seu destino', async () => {
      await configurar({ token: 'token-valido-123' });
      const fixture = montar();

      httpMock
        .expectOne('/api/senha/recuperacoes/token-valido-123')
        .flush({ email: 'marina.couto@email.com' });
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Crie uma nova senha');
      expect(texto(fixture)).toContain('Ao salvar, você já entra na sua conta.');

      const navegou = spyOn(TestBed.inject(Router), 'navigate');
      fixture.componentInstance.novaSenha.set('senha-nova-forte');
      fixture.componentInstance.confirmacaoSenha.set('senha-nova-forte');
      fixture.componentInstance.salvarSenha();

      const req = httpMock.expectOne('/api/senha');
      expect(req.request.body).toEqual({
        token: 'token-valido-123',
        novaSenha: 'senha-nova-forte',
      });
      req.flush(sessaoCliente());

      expect(TestBed.inject(SessaoStore).perfil()).toBe('cliente');
      expect(navegou).toHaveBeenCalledWith(['/']);
    });

    it('desabilita Salvar e acusa divergência só na confirmação', async () => {
      await configurar({ token: 'token-valido-123' });
      const fixture = montar();
      httpMock
        .expectOne('/api/senha/recuperacoes/token-valido-123')
        .flush({ email: 'marina.couto@email.com' });
      fixture.detectChanges();

      fixture.componentInstance.novaSenha.set('senha-nova-forte');
      fixture.componentInstance.confirmacaoSenha.set('senha-diferente');
      fixture.detectChanges();

      expect(texto(fixture)).toContain('As senhas não coincidem.');
      expect(elemento(fixture, '#campo-confirmacao')?.classList).toContain('com-erro');
      expect(elemento<HTMLButtonElement>(fixture, '.botao-primario')?.disabled).toBeTrue();
      httpMock.expectNone('/api/senha');
    });

    it('link expirado ou usado troca o formulário pela tela de link inválido', async () => {
      await configurar({ token: 'token-queimado' });
      const fixture = montar();
      httpMock
        .expectOne('/api/senha/recuperacoes/token-queimado')
        .flush('expirado', { status: 410, statusText: 'Gone' });
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Este link não é mais válido');
      expect(elemento(fixture, '#campo-nova-senha')).toBeNull();

      fixture.componentInstance.pedirNovoLink();
      fixture.detectChanges();
      expect(elemento<HTMLInputElement>(fixture, '#campo-email-recuperacao')?.value).toBe('');
    });
  });
});
