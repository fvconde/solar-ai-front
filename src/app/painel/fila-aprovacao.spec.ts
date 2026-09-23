import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SessaoStore } from '../sessao/sessao-store';
import {
  aplicarTema,
  limparTema,
  MARCA_POR_TEMA,
  sessaoCorretor,
  sessaoSupervisor,
  TEMAS,
} from '../sessao/sessao-teste';
import { Painel } from './painel';
import { CorretorPendente } from './painel-contrato';

const ERRO_POR_TEMA = { claro: 'rgb(138, 35, 24)', escuro: 'rgb(240, 163, 152)' } as const;

const horasAtras = (horas: number) => new Date(Date.now() - horas * 3600000).toISOString();

const pendentes: CorretorPendente[] = [
  {
    id: 'cor-rafael',
    nome: 'Rafael Nunes',
    email: 'rafael@imob.com',
    telefone: '11912345678',
    regioes: ['sul', 'centro'],
    especialidades: ['moradia', 'investimento'],
    criadoEm: horasAtras(5.2),
  },
  {
    id: 'cor-bianca',
    nome: 'Bianca Lopes',
    email: 'bianca@lopes.imb.br',
    telefone: '11998761122',
    regioes: ['norte'],
    especialidades: ['moradia'],
    criadoEm: horasAtras(2.1),
  },
];

