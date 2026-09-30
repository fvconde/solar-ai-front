import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ContaResponse, ConversaResumo } from '../conta/conta-contrato';
import { VERSAO_AVISO_PRIVACIDADE } from '../conversa/contrato';
import { ConversaStore } from '../conversa/conversa-store';
import { horaDe } from '../conversa/horario';
import { SessaoStore } from '../sessao/sessao-store';
import {
  aplicarTema,
  limparTema,
  MARCA_POR_TEMA,
  sessaoCliente,
  TEMAS,
} from '../sessao/sessao-teste';
import { Chat } from './chat';

const AGORA = new Date().toISOString();

const conversas: ConversaResumo[] = [
  { id: 'conv-hoje', titulo: '2 quartos na zona sul', atualizadaEm: AGORA, estado: 'em_andamento' },
  {
    id: 'conv-antiga',
    titulo: 'Studio para investir no Centro',
    atualizadaEm: '2025-09-12T15:00:00',
    estado: 'com_corretor',
  },
  {
    id: 'conv-encerrada',
    titulo: 'Casa com quintal, zona norte',
    atualizadaEm: '2025-08-28T15:00:00',
    estado: 'encerrada',
  },
];

function conta(versao: string | null): ContaResponse {
  return {
    id: 'u-cliente',
    nome: 'Marina Couto',
    email: 'marina.couto@email.com',
    telefone: '11987654321',
    perfil: 'cliente',
    criadaEm: '2026-09-22T14:08:00Z',
    corretor: null,
    consentimento: versao ? { em: '2026-09-22T14:08:00Z', versao } : null,
    conversasSalvas: 3,
  };
}

