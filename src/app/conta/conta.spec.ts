import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Avisos } from '../componentes/aviso-flutuante';
import { painelGuard, sessaoGuard } from '../sessao/sessao-guard';
import { SessaoStore } from '../sessao/sessao-store';
import {
  aplicarTema,
  limparTema,
  sessaoCliente,
  sessaoCorretor,
  sessaoSupervisor,
  TEMAS,
} from '../sessao/sessao-teste';
import { Conta } from './conta';
import { ContaResponse } from './conta-contrato';

const ERRO_POR_TEMA = { claro: 'rgb(138, 35, 24)', escuro: 'rgb(240, 163, 152)' } as const;

@Component({ template: '' })
class TelaFalsa {}

function contaCliente(extra: Partial<ContaResponse> = {}): ContaResponse {
  return {
    id: 'u-cliente',
    nome: 'Marina Couto',
    email: 'marina.couto@email.com',
    telefone: '11987654321',
    perfil: 'cliente',
    criadaEm: '2026-09-22T14:08:00Z',
    corretor: null,
    consentimento: { em: '2026-09-22T14:08:00Z', versao: '2026-09-11' },
    conversasSalvas: 3,
    ...extra,
  };
}

function contaCorretor(): ContaResponse {
  return contaCliente({
    id: 'u-corretor',
    nome: 'Rafael Nunes',
    email: 'rafael@imob.com',
    telefone: '11912345678',
    perfil: 'corretor',
    corretor: {
      status: 'aprovado',
      regioes: ['sul', 'centro'],
      especialidades: ['moradia', 'investimento'],
      aprovadoEm: '2026-09-23T15:00:00Z',
    },
    consentimento: null,
    conversasSalvas: 0,
  });
}

