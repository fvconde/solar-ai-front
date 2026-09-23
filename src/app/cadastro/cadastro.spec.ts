import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { Avisos } from '../componentes/aviso-flutuante';
import { SessaoStore } from '../sessao/sessao-store';
import {
  aplicarTema,
  limparTema,
  MARCA_POR_TEMA,
  sessaoCliente,
  sessaoCorretor,
  TEMAS,
} from '../sessao/sessao-teste';
import { Cadastro } from './cadastro';
import { mascararTelefone } from './validacao';

describe('Cadastro', () => {
  let httpMock: HttpTestingController;
  let navegou: jasmine.Spy;

  async function montar(tipo: 'cliente' | 'corretor'): Promise<ComponentFixture<Cadastro>> {
    await TestBed.configureTestingModule({
      imports: [Cadastro],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { tipo } } } },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    navegou = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    const fixture = TestBed.createComponent(Cadastro);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    httpMock?.verify();
    localStorage.removeItem('solar.conversaId');
    limparTema();
  });

  function html(fixture: ComponentFixture<Cadastro>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<Cadastro>): string {
    return (html(fixture).textContent ?? '').replace(/\s+/g, ' ');
  }

  function botao(fixture: ComponentFixture<Cadastro>): HTMLButtonElement {
    return html(fixture).querySelector<HTMLButtonElement>('.botao-primario')!;
  }

  function digitar(fixture: ComponentFixture<Cadastro>, id: string, valor: string): void {
    const campo = html(fixture).querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function preencherBase(fixture: ComponentFixture<Cadastro>, nome = 'Marina Couto'): void {
    digitar(fixture, 'campo-nome', nome);
    digitar(fixture, 'campo-email', 'marina.couto@email.com');
    digitar(fixture, 'campo-telefone', '11987654321');
    digitar(fixture, 'campo-senha', 'senha-forte');
    digitar(fixture, 'campo-confirmacao', 'senha-forte');
  }

  function aceitar(fixture: ComponentFixture<Cadastro>): void {
    const caixa = html(fixture).querySelector<HTMLInputElement>('.aceite input')!;
    caixa.click();
    fixture.detectChanges();
  }

  function clicarChip(fixture: ComponentFixture<Cadastro>, rotulo: string): void {
    Array.from(html(fixture).querySelectorAll<HTMLButtonElement>('.chip'))
      .find((chip) => chip.textContent?.trim() === rotulo)!
      .click();
    fixture.detectChanges();
  }

  it('mascara o telefone enquanto a pessoa digita', () => {
    expect(mascararTelefone('11')).toBe('(11');
    expect(mascararTelefone('119876')).toBe('(11) 9876');
    expect(mascararTelefone('1134567890')).toBe('(11) 3456-7890');
    expect(mascararTelefone('11987654321')).toBe('(11) 98765-4321');
  });

  describe('cliente em /cadastro', () => {
    it('abre com os textos do desenho, aceite desmarcado e botão apagado', async () => {
      const fixture = await montar('cliente');

      expect(texto(fixture)).toContain('← Voltar para o login');
      expect(texto(fixture)).toContain('Criar sua conta');
      expect(texto(fixture)).toContain(
        'Suas conversas com a Lia ficam salvas e você continua de onde parou, em qualquer aparelho.',
      );
      expect(texto(fixture)).toContain('Usado só para falarmos sobre os imóveis que você pedir.');
      expect(html(fixture).querySelector<HTMLInputElement>('.aceite input')?.checked).toBeFalse();
      expect(botao(fixture).disabled).toBeTrue();
      expect(botao(fixture).textContent?.trim()).toBe('Criar conta e entrar');
      expect(html(fixture).querySelector('.chip')).toBeNull();
    });

    it('o aceite fala só da Política de privacidade e leva a /privacidade, sem Termos de uso', async () => {
      const fixture = await montar('cliente');
      const aceite = html(fixture).querySelector('.aceite')!;

      expect(aceite.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Li e aceito a Política de privacidade.',
      );
      expect(aceite.querySelector('a')?.getAttribute('href')).toBe('/privacidade');
      expect(texto(fixture)).not.toContain('Termos');
    });

    it('preenchido: confirma as senhas e só acende o botão com o aceite marcado', async () => {
      const fixture = await montar('cliente');
      preencherBase(fixture);

      expect(texto(fixture)).toContain('✓ As senhas coincidem');
      expect(botao(fixture).disabled).toBeTrue();

      aceitar(fixture);
      expect(botao(fixture).disabled).toBeFalse();
    });

    it('com erros: mostra cada erro ao sair do campo, sem chamar a API', async () => {
      const fixture = await montar('cliente');
      digitar(fixture, 'campo-nome', 'M');
      digitar(fixture, 'campo-email', 'marina@');
      digitar(fixture, 'campo-telefone', '119876');
      digitar(fixture, 'campo-senha', '123456');
      digitar(fixture, 'campo-confirmacao', '1234567');
      aceitar(fixture);

      expect(texto(fixture)).toContain('Use ao menos 2 caracteres.');
      expect(texto(fixture)).toContain('Verifique o formato do e-mail.');
      expect(texto(fixture)).toContain('Informe o DDD e o número completo.');
      expect(texto(fixture)).toContain('Use ao menos 8 caracteres. As senhas não coincidem.');
      expect(html(fixture).querySelector('#campo-telefone')?.classList).toContain('com-erro');
      expect(html(fixture).querySelector('#campo-confirmacao')?.classList).toContain('com-erro');
      expect(botao(fixture).disabled).toBeTrue();
      httpMock.expectNone(() => true);
    });

    it('envia o corpo do contrato com telefone só em dígitos e o conversaId sem dono', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conversa-anonima-1');
      let fixture!: ComponentFixture<Cadastro>;
      montar('cliente').then((f) => (fixture = f));
      tick();
      preencherBase(fixture);
      aceitar(fixture);
      botao(fixture).click();

      const req = httpMock.expectOne('/api/contas');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      expect(req.request.body).toEqual({
        nome: 'Marina Couto',
        email: 'marina.couto@email.com',
        telefone: '11987654321',
        senha: 'senha-forte',
        aceitePrivacidade: true,
        conversaId: 'conversa-anonima-1',
      });
      expect(req.request.body.confirmacao).toBeUndefined();
      req.flush(sessaoCliente(), { status: 201, statusText: 'Created' });
      tick();

      expect(TestBed.inject(SessaoStore).perfil()).toBe('cliente');
      expect(TestBed.inject(Avisos).atual()).toBe('Conta criada. Esta conversa já está salva.');
      expect(navegou).toHaveBeenCalledWith(['/']);
      tick(5000);
    }));

    it('criando: trava os campos e mostra o giro no botão', async () => {
      const fixture = await montar('cliente');
      preencherBase(fixture);
      aceitar(fixture);
      botao(fixture).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(html(fixture).querySelector<HTMLInputElement>('#campo-nome')?.disabled).toBeTrue();
      expect(html(fixture).querySelector('.botao-primario .verificando')).toBeTruthy();
      expect(html(fixture).querySelector('.link-voltar')?.classList).toContain('apagado');

      httpMock.expectOne('/api/contas').flush(sessaoCliente());
    });

    it('409 email_em_uso mostra o aviso com links para entrar e redefinir a senha', async () => {
      const fixture = await montar('cliente');
      preencherBase(fixture);
      aceitar(fixture);
      botao(fixture).click();
      httpMock
        .expectOne('/api/contas')
        .flush({ codigo: 'email_em_uso', mensagem: 'x' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      const aviso = Array.from(html(fixture).querySelectorAll('.dica.erro')).find((d) =>
        d.textContent?.includes('Este e-mail já tem conta.'),
      )!;
      expect(aviso.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Este e-mail já tem conta. Entrar ou redefinir a senha.',
      );
      const links = Array.from(aviso.querySelectorAll('a')).map((a) => a.getAttribute('href'));
      expect(links).toEqual(['/entrar', '/entrar?redefinir=1']);
      expect(botao(fixture).disabled).toBeTrue();
    });

    it('400 validacao mostra o erro de cada campo devolvido pela API', async () => {
      const fixture = await montar('cliente');
      preencherBase(fixture);
      aceitar(fixture);
      botao(fixture).click();
      httpMock
        .expectOne('/api/contas')
        .flush(
          { codigo: 'validacao', campos: { telefone: 'formato', nome: 'longo' } },
          { status: 400, statusText: 'Bad Request' },
        );
      fixture.detectChanges();

      expect(texto(fixture)).toContain('Informe o DDD e o número completo.');
      expect(texto(fixture)).toContain('Use no máximo 120 caracteres.');
    });

    it('falha de rede mostra a mensagem do desenho e mantém os campos preenchidos', async () => {
      const fixture = await montar('cliente');
      preencherBase(fixture);
      aceitar(fixture);
      botao(fixture).click();
      httpMock
        .expectOne('/api/contas')
        .error(new ProgressEvent('error'), { status: 0, statusText: '' });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(texto(fixture)).toContain(
        'Não conseguimos criar sua conta agora. Tente de novo em instantes.',
      );
      expect(html(fixture).querySelector<HTMLInputElement>('#campo-nome')?.value).toBe(
        'Marina Couto',
      );
      expect(botao(fixture).disabled).toBeFalse();
    });
  });

  describe('corretor em /seja-corretor', () => {
    it('abre com os textos do desenho e os chips de região e especialidade', async () => {
      const fixture = await montar('corretor');

      expect(texto(fixture)).toContain('Seja corretor na Solar');
      expect(texto(fixture)).toContain(
        'Receba leads que a Lia já qualificou, na sua região e na sua especialidade.',
      );
      expect(texto(fixture)).toContain('Região · uma ou mais');
      expect(texto(fixture)).toContain('Especialidade · uma ou as duas');
      expect(
        Array.from(html(fixture).querySelectorAll('.chip')).map((c) => c.textContent?.trim()),
      ).toEqual(['Norte', 'Sul', 'Leste', 'Oeste', 'Centro', 'Investimento', 'Moradia']);
      expect(texto(fixture)).toContain(
        'Você já entra na Solar. A supervisão confere seus dados em até 1 dia útil.',
      );
      expect(botao(fixture).textContent?.trim()).toBe('Criar conta e enviar para análise');
      expect(html(fixture).querySelector('.aceite')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Li e aceito a Política de privacidade.',
      );
    });

    it('com erros: com o aceite marcado e nenhum chip, pede região e especialidade', async () => {
      const fixture = await montar('corretor');
      preencherBase(fixture, 'Rafael Nunes');
      aceitar(fixture);

      expect(texto(fixture)).toContain('Escolha ao menos uma região.');
      expect(texto(fixture)).toContain('Escolha ao menos uma especialidade.');
      expect(html(fixture).querySelector('.chips')?.classList).toContain('com-erro');
      expect(botao(fixture).disabled).toBeTrue();
    });

    it('envia região e especialidade no corpo, sem conversaId, e vai ao painel', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conversa-anonima-1');
      let fixture!: ComponentFixture<Cadastro>;
      montar('corretor').then((f) => (fixture = f));
      tick();
      preencherBase(fixture, 'Rafael Nunes');
      clicarChip(fixture, 'Sul');
      clicarChip(fixture, 'Centro');
      clicarChip(fixture, 'Moradia');
      clicarChip(fixture, 'Investimento');
      aceitar(fixture);

      const ligados = html(fixture).querySelectorAll('.chip.ligado');
      expect(ligados.length).toBe(4);
      expect(ligados[0].getAttribute('aria-pressed')).toBe('true');

      botao(fixture).click();
      const req = httpMock.expectOne('/api/corretores');
      expect(req.request.body).toEqual({
        nome: 'Rafael Nunes',
        email: 'marina.couto@email.com',
        telefone: '11987654321',
        senha: 'senha-forte',
        aceitePrivacidade: true,
        regioes: ['sul', 'centro'],
        especialidades: ['moradia', 'investimento'],
      });
      req.flush(sessaoCorretor('em_analise'), { status: 201, statusText: 'Created' });
      tick();

      expect(TestBed.inject(SessaoStore).emAnalise()).toBeTrue();
      expect(TestBed.inject(Avisos).atual()).toBe('Conta criada. Você já está dentro.');
      expect(navegou).toHaveBeenCalledWith(['/painel']);
      tick(5000);
    }));
  });

  for (const tema of TEMAS) {
    it(`no tema ${tema}, o chip ligado e o botão aceso usam a cor de ação do tema`, async () => {
      aplicarTema(tema);
      const fixture = await montar('corretor');
      preencherBase(fixture, 'Rafael Nunes');
      clicarChip(fixture, 'Sul');
      clicarChip(fixture, 'Moradia');
      aceitar(fixture);

      const chip = html(fixture).querySelector<HTMLElement>('.chip.ligado')!;
      expect(getComputedStyle(chip).color).toBe(MARCA_POR_TEMA[tema]);
      expect(getComputedStyle(botao(fixture)).backgroundColor).toBe(MARCA_POR_TEMA[tema]);
    });
  }
});