describe('Chat', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chat],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem('solar.conversaId');
    localStorage.removeItem('solar.conviteDispensado');
    limparTema();
  });

  function html(fixture: ComponentFixture<Chat>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<Chat>): string {
    return (html(fixture).textContent ?? '').replace(/\s+/g, ' ');
  }

  function montarCliente(versao: string | null = VERSAO_AVISO_PRIVACIDADE) {
    TestBed.inject(SessaoStore).definir(sessaoCliente());
    const fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();
    httpMock.expectOne('/api/conta').flush(conta(versao));
    const lista = httpMock.expectOne('/api/conta/conversas');
    expect(lista.request.withCredentials).toBeTrue();
    lista.flush(conversas);
    fixture.detectChanges();
    return fixture;
  }

  function conversaVazia(id: string) {
    return {
      conversaId: id,
      perfilLead: null,
      mensagens: [],
      contatoPendente: false,
      consentimentoEm: '2026-09-22T14:08:00Z',
      versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
    };
  }

  function responderAbertura(id: string) {
    httpMock.expectOne(`/conversas/${id}/mensagens`).flush({
      conversaId: id,
      resposta: 'Oi! Sou a Lia, da Solar.',
      intencao: 'indefinida',
      proximaAcao: 'continuar_conversa',
      perfilLead: null,
      imoveisSugeridos: [],
      corretor: null,
      contatoPendente: false,
      agendamento: null,
    });
  }

  describe('sem conta', () => {
    it('abre pedindo o consentimento, como hoje, sem coluna de histórico nem chamada à conta', () => {
      const fixture = TestBed.createComponent(Chat);
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-aviso-consentimento')).toBeTruthy();
      expect(texto(fixture)).toContain('processarão as mensagens que você enviar');
      expect(html(fixture).querySelector('app-historico-conversas')).toBeNull();
      expect(html(fixture).querySelector('.botao-conversas')).toBeNull();
      httpMock.expectNone('/api/conta');
      httpMock.expectNone('/api/conta/conversas');
    });

    it('o convite só aparece depois da primeira resposta da Lia a quem escreveu', () => {
      const fixture = TestBed.createComponent(Chat);
      fixture.detectChanges();
      const store = TestBed.inject(ConversaStore);
      store.estado.set('conversando');
      store.itens.set([
        {
          tipo: 'lia',
          id: 'i1',
          texto: 'Oi!',
          hora: '14:00',
          imoveis: [],
          intencao: null,
          revelar: false,
        },
      ]);
      fixture.detectChanges();
      expect(html(fixture).querySelector('.convite')).toBeNull();

      store.itens.update((itens) => [
        ...itens,
        { tipo: 'pessoa', id: 'i2', texto: 'Para morar, 2 quartos.', hora: '14:01' },
      ]);
      fixture.detectChanges();
      expect(html(fixture).querySelector('.convite')).toBeNull();

      store.itens.update((itens) => [
        ...itens,
        {
          tipo: 'lia',
          id: 'i3',
          texto: 'Boa!',
          hora: '14:01',
          imoveis: [],
          intencao: null,
          revelar: false,
        },
      ]);
      fixture.detectChanges();

      const convite = html(fixture).querySelector('.convite')!;
      expect(convite.querySelector('.convite-longo')?.textContent).toBe(
        'Quer guardar esta conversa?',
      );
      expect(convite.querySelector('a')?.getAttribute('href')).toBe('/cadastro');
      expect(html(fixture).querySelector('app-composer')).toBeTruthy();
    });

    it('dispensar esconde o convite desta conversa de vez', () => {
      const fixture = TestBed.createComponent(Chat);
      fixture.detectChanges();
      const store = TestBed.inject(ConversaStore);
      store.conversaAtual.set('conv-anonima');
      store.estado.set('conversando');
      store.itens.set([
        { tipo: 'pessoa', id: 'i1', texto: 'Oi', hora: '14:01' },
        {
          tipo: 'lia',
          id: 'i2',
          texto: 'Oi!',
          hora: '14:01',
          imoveis: [],
          intencao: null,
          revelar: false,
        },
      ]);
      fixture.detectChanges();

      html(fixture).querySelector<HTMLButtonElement>('.convite-fechar')!.click();
      fixture.detectChanges();

      expect(html(fixture).querySelector('.convite')).toBeNull();
      expect(localStorage.getItem('solar.conviteDispensado')).toBe('conv-anonima');

      store.conversaAtual.set('outra-conversa');
      fixture.detectChanges();
      expect(html(fixture).querySelector('.convite')).toBeTruthy();
    });
  });

  describe('com conta de cliente', () => {
    it('mostra "Suas conversas" com Nova conversa, agrupadas em Hoje e Antes', () => {
      const fixture = montarCliente(null);
      const coluna = html(fixture).querySelector('.coluna-historico nav')!;

      expect(coluna.getAttribute('aria-label')).toBe('Suas conversas');
      expect(coluna.querySelector('.nova')?.textContent?.trim()).toBe('+ Nova conversa');
      expect(Array.from(coluna.querySelectorAll('.grupo')).map((g) => g.textContent)).toEqual([
        'Hoje',
        'Antes',
      ]);
      const itens = Array.from(coluna.querySelectorAll('.conversa')).map(
        (c) => `${c.querySelector('b')?.textContent} ${c.querySelector('span')?.textContent}`,
      );
      expect(itens).toEqual([
        `2 quartos na zona sul ${horaDe(AGORA)} · em andamento`,
        'Studio para investir no Centro 12 set · com corretor',
        'Casa com quintal, zona norte 28 ago · encerrada',
      ]);
      expect(html(fixture).querySelector('.convite')).toBeNull();
    });

    it('abrir uma conversa carrega a transcrição dela e a marca como ativa', fakeAsync(() => {
      const fixture = montarCliente(null);

      html(fixture).querySelectorAll<HTMLButtonElement>('.coluna-historico .conversa')[1].click();
      const req = httpMock.expectOne('/conversas/conv-antiga');
      expect(req.request.method).toBe('GET');
      req.flush({
        ...conversaVazia('conv-antiga'),
        mensagens: [
          {
            papel: 'lead',
            texto: 'Quero um studio para investir.',
            em: '2025-09-12T15:00:00Z',
            proximaAcao: null,
            corretor: null,
            agendamento: null,
          },
          {
            papel: 'agente',
            texto: 'Separei dois studios no Centro.',
            em: '2025-09-12T15:00:05Z',
            proximaAcao: 'continuar_conversa',
            corretor: null,
            agendamento: null,
          },
        ],
      });
      tick();
      fixture.detectChanges();

      expect(localStorage.getItem('solar.conversaId')).toBe('conv-antiga');
      expect(texto(fixture)).toContain('Separei dois studios no Centro.');
      const ativa = html(fixture).querySelector('.coluna-historico .conversa.ativa');
      expect(ativa?.textContent).toContain('Studio para investir no Centro');
      expect(ativa?.getAttribute('aria-current')).toBe('true');
      httpMock.match(() => true);
      TestBed.inject(ConversaStore).pararPolling();
      flush();
    }));

    it('com o consentimento da conta na versão vigente, a conversa nova registra a anuência sem mostrar o aviso', fakeAsync(() => {
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      tick();

      const consentimento = httpMock.expectOne(
        (r) => r.method === 'POST' && /\/conversas\/[^/]+\/consentimento$/.test(r.url),
      );
      expect(consentimento.request.body).toEqual({
        versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
      });
      const id = consentimento.request.url.split('/')[2];
      consentimento.flush({});
      tick();
      httpMock.expectOne(`/conversas/${id}`).flush(conversaVazia(id));
      tick();
      responderAbertura(id);
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-aviso-consentimento')).toBeNull();
      expect(texto(fixture)).toContain('Oi! Sou a Lia, da Solar.');
      httpMock.match(() => true);
      TestBed.inject(ConversaStore).pararPolling();
      flush();
    }));

    it('com versão de consentimento divergente, pede o consentimento como hoje', fakeAsync(() => {
      const fixture = montarCliente('2025-01-01');
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-aviso-consentimento')).toBeTruthy();
      httpMock.expectNone((r) => r.url.endsWith('/consentimento'));
    }));

    it('+ Nova conversa abre outra conversa com a anuência da conta', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-hoje');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      httpMock.expectOne('/conversas/conv-hoje').flush(conversaVazia('conv-hoje'));
      tick();
      responderAbertura('conv-hoje');
      tick();

      html(fixture).querySelector<HTMLButtonElement>('.coluna-historico .nova')!.click();
      tick();

      expect(localStorage.getItem('solar.conversaId')).not.toBe('conv-hoje');
      const consentimento = httpMock.expectOne((r) => r.url.endsWith('/consentimento'));
      expect(consentimento.request.url).not.toContain('conv-hoje');
      httpMock.match(() => true);
      TestBed.inject(ConversaStore).pararPolling();
      flush();
    }));

    it('no celular, Conversas abre a lista com "+ Nova" e o horário de hoje por extenso', () => {
      const fixture = montarCliente(null);

      html(fixture).querySelector<HTMLButtonElement>('.botao-conversas')!.click();
      fixture.detectChanges();

      const lista = html(fixture).querySelector('.lista-historico nav')!;
      expect(lista.querySelector('h2')?.textContent).toBe('Conversas');
      expect(lista.querySelector('.nova')?.textContent?.trim()).toBe('+ Nova');
      expect(lista.querySelector('.grupo')).toBeNull();
      expect(lista.querySelector('.conversa span')?.textContent).toBe(
        `hoje, ${horaDe(AGORA)} · em andamento`,
      );
      expect(html(fixture).querySelector('.palco')).toBeNull();
    });

    for (const tema of TEMAS) {
      it(`no tema ${tema}, a conversa ativa usa a cor de marca do tema`, fakeAsync(() => {
        aplicarTema(tema);
        localStorage.setItem('solar.conversaId', 'conv-hoje');
        const fixture = montarCliente(null);
        httpMock.expectOne('/conversas/conv-hoje').flush(conversaVazia('conv-hoje'));
        tick();
        fixture.detectChanges();

        const titulo = html(fixture).querySelector<HTMLElement>('.conversa.ativa b')!;
        expect(getComputedStyle(titulo).color).toBe(MARCA_POR_TEMA[tema]);
        httpMock.match(() => true);
        TestBed.inject(ConversaStore).pararPolling();
        flush();
      }));
    }
  });
});