describe('Conta', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Conta],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: TelaFalsa },
          { path: 'entrar', component: TelaFalsa },
          { path: 'painel', component: TelaFalsa, canActivate: [painelGuard] },
          { path: 'conta', component: TelaFalsa, canActivate: [sessaoGuard] },
        ]),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('solar.conversaId');
    limparTema();
  });

  function montar(conta: ContaResponse = contaCliente()): ComponentFixture<Conta> {
    const sessao =
      conta.perfil === 'cliente'
        ? sessaoCliente()
        : conta.perfil === 'corretor'
          ? sessaoCorretor('aprovado')
          : sessaoSupervisor();
    TestBed.inject(SessaoStore).definir(sessao);
    const fixture = TestBed.createComponent(Conta);
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/conta');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(conta);
    fixture.detectChanges();
    return fixture;
  }

  function html(fixture: ComponentFixture<Conta>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<Conta>): string {
    return (html(fixture).textContent ?? '').replace(/\s+/g, ' ');
  }

  function botao(fixture: ComponentFixture<Conta>, rotulo: string): HTMLButtonElement {
    return Array.from(html(fixture).querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === rotulo,
    )!;
  }

  function clicar(fixture: ComponentFixture<Conta>, rotulo: string): void {
    botao(fixture, rotulo).click();
    fixture.detectChanges();
  }

  async function digitar(fixture: ComponentFixture<Conta>, id: string, valor: string) {
    await fixture.whenStable();
    const campo = html(fixture).querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function pares(fixture: ComponentFixture<Conta>): string[] {
    return Array.from(html(fixture).querySelectorAll('.par')).map(
      (p) => `${p.querySelector('span')?.textContent}: ${p.lastChild?.textContent?.trim()}`,
    );
  }

  describe('guards', () => {
    it('/conta sem sessão manda para o login', fakeAsync(() => {
      const router = TestBed.inject(Router);
      router.navigateByUrl('/conta');
      tick();
      httpMock.expectOne('/api/sessao').flush(null, { status: 401, statusText: 'Unauthorized' });
      tick();

      expect(router.url).toBe('/entrar');
    }));

    it('/painel com sessão de cliente volta para o chat', fakeAsync(() => {
      const router = TestBed.inject(Router);
      router.navigateByUrl('/painel');
      tick();
      httpMock.expectOne('/api/sessao').flush(sessaoCliente());
      tick();

      expect(router.url).toBe('/');
    }));
  });

  it('cliente: leitura com dados, conversas, consentimento, Sair e Excluir', () => {
    const fixture = montar();

    expect(html(fixture).querySelector('.avatar')?.textContent).toBe('MC');
    expect(html(fixture).querySelector('.nome')?.textContent).toBe('Marina Couto');
    expect(html(fixture).querySelector('.papel')?.textContent).toBe('Cliente · desde set 2026');
    expect(pares(fixture)).toEqual([
      'E-mail: marina.couto@email.com',
      'Telefone: (11) 98765-4321',
      'Senha · ••••••••: Alterar senha',
      'Conversas salvas: Ver no chat',
      'Consentimento: Aviso de privacidade v. 2026-09-11',
    ]);
    expect(botao(fixture, 'Sair da conta')).toBeTruthy();
    expect(texto(fixture)).toContain('Apaga sua conta e as conversas salvas.');
    expect(texto(fixture)).toContain('Registrado em 22 set 2026');
    expect(botao(fixture, 'Excluir conta…')).toBeTruthy();
  });

  it('os rótulos de campo usam peso 600, sem mudar o peso do papel nem dos títulos de bloco', () => {
    const fixture = montar();
    clicar(fixture, 'Editar dados');

    const rotulos = Array.from(html(fixture).querySelectorAll('label.rotulo'));
    expect(rotulos.length).toBe(4);
    expect(rotulos.every((r) => getComputedStyle(r).fontWeight === '600')).toBeTrue();
    expect(getComputedStyle(html(fixture).querySelector('.papel')!).fontWeight).toBe('600');
    expect(getComputedStyle(html(fixture).querySelector('h2')!).fontWeight).toBe('600');
  });

  it('trocar o e-mail pede a senha atual antes de chamar a API', async () => {
    const fixture = montar();
    clicar(fixture, 'Editar dados');

    expect(texto(fixture)).toContain('Trocar o e-mail pede a senha atual.');
    await digitar(fixture, 'conta-email', 'marina.c@novoemail.com');
    clicar(fixture, 'Salvar');

    expect(texto(fixture)).toContain('Informe a senha atual para trocar o e-mail.');
    httpMock.expectNone('/api/conta');
  });

  it('salvar edita no lugar, manda só o que mudou e mostra "Dados atualizados"', async () => {
    const fixture = montar();
    clicar(fixture, 'Editar dados');
    await digitar(fixture, 'conta-email', 'marina.c@novoemail.com');
    await digitar(fixture, 'conta-senha-atual', 'senha-atual-123');
    clicar(fixture, 'Salvar');

    const req = httpMock.expectOne('/api/conta');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      email: 'marina.c@novoemail.com',
      senhaAtual: 'senha-atual-123',
    });
    req.flush(contaCliente({ email: 'marina.c@novoemail.com' }));
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Dados atualizados');
    expect(pares(fixture)[0]).toBe('E-mail: marina.c@novoemail.com');
    expect(TestBed.inject(SessaoStore).usuario()?.email).toBe('marina.c@novoemail.com');
  });

  it('só o telefone mudou: o corpo leva só os dígitos do telefone', async () => {
    const fixture = montar();
    clicar(fixture, 'Editar dados');
    await digitar(fixture, 'conta-telefone', '11 3456-7890');
    clicar(fixture, 'Salvar');

    const req = httpMock.expectOne('/api/conta');
    expect(req.request.body).toEqual({ telefone: '1134567890' });
    req.flush(contaCliente({ telefone: '1134567890' }));
  });

  it('senha atual incorreta e e-mail em uso aparecem no campo certo', async () => {
    const fixture = montar();
    clicar(fixture, 'Editar dados');
    await digitar(fixture, 'conta-email', 'outra@email.com');
    await digitar(fixture, 'conta-senha-atual', 'errada');
    clicar(fixture, 'Salvar');
    httpMock
      .expectOne('/api/conta')
      .flush({ codigo: 'senha_atual_incorreta' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Senha atual incorreta.');

    clicar(fixture, 'Salvar');
    httpMock
      .expectOne('/api/conta')
      .flush({ codigo: 'email_em_uso' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Este e-mail já tem conta.');
  });

  it('alterar senha chama POST /api/conta/senha e confirma', async () => {
    const fixture = montar();
    clicar(fixture, 'Alterar senha');
    await digitar(fixture, 'senha-atual', 'senha-atual-123');
    await digitar(fixture, 'senha-nova', 'senha-nova-456');
    await digitar(fixture, 'senha-confirmacao', 'senha-nova-456');
    clicar(fixture, 'Salvar');

    const req = httpMock.expectOne('/api/conta/senha');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      senhaAtual: 'senha-atual-123',
      novaSenha: 'senha-nova-456',
    });
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Senha alterada');
  });

  it('Excluir mostra a consequência do cliente e só acende com o e-mail digitado', async () => {
    const fixture = montar();
    clicar(fixture, 'Excluir conta…');

    expect(texto(fixture)).toContain(
      'Isto apaga sua conta, suas 3 conversas com a Lia e os seus dados que a Solar repassou a corretores. Não dá para desfazer.',
    );
    expect(texto(fixture)).toContain(
      'Registros que a lei obriga a guardar ficam retidos pelo prazo legal e depois são apagados.',
    );
    expect(texto(fixture)).toContain('Digite seu e-mail para confirmar');
    expect(botao(fixture, 'Excluir definitivamente').disabled).toBeTrue();

    await digitar(fixture, 'conta-confirmar-email', 'marina@email.com');
    expect(botao(fixture, 'Excluir definitivamente').disabled).toBeTrue();

    await digitar(fixture, 'conta-confirmar-email', 'Marina.Couto@email.com ');
    expect(botao(fixture, 'Excluir definitivamente').disabled).toBeFalse();
  });

  it('excluir chama DELETE com o e-mail, encerra a sessão e volta ao chat com o aviso', fakeAsync(() => {
    localStorage.setItem('solar.conversaId', 'conversa-da-conta');
    const navegou = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = montar();
    clicar(fixture, 'Excluir conta…');
    tick();
    const campo = html(fixture).querySelector<HTMLInputElement>('#conta-confirmar-email')!;
    campo.value = 'marina.couto@email.com';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    clicar(fixture, 'Excluir definitivamente');

    const req = httpMock.expectOne('/api/conta');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ email: 'marina.couto@email.com' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    tick();

    expect(TestBed.inject(SessaoStore).ativa()).toBeFalse();
    expect(localStorage.getItem('solar.conversaId')).toBeNull();
    expect(TestBed.inject(Avisos).atual()).toBe('Sua conta foi excluída');
    expect(navegou).toHaveBeenCalledWith(['/']);
    tick(5000);
  }));

  it('confirmacao_invalida mostra que o e-mail não confere', async () => {
    const fixture = montar();
    clicar(fixture, 'Excluir conta…');
    await digitar(fixture, 'conta-confirmar-email', 'marina.couto@email.com');
    clicar(fixture, 'Excluir definitivamente');
    httpMock
      .expectOne('/api/conta')
      .flush({ codigo: 'confirmacao_invalida' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('O e-mail digitado não confere.');
  });

  it('corretor: vê Atuação, edita regiões e especialidades e lê a consequência dos leads', async () => {
    const fixture = montar(contaCorretor());

    expect(html(fixture).querySelector('.papel')?.textContent).toBe(
      'Corretor · aprovado em 23 set',
    );
    expect(pares(fixture)).toContain('Região: Sul, Centro');
    expect(pares(fixture)).toContain('Especialidade: Moradia, Investimento');
    expect(texto(fixture)).not.toContain('Conversas salvas');
    expect(texto(fixture)).toContain(
      'Seus leads em atendimento voltam para a fila e são redistribuídos.',
    );

    html(fixture).querySelectorAll<HTMLButtonElement>('.acao-bloco')[1].click();
    fixture.detectChanges();
    clicar(fixture, 'Centro');
    clicar(fixture, 'Norte');
    clicar(fixture, 'Salvar');

    const req = httpMock.expectOne('/api/conta');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      regioes: ['sul', 'norte'],
      especialidades: ['moradia', 'investimento'],
    });
    req.flush(contaCorretor());
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Atuação atualizada');
  });

  it('supervisor não vê o bloco de excluir', () => {
    const fixture = montar(contaCliente({ perfil: 'supervisor', conversasSalvas: 0 }));

    expect(texto(fixture)).not.toContain('Excluir conta');
    expect(html(fixture).querySelector('.papel')?.textContent).toBe('Supervisor · desde set 2026');
  });

  it('401 ao carregar limpa a sessão e manda para o login', () => {
    const navegou = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    TestBed.inject(SessaoStore).definir(sessaoCliente());
    const fixture = TestBed.createComponent(Conta);
    fixture.detectChanges();
    httpMock.expectOne('/api/conta').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(TestBed.inject(SessaoStore).ativa()).toBeFalse();
    expect(navegou).toHaveBeenCalledWith(['/entrar']);
  });

  for (const tema of TEMAS) {
    it(`no tema ${tema}, Excluir definitivamente usa a cor de erro do tema`, async () => {
      aplicarTema(tema);
      const fixture = montar();
      clicar(fixture, 'Excluir conta…');
      await digitar(fixture, 'conta-confirmar-email', 'marina.couto@email.com');

      const excluir = botao(fixture, 'Excluir definitivamente');
      expect(getComputedStyle(excluir).backgroundColor).toBe(ERRO_POR_TEMA[tema]);
    });
  }
});