describe('Fila de aprovação de corretores', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Painel],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match((r) => r.url === '/api/painel/leads');
    httpMock.verify();
    limparTema();
  });

  function montarSupervisor(): ComponentFixture<Painel> {
    TestBed.inject(SessaoStore).definir(sessaoSupervisor(5));
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/painel/corretores/pendentes');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(pendentes);
    fixture.detectChanges();
    return fixture;
  }

  function html(fixture: ComponentFixture<Painel>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function linhas(fixture: ComponentFixture<Painel>): HTMLElement[] {
    return Array.from(html(fixture).querySelectorAll<HTMLElement>('.fila-aprovacao .linha'));
  }

  function clicar(elemento: HTMLElement, rotulo: string, fixture: ComponentFixture<Painel>) {
    Array.from(elemento.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === rotulo)!
      .click();
    fixture.detectChanges();
  }

  it('corretor não vê a fila nem chama a rota de pendentes', () => {
    TestBed.inject(SessaoStore).definir(sessaoCorretor('aprovado'));
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    httpMock.match('/api/conta');

    httpMock.expectNone('/api/painel/corretores/pendentes');
    expect(html(fixture).querySelector('.fila-aprovacao')).toBeNull();
  });

  it('supervisor vê "Novos corretores" no topo, do mais antigo ao mais novo, com contato e atuação', () => {
    const fixture = montarSupervisor();

    expect(html(fixture).querySelector('.fila-aprovacao .titulo')?.textContent?.trim()).toBe(
      'Novos corretores · 2',
    );
    const [rafael, bianca] = linhas(fixture);
    expect(rafael.querySelector('.nome')?.textContent).toBe('Rafael Nunes');
    expect(rafael.querySelector('.estado')?.textContent).toBe('Em análise');
    const metas = Array.from(rafael.querySelectorAll('.meta')).map((m) => m.textContent?.trim());
    expect(metas).toEqual([
      'rafael@imob.com · (11) 91234-5678',
      'Sul, Centro · Moradia, Investimento · há 5 h',
    ]);
    expect(bianca.querySelector('.nome')?.textContent).toBe('Bianca Lopes');
    expect(TestBed.inject(SessaoStore).pendentesAprovacao()).toBe(2);
  });

  it('Aprovar chama a rota de aprovação, tira a linha e desconta o selo', () => {
    const fixture = montarSupervisor();

    clicar(linhas(fixture)[0], 'Aprovar', fixture);
    const req = httpMock.expectOne('/api/painel/corretores/cor-rafael/aprovacao');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(linhas(fixture).length).toBe(1);
    expect(html(fixture).querySelector('.fila-aprovacao .titulo')?.textContent?.trim()).toBe(
      'Novos corretores · 1',
    );
    expect(html(fixture).querySelector('.aviso-ok')?.textContent).toBe(
      'Cadastro de Rafael Nunes aprovado. O aviso segue por e-mail.',
    );
    expect(TestBed.inject(SessaoStore).pendentesAprovacao()).toBe(1);
  });

  it('Recusar abre a confirmação na própria linha, com motivo opcional', () => {
    const fixture = montarSupervisor();

    clicar(linhas(fixture)[1], 'Recusar', fixture);
    const linha = linhas(fixture)[1];

    expect(linha.classList).toContain('aberta');
    expect(linha.querySelector('.rotulo')?.textContent?.trim()).toBe(
      'Motivo · opcional, vai no e-mail',
    );
    expect(linha.querySelector('textarea')?.getAttribute('maxlength')).toBe('500');
    expect(Array.from(linha.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
      'Recusar e avisar por e-mail',
      'Cancelar',
    ]);
    httpMock.expectNone((r) => r.url.endsWith('/recusa'));

    clicar(linha, 'Cancelar', fixture);
    expect(linhas(fixture)[1].querySelector('textarea')).toBeNull();
  });

  it('confirmar a recusa manda o motivo e remove a linha', async () => {
    const fixture = montarSupervisor();
    clicar(linhas(fixture)[1], 'Recusar', fixture);
    await fixture.whenStable();

    const campo = linhas(fixture)[1].querySelector('textarea')!;
    campo.value = 'Não encontramos seu CRECI ativo.';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    clicar(linhas(fixture)[1], 'Recusar e avisar por e-mail', fixture);

    const req = httpMock.expectOne('/api/painel/corretores/cor-bianca/recusa');
    expect(req.request.body).toEqual({ motivo: 'Não encontramos seu CRECI ativo.' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(linhas(fixture).map((l) => l.querySelector('.nome')?.textContent)).toEqual([
      'Rafael Nunes',
    ]);
    expect(html(fixture).querySelector('.aviso-ok')?.textContent).toBe(
      'Cadastro de Bianca Lopes recusado. O aviso segue por e-mail.',
    );
  });

  it('recusa sem motivo manda corpo vazio', () => {
    const fixture = montarSupervisor();
    clicar(linhas(fixture)[0], 'Recusar', fixture);
    clicar(linhas(fixture)[0], 'Recusar e avisar por e-mail', fixture);

    const req = httpMock.expectOne('/api/painel/corretores/cor-rafael/recusa');
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('404 tira da lista o cadastro que já não está pendente', () => {
    const fixture = montarSupervisor();
    clicar(linhas(fixture)[0], 'Aprovar', fixture);
    httpMock
      .expectOne('/api/painel/corretores/cor-rafael/aprovacao')
      .flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(linhas(fixture).length).toBe(1);
    expect(html(fixture).querySelector('.fila-aprovacao .erro')?.textContent).toBe(
      'Este cadastro já não está pendente.',
    );
  });

  it('401 limpa a sessão e volta para o login', () => {
    const navegou = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = montarSupervisor();
    clicar(linhas(fixture)[0], 'Aprovar', fixture);
    httpMock
      .expectOne('/api/painel/corretores/cor-rafael/aprovacao')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(TestBed.inject(SessaoStore).ativa()).toBeFalse();
    expect(navegou).toHaveBeenCalledWith(['/entrar']);
  });

  it('lista vazia não mostra a seção', () => {
    TestBed.inject(SessaoStore).definir(sessaoSupervisor(0));
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    httpMock.expectOne('/api/painel/corretores/pendentes').flush([]);
    fixture.detectChanges();

    expect(html(fixture).querySelector('.fila-aprovacao')).toBeNull();
  });

  for (const tema of TEMAS) {
    it(`no tema ${tema}, Aprovar usa a marca e Recusar e avisar usa o erro do tema`, () => {
      aplicarTema(tema);
      const fixture = montarSupervisor();

      const aprovar = linhas(fixture)[0].querySelector<HTMLElement>('.acao.principal')!;
      expect(getComputedStyle(aprovar).backgroundColor).toBe(MARCA_POR_TEMA[tema]);

      clicar(linhas(fixture)[0], 'Recusar', fixture);
      const recusar = linhas(fixture)[0].querySelector<HTMLElement>('.acao.perigo')!;
      expect(getComputedStyle(recusar).backgroundColor).toBe(ERRO_POR_TEMA[tema]);
    });
  }
});
