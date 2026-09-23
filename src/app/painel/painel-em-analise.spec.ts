import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ContaResponse } from '../conta/conta-contrato';
import { diaCurto, horaDe } from '../conversa/horario';
import { SessaoStore } from '../sessao/sessao-store';
import { aplicarTema, limparTema, sessaoCorretor, TEMAS } from '../sessao/sessao-teste';
import { Painel } from './painel';

const SUCESSO_POR_TEMA = { claro: 'rgb(30, 86, 55)', escuro: 'rgb(143, 211, 168)' } as const;
const CRIADA_EM = '2026-09-22T17:08:00Z';

function contaCorretor(
  status: 'em_analise' | 'aprovado',
  aprovadoEm: string | null = null,
): ContaResponse {
  return {
    id: 'u-corretor',
    nome: 'Rafael Nunes',
    email: 'rafael@imob.com',
    telefone: '11912345678',
    perfil: 'corretor',
    criadaEm: CRIADA_EM,
    corretor: {
      status,
      regioes: ['sul', 'centro'],
      especialidades: ['moradia', 'investimento'],
      aprovadoEm,
    },
    consentimento: { em: CRIADA_EM, versao: '2026-09-11' },
    conversasSalvas: 0,
  };
}

describe('Painel do corretor em análise e aviso de aprovação', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Painel],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('solar.aprovacaoVista');
    limparTema();
  });

  function montar(status: 'em_analise' | 'aprovado'): ComponentFixture<Painel> {
    TestBed.inject(SessaoStore).definir(sessaoCorretor(status));
    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    return fixture;
  }

  function texto(fixture: ComponentFixture<Painel>): string {
    return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  }

  function aprovado(aprovadoEm: string | null): ComponentFixture<Painel> {
    const fixture = montar('aprovado');
    httpMock.expectOne('/api/conta').flush(contaCorretor('aprovado', aprovadoEm));
    httpMock.expectOne((r) => r.url === '/api/painel/leads').flush({ itens: [], total: 0 });
    fixture.detectChanges();
    return fixture;
  }

  it('em análise, mostra a tela da supervisão com regiões e especialidades, sem chamar a fila', () => {
    const fixture = montar('em_analise');
    httpMock.expectNone((r) => r.url.startsWith('/api/painel'));
    const conta = httpMock.expectOne('/api/conta');
    expect(conta.request.withCredentials).toBeTrue();
    conta.flush(contaCorretor('em_analise'));
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Seu cadastro está com a supervisão');
    expect(texto(fixture)).toContain(
      'Quando aprovarem, os leads de Sul e Centro em Moradia e Investimento aparecem aqui. Avisamos por e-mail.',
    );
    expect(texto(fixture)).toContain(
      'Enquanto isso, você pode conversar com a Lia e revisar sua conta.',
    );
    expect(texto(fixture)).not.toContain('Fila de leads');
  });

  it('a trilha tem os três passos, com a conta criada feita e a análise em andamento', () => {
    const fixture = montar('em_analise');
    httpMock.expectOne('/api/conta').flush(contaCorretor('em_analise'));
    fixture.detectChanges();

    const passos = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.passo'),
    );
    expect(passos.map((p) => p.querySelector('b')?.textContent)).toEqual([
      'Conta criada',
      'Análise da supervisão',
      'Acesso aos leads',
    ]);
    expect(passos[0].querySelector('span:not(.bola)')?.textContent).toBe(
      `${diaCurto(CRIADA_EM)}, ${horaDe(CRIADA_EM)}`,
    );
    expect(passos[0].classList).toContain('feito');
    expect(passos[1].classList).toContain('agora');
    expect(passos[1].getAttribute('aria-current')).toBe('step');
    expect(passos[1].textContent).toContain('em andamento · até 1 dia útil');
    expect(passos[2].textContent).toContain('liberado na aprovação');
  });

  it('depois da aprovação, o aviso verde aparece uma única vez', () => {
    let fixture = aprovado('2026-09-23T10:00:00Z');
    expect(texto(fixture)).toContain('Cadastro aprovado. Seus primeiros leads já estão aqui.');
    fixture.destroy();

    fixture = aprovado('2026-09-23T10:00:00Z');
    expect(texto(fixture)).not.toContain('Cadastro aprovado.');
  });

  it('corretor migrado, com aprovadoEm nulo, não vê o aviso', () => {
    const fixture = aprovado(null);

    expect(texto(fixture)).not.toContain('Cadastro aprovado.');
    expect(localStorage.getItem('solar.aprovacaoVista')).toBeNull();
  });

  it('o aviso fecha no ✕', () => {
    const fixture = aprovado('2026-09-23T10:00:00Z');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.aviso-ok .fechar')!
      .click();
    fixture.detectChanges();

    expect(texto(fixture)).not.toContain('Cadastro aprovado.');
  });

  for (const tema of TEMAS) {
    it(`no tema ${tema}, o passo feito e o aviso de aprovação usam a cor de sucesso do tema`, () => {
      aplicarTema(tema);
      let fixture = montar('em_analise');
      httpMock.expectOne('/api/conta').flush(contaCorretor('em_analise'));
      fixture.detectChanges();
      const bola = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '.feito .bola',
      )!;
      expect(getComputedStyle(bola).backgroundColor).toBe(SUCESSO_POR_TEMA[tema]);
      fixture.destroy();

      fixture = aprovado('2026-09-23T10:00:00Z');
      const aviso = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.aviso-ok')!;
      expect(getComputedStyle(aviso).color).toBe(SUCESSO_POR_TEMA[tema]);
    });
  }
});
