import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { SessaoStore } from '../sessao/sessao-store';
import { Entrar } from './entrar';
import { CorretorSessao } from './entrar-contrato';

describe('Entrar', () => {
  let httpMock: HttpTestingController;

  const corretor: CorretorSessao = {
    id: '3f6b9c21-4d0a-4c7e-9a11-000000000001',
    nome: 'Helena Braga',
    especialidade: 'moradia',
  };

  async function configurar(token: string | null = null) {
    await TestBed.configureTestingModule({
      imports: [Entrar],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  }

  function texto(fixture: ComponentFixture<Entrar>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function irParaSenha(fixture: ComponentFixture<Entrar>, email = 'renata.costa@solar.com.br') {
    fixture.componentInstance.email.set(email);
    fixture.componentInstance.continuarComEmail();
    httpMock.expectOne('/painel/identificacao').flush({ cadastrado: true });
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  describe('sem token na URL', () => {
    beforeEach(async () => {
      await configurar();
    });

    it('Tela 1 abre pedindo só o e-mail, sem campo de senha e com Continuar desabilitado', () => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();

      const html = fixture.nativeElement as HTMLElement;
      expect(texto(fixture)).toContain('Entre ou cadastre-se');
      expect(html.querySelector('#campo-email')).toBeTruthy();
      expect(html.querySelector('#campo-senha')).toBeNull();
      expect(html.querySelector<HTMLButtonElement>('.botao-primario')?.disabled).toBeTrue();
      httpMock.expectNone('/painel/identificacao');
    });

    it('e-mail mal formatado mostra a mensagem do handoff sem chamar a API', () => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();

      fixture.componentInstance.email.set('renata.costa@');
      fixture.componentInstance.continuarComEmail();
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Verifique o formato do e-mail.');
      httpMock.expectNone('/painel/identificacao');
    });

    it('Tela 2 aparece para e-mail cadastrado, com e-mail travado e link Trocar', () => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();
      irParaSenha(fixture);

      const html = fixture.nativeElement as HTMLElement;
      expect(texto(fixture)).toContain('Que bom ver você de novo');
      expect(texto(fixture)).toContain('Encontramos seu cadastro. Digite sua senha para entrar na fila.');
      expect(html.querySelector('.campo-travado')?.textContent).toContain(
        'renata.costa@solar.com.br'
      );
      expect(html.querySelector('#campo-senha')).toBeTruthy();
      expect(texto(fixture)).toContain('Esqueci minha senha');
    });

    it('Tela 3 aparece para e-mail não cadastrado, sem autocadastro', () => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();

      fixture.componentInstance.email.set('diego.freitas@imoveis.com');
      fixture.componentInstance.continuarComEmail();
      httpMock.expectOne('/painel/identificacao').flush({ cadastrado: false });
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Não encontramos esse e-mail');
      expect(texto(fixture)).toContain('Um dos nossos especialistas vai entrar em contato');
      expect(texto(fixture)).toContain('Tentar outro e-mail');
      expect((fixture.nativeElement as HTMLElement).querySelector('#campo-senha')).toBeNull();
    });

    it('login válido grava a sessão e vai para o painel sem expor identidade em header', () => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();
      irParaSenha(fixture);

      const router = TestBed.inject(Router);
      const navegou = spyOn(router, 'navigate');

      fixture.componentInstance.senha.set('senha-correta-123');
      fixture.componentInstance.entrar();

      const req = httpMock.expectOne('/painel/sessoes');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.headers.has('X-Chave-Privacidade')).toBeFalse();
      expect(req.request.headers.has('X-Corretor-Id')).toBeFalse();
      req.flush({ corretor });
      fixture.detectChanges();

      expect(TestBed.inject(SessaoStore).corretor()).toEqual(corretor);
      expect(navegou).toHaveBeenCalledWith(['/painel']);
    });

    it('contagem de tentativas só aparece a partir da segunda falha', () => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();
      irParaSenha(fixture);

      fixture.componentInstance.senha.set('errada');
      fixture.componentInstance.entrar();
      httpMock
        .expectOne('/painel/sessoes')
        .flush({ tentativasRestantes: 4 }, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();
      expect(texto(fixture)).not.toContain('Restam');

      fixture.componentInstance.senha.set('errada de novo');
      fixture.componentInstance.entrar();
      httpMock
        .expectOne('/painel/sessoes')
        .flush({ tentativasRestantes: 2 }, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();
      expect(texto(fixture)).toContain(
        'Senha incorreta. Restam 2 tentativas antes do bloqueio temporário.'
      );
    });

    it('423 bloqueia o formulário por 30 segundos e libera sozinho ao fim da contagem', fakeAsync(() => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();
      irParaSenha(fixture);

      fixture.componentInstance.senha.set('quinta tentativa');
      fixture.componentInstance.entrar();
      httpMock
        .expectOne('/painel/sessoes')
        .flush({ bloqueadoPorSegundos: 30 }, { status: 423, statusText: 'Locked' });
      fixture.detectChanges();

      expect(texto(fixture)).toContain(
        'Muitas tentativas incorretas. Formulário bloqueado por 30 segundos.'
      );

      tick(6000);
      fixture.detectChanges();
      expect(fixture.componentInstance.bloqueado()).toBeTrue();
      expect(texto(fixture)).toContain('Bloqueado temporariamente');
      expect(texto(fixture)).toContain('Aguarde 0:24');
      expect(
        (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#campo-senha')
          ?.disabled
      ).toBeTrue();

      tick(24000);
      fixture.detectChanges();
      expect(fixture.componentInstance.bloqueado()).toBeFalse();
      expect(texto(fixture)).not.toContain('Bloqueado temporariamente');
    }));

    it('Telas 4 e 5 pedem o link e confirmam sem revelar se o e-mail existe', fakeAsync(() => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();
      irParaSenha(fixture);

      fixture.componentInstance.irParaRecuperacao();
      fixture.detectChanges();
      tick();
      expect(texto(fixture)).toContain('Redefinir senha');
      expect(texto(fixture)).toContain('← Voltar para o login');
      expect(
        (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
          '#campo-email-recuperacao'
        )?.value
      ).toBe('renata.costa@solar.com.br');

      fixture.componentInstance.enviarLink();
      const req = httpMock.expectOne('/painel/senha/recuperacoes');
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 202, statusText: 'Accepted' });
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Verifique seu e-mail');
      expect(texto(fixture)).toContain('O link expira em 30 minutos.');
      expect(texto(fixture)).toContain('Reenviar e-mail');
    }));

    it('e-mail inexistente na recuperação mostra exatamente a mesma Tela 5', () => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();

      fixture.componentInstance.email.set('nao.existe@solar.com.br');
      fixture.componentInstance.irParaRecuperacao();
      fixture.componentInstance.enviarLink();
      httpMock
        .expectOne('/painel/senha/recuperacoes')
        .flush('nao encontrado', { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Verifique seu e-mail');
      expect(texto(fixture)).toContain('O link expira em 30 minutos.');
    });

    it('429 no limiter não finge que o link foi enviado', () => {
      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();

      fixture.componentInstance.email.set('renata.costa@solar.com.br');
      fixture.componentInstance.irParaRecuperacao();
      fixture.componentInstance.enviarLink();
      httpMock
        .expectOne('/painel/senha/recuperacoes')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });
      fixture.detectChanges();

      expect(texto(fixture)).not.toContain('Verifique seu e-mail');
      expect(texto(fixture)).toContain('Redefinir senha');
      expect(texto(fixture)).toContain('Muitos pedidos seguidos.');
    });
  });

  describe('com token de redefinição na URL', () => {
    it('Tela 6 abre com o e-mail do token e salva a nova senha entrando direto no painel', async () => {
      await configurar('token-valido-123');

      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();

      httpMock
        .expectOne('/painel/senha/recuperacoes/token-valido-123')
        .flush({ email: 'renata.costa@solar.com.br' });
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Crie uma nova senha');
      expect(texto(fixture)).toContain('Ao salvar, você entra direto no painel do corretor.');

      const router = TestBed.inject(Router);
      const navegou = spyOn(router, 'navigate');

      fixture.componentInstance.novaSenha.set('senha-nova-forte');
      fixture.componentInstance.confirmacaoSenha.set('senha-nova-forte');
      fixture.detectChanges();
      fixture.componentInstance.salvarSenha();

      const req = httpMock.expectOne('/painel/senha');
      expect(req.request.body).toEqual({
        token: 'token-valido-123',
        novaSenha: 'senha-nova-forte',
      });
      req.flush({ corretor });
      fixture.detectChanges();

      expect(TestBed.inject(SessaoStore).corretor()).toEqual(corretor);
      expect(navegou).toHaveBeenCalledWith(['/painel']);
    });

    it('Tela 6c desabilita Salvar e acusa divergência só no campo de confirmação', async () => {
      await configurar('token-valido-123');

      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();
      httpMock
        .expectOne('/painel/senha/recuperacoes/token-valido-123')
        .flush({ email: 'renata.costa@solar.com.br' });
      fixture.detectChanges();

      fixture.componentInstance.novaSenha.set('senha-nova-forte');
      fixture.componentInstance.confirmacaoSenha.set('senha-diferente');
      fixture.detectChanges();

      const html = fixture.nativeElement as HTMLElement;
      expect(texto(fixture)).toContain('As senhas não coincidem.');
      expect(html.querySelector('#campo-confirmacao')?.classList).toContain('com-erro');
      expect(html.querySelector('#campo-nova-senha')?.classList).not.toContain('com-erro');
      expect(html.querySelector<HTMLButtonElement>('.botao-primario')?.disabled).toBeTrue();

      httpMock.expectNone('/painel/senha');
    });

    it('Tela 6b substitui o formulário quando o link expirou ou já foi usado', async () => {
      await configurar('token-queimado');

      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();

      httpMock
        .expectOne('/painel/senha/recuperacoes/token-queimado')
        .flush('expirado', { status: 410, statusText: 'Gone' });
      fixture.detectChanges();

      const html = fixture.nativeElement as HTMLElement;
      expect(texto(fixture)).toContain('Este link não é mais válido');
      expect(texto(fixture)).toContain('Pedir novo link');
      expect(html.querySelector('#campo-nova-senha')).toBeNull();
      expect(html.querySelector('#campo-confirmacao')).toBeNull();
    });

    it('Pedir novo link volta para a Tela 4 sem reaproveitar o e-mail do link antigo', async () => {
      await configurar('token-queimado');

      const fixture = TestBed.createComponent(Entrar);
      fixture.detectChanges();
      httpMock
        .expectOne('/painel/senha/recuperacoes/token-queimado')
        .flush('expirado', { status: 410, statusText: 'Gone' });
      fixture.detectChanges();

      fixture.componentInstance.pedirNovoLink();
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Redefinir senha');
      expect(
        (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
          '#campo-email-recuperacao'
        )?.value
      ).toBe('');
    });
  });
});
