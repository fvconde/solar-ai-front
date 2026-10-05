import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ContaResponse, ConversaResumo } from '../conta/conta-contrato';
import {
  ExclusaoTitularResponse,
  MensagemDaConversa,
  ProximaAcao,
  VERSAO_AVISO_PRIVACIDADE,
} from '../conversa/contrato';
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

function mockSucessoExclusao(
  escopo: 'lead_e_vinculos' | 'apenas_conversa' = 'apenas_conversa',
): ExclusaoTitularResponse {
  return {
    leadExcluido: escopo === 'lead_e_vinculos',
    removidoEm: '2026-10-04T14:00:00Z',
    escopo,
    mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
  };
}

function conversaComMensagens(id: string, mensagens?: MensagemDaConversa[]) {
  return {
    conversaId: id,
    perfilLead: null,
    mensagens: mensagens ?? [
      {
        papel: 'lead' as const,
        texto: 'Olá, busco apartamento.',
        em: '2026-09-22T14:08:00Z',
        proximaAcao: null,
        corretor: null,
        agendamento: null,
      },
      {
        papel: 'agente' as const,
        texto: 'Olá! Encontrei ótimas opções.',
        em: '2026-09-22T14:08:05Z',
        proximaAcao: 'continuar_conversa' as ProximaAcao,
        corretor: null,
        agendamento: null,
      },
    ],
    contatoPendente: false,
    consentimentoEm: '2026-09-22T14:08:00Z',
    versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
  };
}

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

  describe('apagar conversa', () => {
    it('sem conta e no início com aceite pendente, rodapé não exibe o botão Apagar conversa', () => {
      const fixture = TestBed.createComponent(Chat);
      fixture.detectChanges();

      const nav = html(fixture).querySelector('app-composer nav[aria-label="Seus dados"]');
      expect(nav).toBeTruthy();
      expect(html(fixture).querySelector('app-composer .botao-apagar')).toBeNull();
      httpMock.verify();
    });

    it('sem conta, após consentimento e conversa ativa, exibe o botão Apagar conversa com aria-haspopup="dialog"', () => {
      const fixture = TestBed.createComponent(Chat);
      fixture.detectChanges();
      const store = TestBed.inject(ConversaStore);
      store.conversaAtual.set('conv-anonima');
      store.estado.set('conversando');
      fixture.detectChanges();

      const botao = html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar');
      expect(botao).toBeTruthy();
      expect(botao?.textContent?.trim()).toBe('Apagar conversa');
      expect(botao?.getAttribute('aria-haspopup')).toBe('dialog');
      httpMock.verify();
    });

    it('com conta no início sem conversa ativa, não exibe o botão Apagar conversa', () => {
      const fixture = montarCliente(null);
      expect(html(fixture).querySelector('app-composer .botao-apagar')).toBeNull();
      httpMock.verify();
    });

    it('com conta e conversa encerrada com composer recolhido, o botão Apagar conversa continua visível e acessível', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-encerrada');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      const req = httpMock.expectOne('/conversas/conv-encerrada');
      expect(req.request.withCredentials).toBeTrue();
      req.flush({
        conversaId: 'conv-encerrada',
        perfilLead: null,
        mensagens: [
          {
            papel: 'lead',
            texto: 'Não tenho mais interesse, obrigado.',
            em: '2025-08-28T14:59:00Z',
            proximaAcao: null,
            corretor: null,
            agendamento: null,
          },
          {
            papel: 'agente',
            texto: 'Atendimento finalizado. Qualquer dúvida estamos à disposição.',
            em: '2025-08-28T15:00:00Z',
            proximaAcao: 'encerrar',
            corretor: null,
            agendamento: null,
          },
        ],
        contatoPendente: false,
        consentimentoEm: '2026-09-22T14:08:00Z',
        versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
      });
      tick();
      fixture.detectChanges();

      const store = TestBed.inject(ConversaStore);
      expect(store.composerRemovido()).toBeTrue();
      expect(store.podeApagarConversa()).toBeTrue();
      expect(html(fixture).querySelector('app-composer textarea')).toBeNull();
      const botao = html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar');
      expect(botao).toBeTruthy();
      expect(botao?.getAttribute('aria-haspopup')).toBe('dialog');
      store.pararPolling();
      httpMock.verify();
      flush();
    }));

    it('clicar em Apagar conversa abre o alertdialog com foco em Cancelar, e Cancelar fecha sem enviar DELETE devolvendo o foco ao gatilho', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-hoje');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      document.body.appendChild(fixture.nativeElement);
      const reqConv = httpMock.expectOne('/conversas/conv-hoje');
      expect(reqConv.request.withCredentials).toBeTrue();
      reqConv.flush(conversaComMensagens('conv-hoje'));
      tick();
      fixture.detectChanges();

      const gatilho = html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!;
      gatilho.click();
      fixture.detectChanges();
      tick();

      const dialog = html(fixture).querySelector('app-confirmacao-exclusao dialog')!;
      expect(dialog).toBeTruthy();
      const painel = html(fixture).querySelector('app-confirmacao-exclusao .painel')!;
      expect(painel.getAttribute('role')).toBe('alertdialog');
      expect(painel.getAttribute('aria-modal')).toBe('true');
      expect(painel.querySelector('#apagar-titulo')?.textContent?.trim()).toBe('Apagar esta conversa?');
      expect(painel.querySelector('#apagar-texto')?.textContent?.trim()).toBe(
        'Esta conversa e suas mensagens serão apagadas definitivamente. Não é possível desfazer.',
      );

      const cancelar = painel.querySelector<HTMLButtonElement>('.botao-cancelar')!;
      expect(document.activeElement).toBe(cancelar);

      cancelar.click();
      fixture.detectChanges();
      tick();

      expect(html(fixture).querySelector('app-confirmacao-exclusao .painel')).toBeNull();
      httpMock.expectNone((r) => r.method === 'DELETE');
      expect(document.activeElement).toBe(gatilho);

      document.body.removeChild(fixture.nativeElement);
      TestBed.inject(ConversaStore).pararPolling();
      httpMock.verify();
      flush();
    }));

    it('durante a requisição de exclusão exibe spinner e loading, desativa cancelamento, ignora segundo clique e impede troca de conversa', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-hoje');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      const reqConv = httpMock.expectOne('/conversas/conv-hoje');
      expect(reqConv.request.withCredentials).toBeTrue();
      reqConv.flush(conversaComMensagens('conv-hoje'));
      tick();
      fixture.detectChanges();

      html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!.click();
      fixture.detectChanges();
      tick();

      const botaoAcao = html(fixture).querySelector<HTMLButtonElement>(
        'app-confirmacao-exclusao .botao-destrutivo',
      )!;
      botaoAcao.click();
      fixture.detectChanges();

      const deleteReq = httpMock.expectOne('/conversas/conv-hoje/titular');
      expect(deleteReq.request.method).toBe('DELETE');
      expect(deleteReq.request.withCredentials).toBeTrue();

      const painel = html(fixture).querySelector('app-confirmacao-exclusao .painel')!;
      expect(painel.getAttribute('aria-busy')).toBe('true');
      expect(painel.querySelector<HTMLButtonElement>('.botao-cancelar')?.disabled).toBeTrue();

      const botaoCarregando = html(fixture).querySelector<HTMLButtonElement>(
        'app-confirmacao-exclusao .botao-destrutivo.carregando',
      )!;
      expect(botaoCarregando).toBeTruthy();
      expect(botaoCarregando.getAttribute('aria-disabled')).toBe('true');
      expect(botaoCarregando.textContent).toContain('Apagando…');
      expect(botaoCarregando.querySelector('.spinner')).toBeTruthy();
      expect(painel.querySelector('p[role="status"]')?.textContent?.trim()).toBe('Apagando a conversa…');

      botaoCarregando.click();
      fixture.detectChanges();
      httpMock.expectNone('/conversas/conv-hoje/titular');

      const dialog = html(fixture).querySelector('app-confirmacao-exclusao dialog')!;
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(html(fixture).querySelector('app-confirmacao-exclusao .painel')).toBeTruthy();

      html(fixture).querySelector<HTMLButtonElement>('.coluna-historico .nova')!.click();
      fixture.detectChanges();
      httpMock.expectNone((r) => r.url.endsWith('/consentimento'));

      deleteReq.flush(mockSucessoExclusao('apenas_conversa'));
      tick();
      fixture.detectChanges();

      TestBed.inject(ConversaStore).pararPolling();
      httpMock.verify();
      flush();
    }));

    it('falha confirmada na exclusão (403) mantém o modal aberto com alerta, foco em Tentar de novo, e permite reenvio bem-sucedido', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-hoje');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      document.body.appendChild(fixture.nativeElement);
      const reqConv = httpMock.expectOne('/conversas/conv-hoje');
      expect(reqConv.request.withCredentials).toBeTrue();
      reqConv.flush(conversaComMensagens('conv-hoje'));
      tick();
      fixture.detectChanges();

      html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!.click();
      fixture.detectChanges();
      tick();

      html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!.click();
      fixture.detectChanges();

      const req = httpMock.expectOne('/conversas/conv-hoje/titular');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ erro: 'conversa_com_corretor' }, { status: 403, statusText: 'Forbidden' });
      tick();
      fixture.detectChanges();
      tick();

      expect(html(fixture).querySelector('app-confirmacao-exclusao .painel')).toBeTruthy();
      const alerta = html(fixture).querySelector('app-confirmacao-exclusao [role="alert"]')!;
      expect(alerta).toBeTruthy();
      expect(alerta.querySelector('.negrito-erro')?.textContent?.trim()).toBe('Não foi possível apagar.');
      expect(alerta.textContent).toContain('A conversa continua como estava. Confira sua conexão e tente de novo.');

      const retryBtn = html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!;
      expect(retryBtn.textContent?.trim()).toBe('Tentar de novo');
      expect(document.activeElement).toBe(retryBtn);

      retryBtn.click();
      fixture.detectChanges();
      const req2 = httpMock.expectOne('/conversas/conv-hoje/titular');
      expect(req2.request.method).toBe('DELETE');
      expect(req2.request.withCredentials).toBeTrue();
      req2.flush(mockSucessoExclusao('apenas_conversa'));
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-confirmacao-exclusao .painel')).toBeNull();

      document.body.removeChild(fixture.nativeElement);
      TestBed.inject(ConversaStore).pararPolling();
      httpMock.verify();
      flush();
    }));

    it('falha incerta de rede mantém o modal com mensagem específica sem negrito e permite retry', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-hoje');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      document.body.appendChild(fixture.nativeElement);
      const reqConv = httpMock.expectOne('/conversas/conv-hoje');
      expect(reqConv.request.withCredentials).toBeTrue();
      reqConv.flush(conversaComMensagens('conv-hoje'));
      tick();
      fixture.detectChanges();

      html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!.click();
      fixture.detectChanges();
      tick();

      html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!.click();
      fixture.detectChanges();

      const reqDelete = httpMock.expectOne('/conversas/conv-hoje/titular');
      expect(reqDelete.request.method).toBe('DELETE');
      expect(reqDelete.request.withCredentials).toBeTrue();
      reqDelete.error(new ProgressEvent('error'));
      tick();

      const reqVerificacao = httpMock.expectOne('/conversas/conv-hoje');
      expect(reqVerificacao.request.method).toBe('GET');
      expect(reqVerificacao.request.withCredentials).toBeTrue();
      reqVerificacao.flush(null, { status: 404, statusText: 'Not Found' });
      tick();
      fixture.detectChanges();
      tick();

      const alerta = html(fixture).querySelector('app-confirmacao-exclusao [role="alert"]')!;
      expect(alerta).toBeTruthy();
      expect(alerta.querySelector('.negrito-erro')).toBeNull();
      expect(alerta.textContent?.trim()).toBe(
        'Não foi possível confirmar se a conversa foi apagada. Confira sua conexão e tente de novo.',
      );

      const retryBtn = html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!;
      expect(retryBtn.textContent?.trim()).toBe('Tentar de novo');
      expect(document.activeElement).toBe(retryBtn);

      retryBtn.click();
      fixture.detectChanges();
      const reqRetry = httpMock.expectOne('/conversas/conv-hoje/titular');
      expect(reqRetry.request.method).toBe('DELETE');
      expect(reqRetry.request.withCredentials).toBeTrue();
      reqRetry.flush(null, { status: 404, statusText: 'Not Found' });
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-confirmacao-exclusao .painel')).toBeNull();
      expect(html(fixture).querySelector('.banner-apagada')).toBeTruthy();

      document.body.removeChild(fixture.nativeElement);
      TestBed.inject(ConversaStore).pararPolling();
      httpMock.verify();
      flush();
    }));

    it('exclusão bem-sucedida em conta de cliente limpa o composer, remove apenas a conversa apagada da lista e exibe banner com role status e foco', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-hoje');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      document.body.appendChild(fixture.nativeElement);
      const reqConv = httpMock.expectOne('/conversas/conv-hoje');
      expect(reqConv.request.withCredentials).toBeTrue();
      reqConv.flush(conversaComMensagens('conv-hoje'));
      tick();
      fixture.detectChanges();

      const textarea = html(fixture).querySelector<HTMLTextAreaElement>('app-composer textarea')!;
      textarea.value = 'Rascunho de mensagem';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!.click();
      fixture.detectChanges();
      tick();

      html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!.click();
      fixture.detectChanges();

      const reqDelete = httpMock.expectOne('/conversas/conv-hoje/titular');
      expect(reqDelete.request.method).toBe('DELETE');
      expect(reqDelete.request.withCredentials).toBeTrue();
      reqDelete.flush(mockSucessoExclusao('apenas_conversa'));
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-confirmacao-exclusao .painel')).toBeNull();

      const banner = html(fixture).querySelector<HTMLElement>('.banner-apagada')!;
      expect(banner).toBeTruthy();
      expect(banner.getAttribute('role')).toBe('status');
      expect(banner.getAttribute('tabindex')).toBe('-1');
      expect(texto(fixture)).toContain('Conversa apagada');
      expect(texto(fixture)).toContain('A conversa e suas mensagens foram apagadas definitivamente.');
      expect(document.activeElement).toBe(banner);

      const textareaDepois = html(fixture).querySelector<HTMLTextAreaElement>('app-composer textarea');
      if (textareaDepois) {
        expect(textareaDepois.value).toBe('');
      }
      expect(document.activeElement).not.toBe(textareaDepois);

      const titulos = Array.from(html(fixture).querySelectorAll('.coluna-historico .conversa')).map(
        (c) => c.querySelector('b')?.textContent,
      );
      expect(titulos).not.toContain('2 quartos na zona sul');
      expect(titulos).toContain('Studio para investir no Centro');
      expect(titulos).toContain('Casa com quintal, zona norte');

      const store = TestBed.inject(ConversaStore);
      expect(store.estado()).toBe('inicio-conta');
      expect(store.conversaAtual()).toBe('');

      document.body.removeChild(fixture.nativeElement);
      store.pararPolling();
      httpMock.verify();
      flush();
    }));

    it('DELETE retornando 404 é tratado como sucesso, exibindo banner e fechando modal', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-antiga');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      const reqConv = httpMock.expectOne('/conversas/conv-antiga');
      expect(reqConv.request.withCredentials).toBeTrue();
      reqConv.flush(conversaComMensagens('conv-antiga'));
      tick();
      fixture.detectChanges();

      html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!.click();
      fixture.detectChanges();
      tick();

      html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!.click();
      fixture.detectChanges();

      const reqDelete = httpMock.expectOne('/conversas/conv-antiga/titular');
      expect(reqDelete.request.method).toBe('DELETE');
      expect(reqDelete.request.withCredentials).toBeTrue();
      reqDelete.flush(null, { status: 404, statusText: 'Not Found' });
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-confirmacao-exclusao .painel')).toBeNull();
      expect(html(fixture).querySelector('.banner-apagada')).toBeTruthy();

      TestBed.inject(ConversaStore).pararPolling();
      httpMock.verify();
      flush();
    }));

    it('exclusão no modo anônimo redefine o estado para aceite-pendente, limpa convite dispensado da conversa e não afeta outras chaves', fakeAsync(() => {
      const fixture = TestBed.createComponent(Chat);
      fixture.detectChanges();
      const store = TestBed.inject(ConversaStore);
      store.conversaAtual.set('conv-anonima');
      store.estado.set('conversando');
      store.itens.set([
        { tipo: 'lia', id: 'm1', texto: 'Oi!', hora: '14:00', imoveis: [], intencao: null, revelar: false },
      ]);
      localStorage.setItem('solar.conversaId', 'conv-anonima');
      localStorage.setItem('solar.conviteDispensado', 'conv-anonima');
      localStorage.setItem('outra.preferencia', 'valor-mantido');
      fixture.detectChanges();

      html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!.click();
      fixture.detectChanges();
      tick();

      html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!.click();
      fixture.detectChanges();

      const reqDelete = httpMock.expectOne('/conversas/conv-anonima/titular');
      expect(reqDelete.request.method).toBe('DELETE');
      expect(reqDelete.request.withCredentials).toBeTrue();
      reqDelete.flush(mockSucessoExclusao('lead_e_vinculos'));
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-confirmacao-exclusao .painel')).toBeNull();
      expect(html(fixture).querySelector('.banner-apagada')).toBeTruthy();
      expect(store.estado()).toBe('aceite-pendente');
      expect(store.conversaAtual()).toBe('');

      const consentimento = html(fixture).querySelector('app-aviso-consentimento')!;
      expect(consentimento).toBeTruthy();
      const checkbox = consentimento.querySelector<HTMLInputElement>('input[type="checkbox"]');
      expect(checkbox?.checked).toBeFalse();

      expect(localStorage.getItem('solar.conversaId')).toBeNull();
      expect(localStorage.getItem('solar.conviteDispensado')).toBeNull();
      expect(localStorage.getItem('outra.preferencia')).toBe('valor-mantido');
      localStorage.removeItem('outra.preferencia');

      store.pararPolling();
      httpMock.verify();
      flush();
    }));

    it('resposta tardia de consulta à lista iniciada antes da exclusão não recoloca o id apagado na lista', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-hoje');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      const reqConv = httpMock.expectOne('/conversas/conv-hoje');
      expect(reqConv.request.withCredentials).toBeTrue();
      reqConv.flush(conversaComMensagens('conv-hoje'));
      tick();
      fixture.detectChanges();

      (fixture.componentInstance as unknown as { carregarConversas: () => void }).carregarConversas();
      const reqListaAntiga = httpMock.expectOne('/api/conta/conversas');
      expect(reqListaAntiga.request.withCredentials).toBeTrue();

      html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!.click();
      fixture.detectChanges();
      tick();

      html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!.click();
      fixture.detectChanges();

      const reqDelete = httpMock.expectOne('/conversas/conv-hoje/titular');
      expect(reqDelete.request.method).toBe('DELETE');
      expect(reqDelete.request.withCredentials).toBeTrue();
      reqDelete.flush(mockSucessoExclusao('apenas_conversa'));
      tick();
      fixture.detectChanges();

      reqListaAntiga.flush(conversas);
      tick();
      fixture.detectChanges();

      const ids = fixture.componentInstance.conversas().map((c) => c.id);
      expect(ids).not.toContain('conv-hoje');
      expect(ids.length).toBe(2);

      TestBed.inject(ConversaStore).pararPolling();
      httpMock.verify();
      flush();
    }));

    it('banner de conversa apagada desaparece na próxima ação explícita', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'conv-hoje');
      const fixture = montarCliente(VERSAO_AVISO_PRIVACIDADE);
      const reqConv = httpMock.expectOne('/conversas/conv-hoje');
      expect(reqConv.request.withCredentials).toBeTrue();
      reqConv.flush(conversaComMensagens('conv-hoje'));
      tick();
      fixture.detectChanges();

      html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!.click();
      fixture.detectChanges();
      tick();

      html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!.click();
      fixture.detectChanges();

      const reqDelete = httpMock.expectOne('/conversas/conv-hoje/titular');
      expect(reqDelete.request.method).toBe('DELETE');
      expect(reqDelete.request.withCredentials).toBeTrue();
      reqDelete.flush(mockSucessoExclusao('apenas_conversa'));
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('.banner-apagada')).toBeTruthy();

      html(fixture).querySelector<HTMLButtonElement>('.coluna-historico .nova')!.click();
      tick();
      const reqConsent = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/consentimento'));
      reqConsent.flush({});
      tick();
      const newId = reqConsent.request.url.split('/')[2];
      httpMock.expectOne(`/conversas/${newId}`).flush(conversaComMensagens(newId));
      tick();
      fixture.detectChanges();

      const reqListaAtualizada = httpMock.expectOne('/api/conta/conversas');
      expect(reqListaAtualizada.request.withCredentials).toBeTrue();
      reqListaAtualizada.flush([
        ...conversas.filter((c) => c.id !== 'conv-hoje'),
        { id: newId, titulo: 'Nova conversa', atualizadaEm: AGORA, estado: 'em_andamento' },
      ]);
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('.banner-apagada')).toBeNull();

      TestBed.inject(ConversaStore).pararPolling();
      httpMock.verify();
      flush();
    }));
  });
});
