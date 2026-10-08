import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { FormularioContato } from '../componentes/formulario-contato';
import { ContaResponse, ConversaResumo } from '../conta/conta-contrato';
import {
  AgendamentoDaConversa,
  ExclusaoTitularResponse,
  MensagemDaConversa,
  MensagemResponse,
  ProximaAcao,
  SlotOferecido,
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
  sessaoSupervisor,
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

  describe('integracao de agendamento (T5b)', () => {
    const slotA1: SlotOferecido = {
      id: 101,
      inicio: '2026-10-07T09:00:00-03:00',
      fim: '2026-10-07T10:00:00-03:00',
    };
    const slotA2: SlotOferecido = {
      id: 102,
      inicio: '2026-10-07T14:00:00-03:00',
      fim: '2026-10-07T15:00:00-03:00',
    };
    const slotA3: SlotOferecido = {
      id: 103,
      inicio: '2026-10-07T19:00:00-03:00',
      fim: '2026-10-07T20:00:00-03:00',
    };

    function estiloDoToken(
      variavel: string,
      propriedade: 'color' | 'backgroundColor' | 'borderColor',
    ): string {
      const probe = document.createElement('div');
      if (propriedade === 'backgroundColor') {
        probe.style.backgroundColor = `var(${variavel})`;
      } else if (propriedade === 'borderColor') {
        probe.style.borderStyle = 'solid';
        probe.style.borderWidth = '1px';
        probe.style.borderColor = `var(${variavel})`;
      } else {
        probe.style.color = `var(${variavel})`;
      }
      document.body.appendChild(probe);
      const valor = window.getComputedStyle(probe)[propriedade];
      document.body.removeChild(probe);
      return valor;
    }

    function conversaComOferta(
      id: string,
      oferta: SlotOferecido[],
      corretor: string | null = 'Helena Braga',
      contatoPendente = false,
      agendamento: AgendamentoDaConversa | null = null,
      mensagens?: MensagemDaConversa[],
      consentimentoEm: string | null = '2026-10-07T10:00:00Z',
      versaoAvisoPrivacidade: string | null = VERSAO_AVISO_PRIVACIDADE,
      contatoEm: string | null = null,
    ) {
      return {
        conversaId: id,
        perfilLead: null,
        mensagens: mensagens ?? [
          {
            papel: 'lead' as const,
            texto: 'Quero um apartamento.',
            em: '2026-10-07T10:00:00Z',
            proximaAcao: null,
            corretor: null,
            agendamento: null,
          },
          {
            papel: 'agente' as const,
            texto: 'Encaminhando para Helena Braga.',
            em: '2026-10-07T10:01:00Z',
            proximaAcao: 'agendar_reuniao' as ProximaAcao,
            corretor,
            agendamento,
          },
        ],
        contatoPendente,
        consentimentoEm,
        versaoAvisoPrivacidade,
        oferta,
        contatoEm,
      };
    }

    it('renderiza Card quando GET traz conversa elegivel e oculta quando faltam condicoes', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-elegivel');
      let fixture = TestBed.createComponent(Chat);
      let store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-elegivel').flush(
        conversaComOferta('c-elegivel', [slotA1, slotA2], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-cartao-agendamento')).not.toBeNull();
      expect(html(fixture).querySelector('.avatar')?.textContent?.trim()).toBe('HB');
      expect(html(fixture).querySelectorAll('.slot-botao').length).toBe(2);

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();

      localStorage.setItem('solar.conversaId', 'c-sem-corretor');
      fixture = TestBed.createComponent(Chat);
      store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-sem-corretor').flush(
        conversaComOferta('c-sem-corretor', [slotA1, slotA2], null, false),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-cartao-agendamento')).toBeNull();
      expect(html(fixture).querySelector('.aviso-vazio-neutro')).toBeNull();
      expect(html(fixture).querySelector('.aviso-vazio-atencao')).toBeNull();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();

      localStorage.setItem('solar.conversaId', 'c-sem-consentimento');
      fixture = TestBed.createComponent(Chat);
      store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-sem-consentimento').flush(
        conversaComOferta('c-sem-consentimento', [slotA1, slotA2], 'Helena Braga', false, null, undefined, null, null),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-cartao-agendamento')).toBeNull();
      expect(html(fixture).querySelector('.aviso-vazio-neutro')).toBeNull();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();

      localStorage.setItem('solar.conversaId', 'c-ja-confirmado');
      fixture = TestBed.createComponent(Chat);
      store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-ja-confirmado').flush(
        conversaComOferta(
          'c-ja-confirmado',
          [slotA1, slotA2],
          'Helena Braga',
          false,
          { estado: 'confirmado', horario: slotA1, alternativas: [] },
        ),
      );
      tick();
      fixture.detectChanges();

      const cartaoJaConfirmado = html(fixture).querySelector('app-cartao-agendamento');
      expect(cartaoJaConfirmado).toBeNull();
      const eventosJaConfirmado = Array.from(html(fixture).querySelectorAll('app-evento-sistema'));
      expect(eventosJaConfirmado.some((e) => e.textContent?.includes('Reunião agendada'))).toBeTrue();
      expect(html(fixture).querySelector('.aviso-vazio-neutro')).toBeNull();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('oferta vazia e perda vazia mostram aviso unico sem duplicar e sem card nem botoes', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-vazia');
      let fixture = TestBed.createComponent(Chat);
      let store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-vazia').flush(
        conversaComOferta('c-vazia', [], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('.aviso-vazio-neutro')).not.toBeNull();
      expect(html(fixture).querySelector('.avatar')).toBeNull();
      expect(html(fixture).querySelector('.cartao')).toBeNull();
      expect(html(fixture).querySelectorAll('.slot-botao').length).toBe(0);

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();

      sessionStorage.setItem(
        'solar.agendamentoPerdido.c-perdida-vazia',
        JSON.stringify({ id: 101, inicio: slotA1.inicio, fim: slotA1.fim }),
      );
      localStorage.setItem('solar.conversaId', 'c-perdida-vazia');
      fixture = TestBed.createComponent(Chat);
      store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-perdida-vazia').flush(
        conversaComOferta('c-perdida-vazia', [], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      const avisoAtencao = html(fixture).querySelector('.aviso-vazio-atencao');
      expect(avisoAtencao).not.toBeNull();
      expect(avisoAtencao?.getAttribute('role')).toBe('alert');
      expect(avisoAtencao?.textContent).toContain('Não há horários disponíveis no momento.');
      expect(avisoAtencao?.textContent).not.toContain('Estes ainda estão livres');
      expect(html(fixture).querySelectorAll('.aviso-vazio-neutro').length).toBe(0);

      sessionStorage.removeItem('solar.agendamentoPerdido.c-perdida-vazia');
      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('formulario de contato apos submissao 200 com oferta exibe o Card sem disparar POST de mensagens', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-contato');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-contato').flush(
        conversaComOferta('c-contato', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      httpMock.expectNone('/conversas/c-contato/mensagens');
      expect(html(fixture).querySelector('app-formulario-contato')).not.toBeNull();
      expect(html(fixture).querySelector('app-cartao-agendamento')).toBeNull();

      const formDebug = fixture.debugElement.query(By.directive(FormularioContato));
      formDebug.componentInstance.enviar.emit({
        nome: 'Marina Couto',
        telefone: '11987654321',
        email: 'marina@email.com',
      });
      tick();
      fixture.detectChanges();

      const reqContato = httpMock.expectOne('/conversas/c-contato/contato');
      expect(reqContato.request.method).toBe('POST');
      expect(reqContato.request.body).toEqual({
        nome: 'Marina Couto',
        telefone: '11987654321',
        email: 'marina@email.com',
      });
      reqContato.flush({
        leadId: 'lead-c-contato',
        oferta: [slotA1, slotA2],
      });
      tick();
      fixture.detectChanges();

      httpMock.expectNone('/conversas/c-contato/mensagens');
      expect(html(fixture).querySelector('app-cartao-agendamento')).not.toBeNull();
      expect(html(fixture).querySelectorAll('.slot-botao').length).toBe(2);

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('clique em slot envia POST agendamentos, desabilita controles e exibe confirmacao compacta apos reconciliacao', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-slot-post');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-slot-post').flush(
        conversaComOferta('c-slot-post', [slotA1, slotA2], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      const primeiroSlot = html(fixture).querySelector('.slot-botao') as HTMLButtonElement;
      primeiroSlot.click();
      fixture.detectChanges();

      const reqPost = httpMock.expectOne('/conversas/c-slot-post/agendamentos');
      expect(reqPost.request.method).toBe('POST');
      expect(reqPost.request.body).toEqual({ slotId: 101 });

      const slots = html(fixture).querySelectorAll('.slot-botao');
      for (const s of Array.from(slots) as HTMLButtonElement[]) {
        expect(s.disabled).toBeTrue();
      }
      const botaoAgoraNao = html(fixture).querySelector('.link-recolher') as HTMLButtonElement;
      expect(botaoAgoraNao.disabled).toBeTrue();
      expect(html(fixture).querySelector('.evento-compacto')).toBeNull();

      reqPost.flush({
        estado: 'confirmado',
        horario: slotA1,
        alternativas: [],
      });
      tick();
      fixture.detectChanges();

      const reqGet = httpMock.expectOne('/conversas/c-slot-post');
      expect(reqGet.request.method).toBe('GET');
      reqGet.flush(
        conversaComOferta(
          'c-slot-post',
          [],
          'Helena Braga',
          false,
          { estado: 'confirmado', horario: slotA1, alternativas: [] },
          [
            {
              papel: 'lead',
              texto: 'Quarta, 7 de outubro às 9h',
              em: '2026-10-07T10:02:00Z',
              proximaAcao: null,
              corretor: null,
              agendamento: null,
            },
            {
              papel: 'agente',
              texto: 'Combinado! Helena Braga vai te chamar no contato que você forneceu no horário agendado.',
              em: '2026-10-07T10:02:00Z',
              proximaAcao: 'agendar_reuniao',
              corretor: 'Helena Braga',
              agendamento: { estado: 'confirmado', horario: slotA1, alternativas: [] },
            },
          ],
        ),
      );
      tick();
      fixture.detectChanges();

      httpMock.expectNone('/conversas/c-slot-post/mensagens');
      const cartaoAposConfirmacao = html(fixture).querySelector('app-cartao-agendamento');
      expect(cartaoAposConfirmacao).toBeNull();

      const eventoCompacto = html(fixture).querySelector('.evento-compacto');
      expect(eventoCompacto).toBeNull();
      expect(html(fixture).querySelectorAll('.icone-check').length).toBe(0);

      const elementosNaColuna = Array.from(html(fixture).querySelector('.coluna')?.children ?? []);
      const elLead = elementosNaColuna.find((el) => el.tagName.toLowerCase() === 'app-mensagem-pessoa');
      const elLia = elementosNaColuna.find((el) => el.tagName.toLowerCase() === 'app-mensagem-lia');
      expect(elLead).toBeUndefined();
      expect(elLia).toBeUndefined();

      const elReuniao = elementosNaColuna.find(
        (el) => el.tagName.toLowerCase() === 'app-evento-sistema' && el.textContent?.includes('Reunião agendada'),
      );
      expect(elReuniao).toBeDefined();
      expect(elReuniao?.textContent).toContain(
        'O corretor entrará em contato no horário agendado: quarta, 7 de outubro, 9h da manhã.',
      );

      const elEvento = elementosNaColuna.find(
        (el) => el.tagName.toLowerCase() === 'app-evento-sistema' && el.textContent?.includes('Contato enviado'),
      );
      expect(elEvento).toBeDefined();
      expect(elEvento?.textContent).toContain('Contato enviado');
      expect(elEvento?.textContent).toContain('O corretor usará o contato que você forneceu.');
      void store.registrarAgendamento(slotA1.id);
      httpMock.expectNone('/conversas/c-slot-post/agendamentos');
      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('resposta 409 horario_indisponivel com alternativas e vazia atualiza card e aviso com role alert', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-409');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-409').flush(
        conversaComOferta('c-409', [slotA1, slotA2], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      const primeiroSlot = html(fixture).querySelector('.slot-botao') as HTMLButtonElement;
      primeiroSlot.click();
      fixture.detectChanges();

      const reqPost = httpMock.expectOne('/conversas/c-409/agendamentos');
      reqPost.flush(
        { codigo: 'horario_indisponivel', oferta: [slotA2] },
        { status: 409, statusText: 'Conflict' },
      );
      tick();
      fixture.detectChanges();

      const aviso = html(fixture).querySelector('.aviso-perda');
      expect(aviso).not.toBeNull();
      expect(aviso?.getAttribute('role')).toBe('alert');
      expect(aviso?.textContent).toContain('O horário das 9h de quarta acabou de ser reservado. Estes ainda estão livres:');
      expect(html(fixture).querySelectorAll('.slot-botao').length).toBe(1);

      const segundoSlot = html(fixture).querySelector('.slot-botao') as HTMLButtonElement;
      segundoSlot.click();
      fixture.detectChanges();

      const reqPost2 = httpMock.expectOne('/conversas/c-409/agendamentos');
      reqPost2.flush(
        { codigo: 'horario_indisponivel', oferta: [] },
        { status: 409, statusText: 'Conflict' },
      );
      tick();
      fixture.detectChanges();

      const avisoVazio = html(fixture).querySelector('.aviso-vazio-atencao');
      expect(avisoVazio).not.toBeNull();
      expect(avisoVazio?.getAttribute('role')).toBe('alert');
      expect(avisoVazio?.textContent).toContain('O horário das 14h de quarta acabou de ser reservado. Não há horários disponíveis no momento.');

      sessionStorage.removeItem('solar.agendamentoPerdido.c-409');
      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('botao Agora nao recolhe para faixa compacta e Ver horario reabre sem requisicoes HTTP', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-recolher');
      let fixture = TestBed.createComponent(Chat);
      let store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-recolher').flush(
        conversaComOferta('c-recolher', [slotA1, slotA2], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      const botaoAgoraNao = html(fixture).querySelector('.link-recolher') as HTMLButtonElement;
      botaoAgoraNao.click();
      fixture.detectChanges();

      const faixa = html(fixture).querySelector('.faixa-recolhida');
      expect(faixa).not.toBeNull();
      expect(faixa?.textContent).toContain('Agendar reunião com Helena Braga');
      expect(html(fixture).querySelector('.cartao')).toBeNull();
      expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c-recolher')).toBe('1');

      const botaoReabrir = html(fixture).querySelector('.link-reabrir') as HTMLButtonElement;
      expect(botaoReabrir?.textContent?.trim()).toBe('Ver horários');
      botaoReabrir.click();
      fixture.detectChanges();

      expect(html(fixture).querySelector('.cartao')).not.toBeNull();
      expect(html(fixture).querySelector('.faixa-recolhida')).toBeNull();
      expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c-recolher')).toBeNull();
      httpMock.expectNone('/conversas/c-recolher');

      const botaoAgoraNao2 = html(fixture).querySelector('.link-recolher') as HTMLButtonElement;
      botaoAgoraNao2.click();
      fixture.detectChanges();
      expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c-recolher')).toBe('1');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();

      fixture = TestBed.createComponent(Chat);
      store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-recolher').flush(
        conversaComOferta('c-recolher', [slotA1, slotA2], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('.faixa-recolhida')).not.toBeNull();
      expect(html(fixture).querySelector('.cartao')).toBeNull();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
      sessionStorage.removeItem('solar.agendamentoRecolhido.v1:c-recolher');
    }));

    it('recuperacao GET em falha de reconciliacao preserva fato e permite atualizacao manual sem repetir POST', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-recov');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-recov').flush(
        conversaComOferta('c-recov', [slotA1], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      const slotBtn = html(fixture).querySelector('.slot-botao') as HTMLButtonElement;
      slotBtn.click();
      fixture.detectChanges();

      const reqPost = httpMock.expectOne('/conversas/c-recov/agendamentos');
      reqPost.flush({ estado: 'confirmado', horario: slotA1, alternativas: [] });
      tick();
      fixture.detectChanges();

      const reqGetFalha = httpMock.expectOne('/conversas/c-recov');
      reqGetFalha.flush('Erro servidor', { status: 500, statusText: 'Server Error' });
      tick();
      fixture.detectChanges();

      const avisoErro = html(fixture).querySelector('.aviso-erro-agendamento');
      expect(avisoErro).not.toBeNull();
      expect(avisoErro?.getAttribute('role')).toBe('alert');

      const botaoSinc = html(fixture).querySelector('.botao-sincronizar-agendamento') as HTMLButtonElement;
      expect(botaoSinc.textContent?.trim()).toBe('Atualizar confirmação');

      botaoSinc.click();
      fixture.detectChanges();

      const reqGetRetry = httpMock.expectOne('/conversas/c-recov');
      expect(reqGetRetry.request.method).toBe('GET');
      httpMock.expectNone('/conversas/c-recov/agendamentos');

      reqGetRetry.flush(
        conversaComOferta(
          'c-recov',
          [],
          'Helena Braga',
          false,
          { estado: 'confirmado', horario: slotA1, alternativas: [] },
          [
            {
              papel: 'agente',
              texto: 'Confirmado com Helena Braga.',
              em: '2026-10-07T10:02:05Z',
              proximaAcao: 'continuar_conversa',
              corretor: 'Helena Braga',
              agendamento: { estado: 'confirmado', horario: slotA1, alternativas: [] },
            },
          ],
        ),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('.aviso-erro-agendamento')).toBeNull();
      expect(html(fixture).querySelector('.evento-compacto')).toBeNull();
      const cartaoRecuperado = html(fixture).querySelector('app-cartao-agendamento');
      expect(cartaoRecuperado).toBeNull();
      const eventos = Array.from(html(fixture).querySelectorAll('app-evento-sistema'));
      expect(eventos.some((e) => e.textContent?.includes('Reunião agendada'))).toBeTrue();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('recuperacao sem confirmacao (POST 500 e GET 500) nao exibe confirmacao e sincroniza horarios via GET', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-recov-sem-conf');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-recov-sem-conf').flush(
        conversaComOferta('c-recov-sem-conf', [slotA1, slotA2], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      const slotBtn = html(fixture).querySelector('.slot-botao') as HTMLButtonElement;
      slotBtn.click();
      fixture.detectChanges();

      const reqPostFalha = httpMock.expectOne('/conversas/c-recov-sem-conf/agendamentos');
      reqPostFalha.flush('Erro servidor no agendamento', { status: 500, statusText: 'Server Error' });
      tick();
      fixture.detectChanges();

      const reqGetReconcilia = httpMock.expectOne('/conversas/c-recov-sem-conf');
      reqGetReconcilia.flush('Erro servidor no GET', { status: 500, statusText: 'Server Error' });
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('.evento-compacto')).toBeNull();
      expect(html(fixture).querySelector('.status-confirmacao')).toBeNull();

      const avisoErro = html(fixture).querySelector('.aviso-erro-agendamento');
      expect(avisoErro).not.toBeNull();
      expect(avisoErro?.getAttribute('role')).toBe('alert');

      const botaoSinc = html(fixture).querySelector('.botao-sincronizar-agendamento') as HTMLButtonElement;
      expect(botaoSinc).not.toBeNull();
      expect(botaoSinc.textContent?.trim()).toBe('Atualizar horários');

      const slotsBloqueados = html(fixture).querySelectorAll('.slot-botao');
      for (const s of Array.from(slotsBloqueados) as HTMLButtonElement[]) {
        expect(s.disabled).toBeTrue();
      }

      botaoSinc.click();
      fixture.detectChanges();

      const reqGetSinc = httpMock.expectOne('/conversas/c-recov-sem-conf');
      expect(reqGetSinc.request.method).toBe('GET');
      httpMock.expectNone('/conversas/c-recov-sem-conf/agendamentos');
      httpMock.expectNone('/conversas/c-recov-sem-conf/mensagens');

      expect(botaoSinc.disabled).toBeTrue();

      reqGetSinc.flush(
        conversaComOferta('c-recov-sem-conf', [slotA1, slotA2], 'Helena Braga', false),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-cartao-agendamento')).not.toBeNull();
      const slotsAtivos = html(fixture).querySelectorAll('.slot-botao');
      expect(slotsAtivos.length).toBe(2);
      expect((slotsAtivos[0] as HTMLButtonElement).disabled).toBeFalse();
      expect(html(fixture).querySelector('.botao-sincronizar-agendamento')).toBeNull();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('geometria estreita quebra slots sem overflow e adapta cores nos dois temas', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-narrow');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      const hostEl = html(fixture);
      hostEl.style.width = '320px';
      document.body.appendChild(hostEl);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-narrow').flush(
        conversaComOferta('c-narrow', [slotA1, slotA2, slotA3], 'Helena Maria da Silva Braga de Vasconcelos', false),
      );
      tick();
      fixture.detectChanges();

      const cartao = hostEl.querySelector('.cartao') as HTMLElement;
      expect(cartao).not.toBeNull();
      expect(cartao.scrollWidth).toBeLessThanOrEqual(cartao.clientWidth + 2);

      const botoes = hostEl.querySelectorAll('.slot-botao');
      expect(botoes.length).toBe(3);
      const b1 = botoes[0] as HTMLElement;
      const b3 = botoes[2] as HTMLElement;

      const rect1 = b1.getBoundingClientRect();
      expect(rect1.width).toBeGreaterThanOrEqual(70);
      expect(rect1.width).toBeLessThanOrEqual(80);
      expect(rect1.height).toBeGreaterThanOrEqual(50);
      expect(rect1.height).toBeLessThanOrEqual(60);

      expect(b3.offsetTop).toBeGreaterThan(b1.offsetTop);

      document.documentElement.setAttribute('data-tema', 'claro');
      fixture.detectChanges();
      const estiloCartaoClaro = window.getComputedStyle(cartao);
      expect(estiloCartaoClaro.backgroundColor).toBe(
        estiloDoToken('--superficie-elevada', 'backgroundColor'),
      );
      expect(estiloCartaoClaro.borderColor).toBe(
        estiloDoToken('--borda-componente', 'borderColor'),
      );
      expect(estiloCartaoClaro.color).toBe(
        estiloDoToken('--texto-primario', 'color'),
      );

      document.documentElement.setAttribute('data-tema', 'escuro');
      fixture.detectChanges();
      const estiloCartaoEscuro = window.getComputedStyle(cartao);
      expect(estiloCartaoEscuro.backgroundColor).toBe(
        estiloDoToken('--superficie-elevada', 'backgroundColor'),
      );
      expect(estiloCartaoEscuro.borderColor).toBe(
        estiloDoToken('--borda-componente', 'borderColor'),
      );
      expect(estiloCartaoEscuro.color).toBe(
        estiloDoToken('--texto-primario', 'color'),
      );

      document.documentElement.removeAttribute('data-tema');
      store.pararPolling();
      httpMock.verify();
      if (hostEl.parentNode) {
        document.body.removeChild(hostEl);
      }
      fixture.destroy();
      flush();
    }));

    it('geometria wide e mobile alinha cartao ofertado a esquerda da coluna com diferenca menor ou igual a 1px nos dois temas', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-wide');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      const hostEl = html(fixture);
      hostEl.style.width = '960px';
      hostEl.style.display = 'block';
      document.body.appendChild(hostEl);
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-wide').flush(
        conversaComOferta(
          'c-wide',
          [slotA1, slotA2],
          'Helena Braga',
          false,
        ),
      );
      tick();
      fixture.detectChanges();

      const coluna = hostEl.querySelector('.coluna') as HTMLElement;
      const cartaoHost = hostEl.querySelector('app-cartao-agendamento') as HTMLElement;
      expect(coluna).not.toBeNull();
      expect(cartaoHost).not.toBeNull();
      expect(hostEl.querySelector('.evento-compacto')).toBeNull();

      for (const tema of ['claro', 'escuro']) {
        document.documentElement.setAttribute('data-tema', tema);
        fixture.detectChanges();

        hostEl.style.width = '960px';
        fixture.detectChanges();
        const paddingWide = parseFloat(window.getComputedStyle(coluna).paddingLeft);
        const rectColunaWide = coluna.getBoundingClientRect();
        const rectCartaoWide = cartaoHost.getBoundingClientRect();
        expect(Math.abs(rectColunaWide.left + paddingWide - rectCartaoWide.left)).toBeLessThanOrEqual(1);

        hostEl.style.width = '320px';
        fixture.detectChanges();
        const paddingMobile = parseFloat(window.getComputedStyle(coluna).paddingLeft);
        const rectColunaMobile = coluna.getBoundingClientRect();
        const rectCartaoMobile = cartaoHost.getBoundingClientRect();
        expect(Math.abs(rectColunaMobile.left + paddingMobile - rectCartaoMobile.left)).toBeLessThanOrEqual(1);
      }

      document.documentElement.removeAttribute('data-tema');
      store.pararPolling();
      httpMock.verify();
      if (hostEl.parentNode) {
        document.body.removeChild(hostEl);
      }
      fixture.destroy();
      flush();
    }));

    it('scroll acompanha novas mensagens mas nao salta para o fundo ao receber polling com mesma oferta', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-scroll');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      const hostEl = html(fixture);
      hostEl.style.height = '350px';
      hostEl.style.display = 'flex';
      document.body.appendChild(hostEl);
      fixture.detectChanges();

      const muitasMensagens: MensagemDaConversa[] = [];
      for (let i = 0; i < 20; i++) {
        muitasMensagens.push({
          papel: i % 2 === 0 ? 'lead' : 'agente',
          texto: `Mensagem longa de teste de scroll numero ${i} para gerar overflow no palco`,
          em: `2026-10-07T10:${i < 10 ? '0' + i : i}:00Z`,
          proximaAcao: i === 19 ? 'agendar_reuniao' : null,
          corretor: i === 19 ? 'Helena Braga' : null,
          agendamento: null,
        });
      }

      httpMock.expectOne('/conversas/c-scroll').flush(
        conversaComOferta('c-scroll', [slotA1, slotA2], 'Helena Braga', false, null, muitasMensagens),
      );
      tick();
      fixture.detectChanges();

      const palco = hostEl.querySelector('.palco') as HTMLElement;
      expect(palco).not.toBeNull();
      expect(palco.scrollHeight).toBeGreaterThan(palco.clientHeight);
      expect(palco.scrollTop).toBeGreaterThan(0);

      palco.scrollTop = 0;
      expect(palco.scrollTop).toBe(0);

      store.ofertaAgendamento.set([{ ...slotA1 }, { ...slotA2 }]);
      fixture.detectChanges();
      tick();

      expect(palco.scrollTop).toBe(0);

      store.itens.update((itens) => [
        ...itens,
        { tipo: 'pessoa', id: 'nova-msg', texto: 'Nova pergunta do lead', hora: '10:30' },
      ]);
      fixture.detectChanges();
      tick();

      expect(palco.scrollTop).toBe(0);

      palco.scrollTop = palco.scrollHeight;
      const alturaAntes = palco.scrollHeight;
      store.itens.update((itens) => [
        ...itens,
        { tipo: 'pessoa', id: 'nova-msg-2', texto: 'Outra pergunta do lead', hora: '10:31' },
      ]);
      fixture.detectChanges();
      tick();

      expect(palco.scrollHeight).toBeGreaterThan(alturaAntes);
      expect(palco.scrollHeight - palco.clientHeight - palco.scrollTop).toBeLessThanOrEqual(1);

      store.pararPolling();
      httpMock.verify();
      if (hostEl.parentNode) {
        document.body.removeChild(hostEl);
      }
      fixture.destroy();
      flush();
    }));

    describe('item 12: rolagem do leitor', () => {
      const confItem12: AgendamentoDaConversa = {
        estado: 'confirmado',
        horario: slotA1,
        alternativas: [],
      };

      function historicoLongo(confirmado: AgendamentoDaConversa | null): MensagemDaConversa[] {
        const mensagens: MensagemDaConversa[] = [];
        for (let i = 0; i < 24; i++) {
          mensagens.push({
            papel: i % 2 === 0 ? 'lead' : 'agente',
            texto: `Mensagem longa de teste de rolagem numero ${i} para gerar overflow no palco`,
            em: `2026-10-07T10:${String(i).padStart(2, '0')}:00Z`,
            proximaAcao: i === 1 ? 'agendar_reuniao' : null,
            corretor: i === 1 ? 'Helena Braga' : null,
            agendamento: null,
          });
        }
        if (confirmado) {
          mensagens.push(
            {
              papel: 'lead',
              texto: 'Quarta, 7 de outubro às 9h',
              em: '2026-10-07T10:40:00Z',
              proximaAcao: null,
              corretor: null,
              agendamento: null,
            },
            {
              papel: 'agente',
              texto:
                'Combinado! Helena Braga vai te chamar no contato que você forneceu no horário agendado.',
              em: '2026-10-07T10:40:05Z',
              proximaAcao: 'continuar_conversa',
              corretor: 'Helena Braga',
              agendamento: confirmado,
            },
          );
        }
        return mensagens;
      }

      function mensagemNova(n: number, proximaAcao: ProximaAcao | null = null): MensagemDaConversa {
        return {
          papel: 'agente',
          texto: `Resposta nova ${n} ${'com bastante texto para ocupar varias linhas no palco '.repeat(8)}`,
          em: `2026-10-07T11:${String(n).padStart(2, '0')}:00Z`,
          proximaAcao,
          corretor: 'Helena Braga',
          agendamento: null,
        };
      }

      const slotOutroDia: SlotOferecido = {
        id: 104,
        inicio: '2026-10-08T09:00:00-03:00',
        fim: '2026-10-08T10:00:00-03:00',
      };

      function distancia(palco: HTMLElement): number {
        return palco.scrollHeight - palco.clientHeight - palco.scrollTop;
      }

      function maximo(palco: HTMLElement): number {
        return palco.scrollHeight - palco.clientHeight;
      }

      function montarPalco(
        id: string,
        opcoes: {
          confirmado?: boolean;
          oferta?: SlotOferecido[];
          contatoPendente?: boolean;
          altura?: string;
        } = {},
      ) {
        const mensagens = historicoLongo(opcoes.confirmado ? confItem12 : null);
        let oferta = opcoes.oferta ?? [];
        const contatoPendente = opcoes.contatoPendente ?? false;
        localStorage.setItem('solar.conversaId', id);
        const fixture = TestBed.createComponent(Chat);
        const store = TestBed.inject(ConversaStore);
        const hostEl = html(fixture);
        hostEl.style.height = opcoes.altura ?? '350px';
        hostEl.style.display = 'flex';
        document.body.appendChild(hostEl);
        fixture.autoDetectChanges(true);

        const corpo = () =>
          conversaComOferta(
            id,
            oferta.map((s) => ({ ...s })),
            'Helena Braga',
            contatoPendente,
            null,
            structuredClone(mensagens),
          );

        httpMock.expectOne(`/conversas/${id}`).flush(corpo());
        if ((globalThis as any).Zone?.current?.get('FakeAsyncTestZoneSpec')) {
          tick();
        }
        fixture.detectChanges();

        const palco = hostEl.querySelector('.palco') as HTMLElement;
        expect(palco).not.toBeNull();
        expect(palco.scrollHeight).toBeGreaterThan(palco.clientHeight + 200);

        let destruido = false;
        const limpar = () => {
          if (destruido) {
            return;
          }
          destruido = true;
          store.pararPolling();
          hostEl.remove();
          fixture.destroy();
          if ((globalThis as any).Zone?.current?.get('FakeAsyncTestZoneSpec')) {
            flush();
          }
        };

        return {
          fixture,
          store,
          hostEl,
          palco,
          mensagens,
          corpo,
          definirOferta: (nova: SlotOferecido[]) => {
            oferta = nova;
          },
          ciclo: () => {
            tick(3000);
            const req = httpMock.expectOne(`/conversas/${id}`);
            expect(req.request.method).toBe('GET');
            req.flush(corpo());
            tick();
            fixture.detectChanges();
          },
          limpar,
          encerrar: () => {
            store.pararPolling();
            httpMock.verify();
            limpar();
          },
        };
      }

      async function montarPalcoAsync(
        id: string,
        opcoes: {
          confirmado?: boolean;
          oferta?: SlotOferecido[];
          contatoPendente?: boolean;
          altura?: string;
        } = {},
      ) {
        const mensagens = historicoLongo(opcoes.confirmado ? confItem12 : null);
        let oferta = opcoes.oferta ?? [];
        const contatoPendente = opcoes.contatoPendente ?? false;
        localStorage.setItem('solar.conversaId', id);
        const fixture = TestBed.createComponent(Chat);
        const store = TestBed.inject(ConversaStore);
        const hostEl = html(fixture);
        hostEl.style.height = opcoes.altura ?? '350px';
        hostEl.style.display = 'flex';
        document.body.appendChild(hostEl);
        fixture.autoDetectChanges(true);

        const corpo = () =>
          conversaComOferta(
            id,
            oferta.map((s) => ({ ...s })),
            'Helena Braga',
            contatoPendente,
            null,
            structuredClone(mensagens),
          );

        httpMock.expectOne(`/conversas/${id}`).flush(corpo());
        await new Promise((resolve) => setTimeout(resolve, 30));
        fixture.detectChanges();

        const palco = hostEl.querySelector('.palco') as HTMLElement;
        expect(palco).not.toBeNull();
        expect(palco.scrollHeight).toBeGreaterThan(palco.clientHeight + 200);

        let destruido = false;
        const limpar = () => {
          if (destruido) {
            return;
          }
          destruido = true;
          store.pararPolling();
          hostEl.remove();
          fixture.destroy();
        };

        return {
          fixture,
          store,
          hostEl,
          palco,
          mensagens,
          corpo,
          definirOferta: (nova: SlotOferecido[]) => {
            oferta = nova;
          },
          limpar,
          encerrar: () => {
            store.pararPolling();
            httpMock.verify();
            limpar();
          },
        };
      }

      it('polling GET real com conteudo igual e referencias novas nunca escreve scroll, no topo nem perto do fim', fakeAsync(() => {
        const p = montarPalco('c-i12-igual', { confirmado: true });
        try {
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);
          expect(p.store.agendamentoEstaConfirmado()).toBeTrue();

          p.ciclo();
          const itensAntes = p.store.itens();
          const apresentacaoAntes = p.fixture.componentInstance.itensApresentacao();
          expect(apresentacaoAntes.some((i) => i.tipo === 'marcador-cartao')).toBeFalse();
          expect(
            apresentacaoAntes.some((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada'),
          ).toBeTrue();
          expect(
            apresentacaoAntes.some((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado'),
          ).toBeTrue();
          expect(
            apresentacaoAntes.some((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado'),
          ).toBeTrue();

          p.palco.scrollTop = 0;
          p.ciclo();
          p.ciclo();
          p.ciclo();
          expect(p.palco.scrollTop).toBe(0);
          expect(p.store.itens()).not.toBe(itensAntes);
          expect(p.fixture.componentInstance.itensApresentacao()).not.toBe(apresentacaoAntes);
          expect(p.store.itens().map((i) => i.tipo)).toEqual(itensAntes.map((i) => i.tipo));

          p.palco.scrollTop = maximo(p.palco) - 30;
          const posicaoPerto = p.palco.scrollTop;
          p.ciclo();
          p.ciclo();
          expect(p.palco.scrollTop).toBe(posicaoPerto);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('conteudo passivo novo segue o fim ate 80px inclusive mesmo crescendo mais de 80px e preserva o leitor acima', fakeAsync(() => {
        const p = montarPalco('c-i12-limites', { confirmado: true });
        try {
          p.ciclo();
          let n = 0;
          const crescer = () => {
            const antes = p.palco.scrollHeight;
            p.mensagens.push(mensagemNova(n++));
            p.ciclo();
            expect(p.palco.scrollHeight - antes).toBeGreaterThan(80);
          };
          const posicionar = (distanciaAlvo: number) => {
            p.palco.scrollTop = maximo(p.palco) - distanciaAlvo;
            expect(Math.round(distancia(p.palco))).toBe(distanciaAlvo);
          };

          posicionar(0);
          crescer();
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);

          posicionar(80);
          crescer();
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);

          posicionar(81);
          const posicao81 = p.palco.scrollTop;
          crescer();
          expect(p.palco.scrollTop).toBe(posicao81);

          p.palco.scrollTop = 0;
          crescer();
          expect(p.palco.scrollTop).toBe(0);

          p.palco.scrollTop = Math.floor(maximo(p.palco) / 2);
          const posicaoMeio = p.palco.scrollTop;
          crescer();
          expect(p.palco.scrollTop).toBe(posicaoMeio);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('mudancas reais de oferta e de evento seguem o fim quando perto e nao movem o leitor acima', fakeAsync(() => {
        const p = montarPalco('c-i12-reais', { oferta: [slotA1, slotA2] });
        try {
          p.ciclo();
          const posicionar = (distanciaAlvo: number) => {
            p.palco.scrollTop = maximo(p.palco) - distanciaAlvo;
          };

          p.palco.scrollTop = 0;
          p.definirOferta([slotA1, slotA2, slotOutroDia]);
          p.ciclo();
          expect(p.palco.scrollTop).toBe(0);
          p.definirOferta([slotA1, slotA2]);
          p.ciclo();
          expect(p.palco.scrollTop).toBe(0);

          posicionar(0);
          const alturaAntes = p.palco.scrollHeight;
          p.definirOferta([slotA1, slotA2, slotOutroDia]);
          p.ciclo();
          expect(p.palco.scrollHeight).toBeGreaterThan(alturaAntes);
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);

          posicionar(0);
          const eventosAntes = p.hostEl.querySelectorAll('app-evento-sistema').length;
          p.mensagens.push(mensagemNova(50, 'encerrar'));
          p.ciclo();
          expect(p.hostEl.querySelectorAll('app-evento-sistema').length).toBeGreaterThan(
            eventosAntes,
          );
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('encerrar recolhe o composer, aumenta o palco e nao puxa o leitor que estava a 81px nem muda a medida seguinte', fakeAsync(() => {
        const p = montarPalco('c-i12-encerra', { confirmado: true });
        try {
          p.ciclo();
          expect(p.store.composerRemovido()).toBeFalse();
          const clientAntes = p.palco.clientHeight;
          const alturaAntes = p.palco.scrollHeight;
          p.palco.scrollTop = maximo(p.palco) - 81;
          const posicao = p.palco.scrollTop;
          expect(Math.round(distancia(p.palco))).toBe(81);

          p.mensagens.push(mensagemNova(51, 'encerrar'));
          p.ciclo();

          expect(p.store.estado()).toBe('encerrada');
          expect(p.store.composerRemovido()).toBeTrue();
          expect(p.palco.clientHeight).toBeGreaterThan(clientAntes);
          expect(p.palco.scrollHeight).toBeGreaterThan(alturaAntes);
          expect(p.palco.scrollTop).toBe(posicao);

          const adicionar = (id: string) => {
            p.store.itens.update((itens) => [
              ...itens,
              { tipo: 'pessoa', id, texto: `Texto ${id}`.repeat(40), hora: '10:30' },
            ]);
            p.fixture.detectChanges();
            tick();
          };

          p.palco.scrollTop = maximo(p.palco) - 81;
          const posicao81 = p.palco.scrollTop;
          adicionar('novo-81');
          expect(p.palco.scrollTop).toBe(posicao81);

          p.palco.scrollTop = maximo(p.palco) - 80;
          adicionar('novo-80');
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('abertura, troca de conversa e reload abrem no fim', fakeAsync(() => {
        const p = montarPalco('c-i12-abre', { confirmado: true });
        let limparReload: () => void = () => undefined;
        try {
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);

          p.palco.scrollTop = 0;
          void p.store.abrirConversa('c-i12-outra');
          p.fixture.detectChanges();
          httpMock
            .expectOne('/conversas/c-i12-outra')
            .flush(
              conversaComOferta(
                'c-i12-outra',
                [],
                'Helena Braga',
                false,
                null,
                historicoLongo(null),
              ),
            );
          tick();
          p.fixture.detectChanges();
          expect(p.palco.scrollHeight).toBeGreaterThan(p.palco.clientHeight + 200);
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);
          p.encerrar();

          TestBed.resetTestingModule();
          TestBed.configureTestingModule({
            imports: [Chat],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
          });
          const httpMockReload = TestBed.inject(HttpTestingController);
          const storeReload = TestBed.inject(ConversaStore);
          expect(storeReload).not.toBe(p.store);
          const fixtureReload = TestBed.createComponent(Chat);
          const hostReload = html(fixtureReload);
          hostReload.style.height = '350px';
          hostReload.style.display = 'flex';
          document.body.appendChild(hostReload);
          limparReload = () => {
            storeReload.pararPolling();
            hostReload.remove();
            fixtureReload.destroy();
            flush();
          };
          fixtureReload.autoDetectChanges(true);
          httpMockReload
            .expectOne('/conversas/c-i12-outra')
            .flush(
              conversaComOferta(
                'c-i12-outra',
                [],
                'Helena Braga',
                false,
                null,
                historicoLongo(null),
              ),
            );
          tick();
          fixtureReload.detectChanges();
          const palcoReload = hostReload.querySelector('.palco') as HTMLElement;
          expect(palcoReload.scrollHeight).toBeGreaterThan(palcoReload.clientHeight + 200);
          expect(distancia(palcoReload)).toBeLessThanOrEqual(1);
          storeReload.pararPolling();
          httpMockReload.verify();
        } finally {
          p.limpar();
          limparReload();
        }
      }));

      it('envio proprio pela UI ancora a mensagem no topo e a resposta posterior nao puxa quem subiu enquanto esperava', fakeAsync(() => {
        const p = montarPalco('c-i12-envio', { confirmado: true });
        try {
          p.palco.scrollTop = 0;
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Minha pergunta';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req = httpMock.expectOne('/conversas/c-i12-envio/mensagens');
          expect(req.request.method).toBe('POST');
          expect(req.request.body).toEqual({ texto: 'Minha pergunta' });

          const msgsPessoa = p.hostEl.querySelectorAll('app-mensagem-pessoa');
          const msgEnviada = msgsPessoa[msgsPessoa.length - 1] as HTMLElement;
          expect(msgEnviada).not.toBeNull();
          expect(msgEnviada.textContent).toContain('Minha pergunta');
          const topoMsgRelativo =
            msgEnviada.getBoundingClientRect().top - p.palco.getBoundingClientRect().top;
          expect(Math.abs(topoMsgRelativo)).toBeLessThanOrEqual(1);

          p.palco.scrollTop = 0;
          req.flush({
            conversaId: 'c-i12-envio',
            resposta: `Resposta da Lia ${'com bastante texto para ocupar varias linhas no palco '.repeat(8)}`,
            intencao: 'indefinida',
            proximaAcao: 'continuar_conversa',
            perfilLead: null,
            imoveisSugeridos: [],
            corretor: 'Helena Braga',
            contatoPendente: false,
            agendamento: null,
          });
          tick();
          p.fixture.detectChanges();
          expect(p.palco.scrollTop).toBe(0);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('historico longo com envio pelo textarea posiciona a mensagem no topo antes da resposta independente da posicao anterior', fakeAsync(() => {
        const p = montarPalco('c-s48-hist-longo', { confirmado: true, altura: '600px' });
        try {
          p.palco.scrollTop = 50;
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Pergunta no historico longo';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req = httpMock.expectOne('/conversas/c-s48-hist-longo/mensagens');
          expect(req.request.method).toBe('POST');

          const msgs = p.hostEl.querySelectorAll('app-mensagem-pessoa');
          const ultima = msgs[msgs.length - 1] as HTMLElement;
          const topoRelativo =
            ultima.getBoundingClientRect().top - p.palco.getBoundingClientRect().top;
          expect(Math.abs(topoRelativo)).toBeLessThanOrEqual(1);
          expect(p.palco.scrollTop).toBeGreaterThan(100);

          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          expect(coluna.style.paddingBottom).not.toBe('');

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('resposta curta cresce abaixo sem alterar scrollTop e novo envio ancora sem acumular espaco', fakeAsync(() => {
        const p = montarPalco('c-s48-resp-curta', { confirmado: true, altura: '600px' });
        try {
          p.palco.scrollTop = 0;
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Primeira pergunta';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req1 = httpMock.expectOne('/conversas/c-s48-resp-curta/mensagens');
          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          const paddingInicial = parseFloat(coluna.style.paddingBottom) || 0;
          expect(paddingInicial).toBeGreaterThan(0);
          const scrollAposEnvio = p.palco.scrollTop;

          req1.flush({
            conversaId: 'c-s48-resp-curta',
            resposta: 'Resposta curta da Lia.',
            intencao: 'indefinida',
            proximaAcao: 'continuar_conversa',
            perfilLead: null,
            imoveisSugeridos: [],
            corretor: 'Helena Braga',
            contatoPendente: false,
            agendamento: null,
          });
          tick();
          p.fixture.detectChanges();

          expect(Math.abs(p.palco.scrollTop - scrollAposEnvio)).toBeLessThanOrEqual(1);
          const paddingAposResposta = parseFloat(coluna.style.paddingBottom) || 0;
          expect(paddingAposResposta).toBeLessThan(paddingInicial);
          expect(paddingAposResposta).toBeGreaterThan(0);

          area.value = 'Segunda pergunta';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req2 = httpMock.expectOne('/conversas/c-s48-resp-curta/mensagens');
          expect(req2.request.method).toBe('POST');
          const msgs = p.hostEl.querySelectorAll('app-mensagem-pessoa');
          const novaMsg = msgs[msgs.length - 1] as HTMLElement;
          const topoNovaMsg =
            novaMsg.getBoundingClientRect().top - p.palco.getBoundingClientRect().top;
          expect(Math.abs(topoNovaMsg)).toBeLessThanOrEqual(1);

          const paddingNovo = parseFloat(coluna.style.paddingBottom) || 0;
          expect(paddingNovo).toBeLessThan(paddingInicial + paddingAposResposta);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('resposta longa e cartoes de imoveis levam o espaco extra a zero mantendo scrollTop e ResizeObserver recalcula crescimento fisico', async () => {
        const spyDisconnect = spyOn(ResizeObserver.prototype, 'disconnect').and.callThrough();
        const p = await montarPalcoAsync('c-s48-resp-longa', { confirmado: true, altura: '600px' });
        try {
          p.palco.scrollTop = 0;
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Quero ver opcoes de casas';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req = httpMock.expectOne('/conversas/c-s48-resp-longa/mensagens');
          const msgsAntes = p.hostEl.querySelectorAll('app-mensagem-pessoa');
          const msgEnviada = msgsAntes[msgsAntes.length - 1] as HTMLElement;
          const scrollEsperado = p.palco.scrollTop;

          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          const paddingAntesCrescimento = parseFloat(coluna.style.paddingBottom) || 0;
          expect(paddingAntesCrescimento).toBeGreaterThan(0);

          const cardExtra = document.createElement('div');
          cardExtra.style.height = '100px';
          coluna.appendChild(cardExtra);

          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setTimeout(resolve, 50);
              });
            });
          });
          p.fixture.detectChanges();

          const paddingAposCrescimentoFisico = parseFloat(coluna.style.paddingBottom) || 0;
          expect(paddingAposCrescimentoFisico).toBeLessThan(paddingAntesCrescimento);
          expect(Math.abs(p.palco.scrollTop - scrollEsperado)).toBeLessThanOrEqual(1);

          req.flush({
            conversaId: 'c-s48-resp-longa',
            resposta: 'Aqui estao as opcoes encontradas: '.repeat(25),
            intencao: 'busca_imoveis',
            proximaAcao: 'continuar_conversa',
            perfilLead: null,
            imoveisSugeridos: [
              {
                id: 'imovel-1',
                titulo: 'Casa no Jardim Paulistano',
                preco: 1200000,
                dormitorios: 3,
                area: 200,
                bairro: 'Jardim Paulistano',
                cidade: 'Sao Paulo',
                estado: 'SP',
                fotos: ['/fotos/1.jpg'],
              },
            ],
            corretor: 'Helena Braga',
            contatoPendente: false,
            agendamento: null,
          });
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setTimeout(resolve, 50);
              });
            });
          });
          p.fixture.detectChanges();

          expect(coluna.style.paddingBottom).toBe('');
          expect(Math.abs(p.palco.scrollTop - scrollEsperado)).toBeLessThanOrEqual(1);
          const topoAinda =
            msgEnviada.getBoundingClientRect().top - p.palco.getBoundingClientRect().top;
          expect(Math.abs(topoAinda)).toBeLessThanOrEqual(1);

          p.encerrar();
          expect(spyDisconnect).toHaveBeenCalled();
        } finally {
          p.limpar();
        }
      });

      it('rolagem manual por wheel abandona o espaco extra e resposta posterior nao puxa o leitor', fakeAsync(() => {
        const p = montarPalco('c-s48-wheel', { confirmado: true, altura: '600px' });
        try {
          p.palco.scrollTop = 0;
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Pergunta antes de rolar wheel';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req = httpMock.expectOne('/conversas/c-s48-wheel/mensagens');
          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          expect(coluna.style.paddingBottom).not.toBe('');

          p.palco.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
          p.fixture.detectChanges();

          expect(coluna.style.paddingBottom).toBe('');

          p.palco.scrollTop = 20;
          req.flush({
            conversaId: 'c-s48-wheel',
            resposta: 'Resposta que nao deve mover o leitor.'.repeat(10),
            intencao: 'indefinida',
            proximaAcao: 'continuar_conversa',
            perfilLead: null,
            imoveisSugeridos: [],
            corretor: 'Helena Braga',
            contatoPendente: false,
            agendamento: null,
          });
          tick();
          p.fixture.detectChanges();

          expect(p.palco.scrollTop).toBe(20);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('arraste manual ao fim abandona o espaco extra, fim e real e resposta posterior nao puxa o leitor', fakeAsync(() => {
        const p = montarPalco('c-s48-scroll-fim', { confirmado: true, altura: '600px' });
        try {
          p.palco.scrollTop = 0;
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Pergunta antes de arrastar ao fim';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req = httpMock.expectOne('/conversas/c-s48-scroll-fim/mensagens');
          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          expect(coluna.style.paddingBottom).not.toBe('');

          p.palco.scrollTop = 100;
          p.palco.dispatchEvent(new Event('scroll'));
          p.fixture.detectChanges();

          expect(coluna.style.paddingBottom).toBe('');

          p.palco.scrollTop = maximo(p.palco);
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);

          const posicaoFimReal = p.palco.scrollTop;

          req.flush({
            conversaId: 'c-s48-scroll-fim',
            resposta: 'Resposta apos scroll ao fim.'.repeat(8),
            intencao: 'indefinida',
            proximaAcao: 'continuar_conversa',
            perfilLead: null,
            imoveisSugeridos: [],
            corretor: 'Helena Braga',
            contatoPendente: false,
            agendamento: null,
          });
          tick();
          p.fixture.detectChanges();

          expect(p.palco.scrollTop).toBe(posicaoFimReal);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('gesto direto na scrollbar ou tecla End com padding positivo remove extra sem mover a outro ponto primeiro e preserva cliques em conteudo', fakeAsync(() => {
        const p = montarPalco('c-s48-scrollbar-direto', { confirmado: true, altura: '600px' });
        try {
          p.palco.scrollTop = 0;
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Pergunta resposta curta com padding';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req = httpMock.expectOne('/conversas/c-s48-scrollbar-direto/mensagens');
          req.flush({
            conversaId: 'c-s48-scrollbar-direto',
            resposta: 'Resposta curta da Lia.',
            intencao: 'indefinida',
            proximaAcao: 'continuar_conversa',
            perfilLead: null,
            imoveisSugeridos: [],
            corretor: 'Helena Braga',
            contatoPendente: false,
            agendamento: null,
          });
          tick();
          p.fixture.detectChanges();

          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          const paddingComExtra = parseFloat(coluna.style.paddingBottom) || 0;
          expect(paddingComExtra).toBeGreaterThan(0);
          const scrollHeightComExtra = p.palco.scrollHeight;

          const rectPalco = p.palco.getBoundingClientRect();
          const cliqueConteudo = new MouseEvent('mousedown', {
            bubbles: true,
            clientX: rectPalco.left + 50,
            clientY: rectPalco.top + 50,
          });
          p.palco.dispatchEvent(cliqueConteudo);
          p.fixture.detectChanges();
          expect(parseFloat(coluna.style.paddingBottom) || 0).toBe(paddingComExtra);

          const cliqueScrollbar = new MouseEvent('mousedown', {
            bubbles: true,
            clientX: rectPalco.left + p.palco.clientWidth + 5,
            clientY: rectPalco.top + 50,
          });
          p.palco.dispatchEvent(cliqueScrollbar);
          p.fixture.detectChanges();

          expect(coluna.style.paddingBottom).toBe('');
          expect(p.palco.scrollHeight).toBeLessThan(scrollHeightComExtra);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('tecla End direta com padding positivo remove extra sem mover a outro ponto primeiro e nao puxa o leitor na resposta', fakeAsync(() => {
        const p = montarPalco('c-s48-end-direto', { confirmado: true, altura: '600px' });
        try {
          p.palco.scrollTop = 0;
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Pergunta para testar tecla End direta';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req = httpMock.expectOne('/conversas/c-s48-end-direto/mensagens');
          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          expect(coluna.style.paddingBottom).not.toBe('');

          p.palco.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
          p.fixture.detectChanges();

          expect(coluna.style.paddingBottom).toBe('');

          p.palco.scrollTop = maximo(p.palco);
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);
          const posicaoDepoisEnd = p.palco.scrollTop;

          req.flush({
            conversaId: 'c-s48-end-direto',
            resposta: 'Resposta posterior que nao deve rolar o leitor.'.repeat(8),
            intencao: 'indefinida',
            proximaAcao: 'continuar_conversa',
            perfilLead: null,
            imoveisSugeridos: [],
            corretor: 'Helena Braga',
            contatoPendente: false,
            agendamento: null,
          });
          tick();
          p.fixture.detectChanges();

          expect(p.palco.scrollTop).toBe(posicaoDepoisEnd);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('envio novo apos resposta com falha identifica nova pessoa por diferenca de IDs, ancora no topo e reserva espaco temporario', fakeAsync(() => {
        const p = montarPalco('c-s48-falha-envio', { confirmado: true, altura: '600px' });
        try {
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Primeira pergunta antes da falha';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req1 = httpMock.expectOne('/conversas/c-s48-falha-envio/mensagens');
          req1.flush(null, { status: 500, statusText: 'Internal Server Error' });
          tick();
          p.fixture.detectChanges();

          expect(p.store.estado()).toBe('falha');

          area.value = 'Segunda pergunta nova apos falha';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req2 = httpMock.expectOne('/conversas/c-s48-falha-envio/mensagens');
          expect(req2.request.method).toBe('POST');
          expect(req2.request.body).toEqual({ texto: 'Segunda pergunta nova apos falha' });

          const msgsPessoa = p.hostEl.querySelectorAll('app-mensagem-pessoa');
          const ultimaMsg = msgsPessoa[msgsPessoa.length - 1] as HTMLElement;
          expect(ultimaMsg.textContent).toContain('Segunda pergunta nova apos falha');

          const topoRelativo =
            ultimaMsg.getBoundingClientRect().top - p.palco.getBoundingClientRect().top;
          expect(Math.abs(topoRelativo)).toBeLessThanOrEqual(1);

          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          expect(coluna.style.paddingBottom).not.toBe('');
          const paddingAntesResp = parseFloat(coluna.style.paddingBottom) || 0;
          expect(paddingAntesResp).toBeGreaterThan(0);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('troca do palco na mesma conversa via lista de historico descarta ancora e espaco extra sem inflar altura ao reabrir e desconecta observer', fakeAsync(() => {
        const spyDisconnect = spyOn(ResizeObserver.prototype, 'disconnect').and.callThrough();
        const idConversa = 'c-s48-troca-palco';
        const p = montarPalco(idConversa, { confirmado: true, altura: '600px' });
        try {
          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = 'Mensagem com espaco positivo';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const req = httpMock.expectOne(`/conversas/${idConversa}/mensagens`);
          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          expect(coluna.style.paddingBottom).not.toBe('');
          const paddingComExtra = parseFloat(coluna.style.paddingBottom) || 0;
          expect(paddingComExtra).toBeGreaterThan(0);
          const scrollHeightComExtra = p.palco.scrollHeight;

          (p.fixture.componentInstance as any).listaAberta.set(true);
          p.fixture.detectChanges();

          expect(p.hostEl.querySelector('.palco')).toBeNull();
          expect(spyDisconnect).toHaveBeenCalled();

          (p.fixture.componentInstance as any).abrirConversa(idConversa);
          p.fixture.detectChanges();
          tick();

          const palcoReaberto = p.hostEl.querySelector('.palco') as HTMLElement;
          expect(palcoReaberto).not.toBeNull();
          const colunaReaberta = p.hostEl.querySelector('.coluna') as HTMLElement;
          expect(colunaReaberta.style.paddingBottom).toBe('');
          expect(palcoReaberto.scrollHeight).toBeLessThan(scrollHeightComExtra);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('sem novo envio, abertura, reload e troca de conversa nao reservam espaco extra', fakeAsync(() => {
        const p = montarPalco('c-s48-sem-reserva', { confirmado: true });
        try {
          const coluna = p.hostEl.querySelector('.coluna') as HTMLElement;
          expect(coluna.style.paddingBottom).toBe('');

          void p.store.abrirConversa('c-s48-trocada');
          p.fixture.detectChanges();
          httpMock
            .expectOne('/conversas/c-s48-trocada')
            .flush(
              conversaComOferta(
                'c-s48-trocada',
                [],
                'Helena Braga',
                false,
                null,
                historicoLongo(null),
              ),
            );
          tick();
          p.fixture.detectChanges();

          expect(coluna.style.paddingBottom).toBe('');

          const area = p.hostEl.querySelector('textarea') as HTMLTextAreaElement;
          area.value = '   ';
          area.dispatchEvent(new Event('input'));
          p.fixture.detectChanges();
          (p.hostEl.querySelector('.enviar') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          httpMock.expectNone('/conversas/c-s48-trocada/mensagens');
          expect(coluna.style.paddingBottom).toBe('');

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('primeiro envio autenticado com criacao de conversa ancora no topo e reserva espaco temporario', fakeAsync(() => {
        localStorage.setItem('solar.conversaId', 'conv-antiga');
        TestBed.inject(SessaoStore).definir(sessaoCliente());
        const fixture = TestBed.createComponent(Chat);
        const hostEl = html(fixture);
        hostEl.style.height = '600px';
        hostEl.style.display = 'flex';
        document.body.appendChild(hostEl);
        fixture.autoDetectChanges(true);

        fixture.detectChanges();
        httpMock.expectOne('/api/conta').flush(conta(VERSAO_AVISO_PRIVACIDADE));
        httpMock.expectOne('/api/conta/conversas').flush(conversas);
        httpMock.expectOne('/conversas/conv-antiga').flush(conversaComMensagens('conv-antiga'));
        tick();
        fixture.detectChanges();

        html(fixture).querySelector<HTMLButtonElement>('app-composer .botao-apagar')!.click();
        fixture.detectChanges();
        tick();

        html(fixture).querySelector<HTMLButtonElement>('app-confirmacao-exclusao .botao-destrutivo')!.click();
        fixture.detectChanges();

        const reqDelete = httpMock.expectOne('/conversas/conv-antiga/titular');
        reqDelete.flush(mockSucessoExclusao('apenas_conversa'));
        tick();
        fixture.detectChanges();

        const store = TestBed.inject(ConversaStore);
        expect(store.estado()).toBe('inicio-conta');
        expect(store.conversaAtual()).toBe('');

        const area = hostEl.querySelector('textarea') as HTMLTextAreaElement;
        area.value = 'Primeira mensagem na conta';
        area.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        (hostEl.querySelector('.enviar') as HTMLButtonElement).click();
        fixture.detectChanges();

        const reqConsent = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/consentimento'));
        expect(reqConsent.request.method).toBe('POST');
        reqConsent.flush({});
        tick();
        fixture.detectChanges();

        const reqMsg = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/mensagens'));
        expect(reqMsg.request.method).toBe('POST');

        const palco = hostEl.querySelector('.palco') as HTMLElement;
        const msg = hostEl.querySelector('app-mensagem-pessoa') as HTMLElement;
        expect(msg).not.toBeNull();
        const topoRelativo = msg.getBoundingClientRect().top - palco.getBoundingClientRect().top;
        expect(Math.abs(topoRelativo)).toBeLessThanOrEqual(1);

        const coluna = hostEl.querySelector('.coluna') as HTMLElement;
        expect(coluna.style.paddingBottom).not.toBe('');

        hostEl.remove();
        store.pararPolling();
        httpMock.verify();
        fixture.destroy();
        flush();
      }));

      it('envio de contato 200 forca o fim', fakeAsync(() => {
        const p = montarPalco('c-i12-contato', { contatoPendente: true });
        try {
          p.palco.scrollTop = 0;
          const formulario = p.fixture.debugElement.query(By.directive(FormularioContato));
          expect(formulario).not.toBeNull();
          formulario.componentInstance.enviar.emit({
            nome: 'Lead Item 12',
            telefone: '11999990000',
            email: 'lead12@solar.com.br',
          });
          p.fixture.detectChanges();

          const req = httpMock.expectOne('/conversas/c-i12-contato/contato');
          expect(req.request.method).toBe('POST');
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);

          req.flush({ leadId: 'lead-i12', oferta: [slotA1, slotA2] });
          tick();
          p.fixture.detectChanges();
          expect(p.hostEl.querySelector('app-cartao-agendamento')).not.toBeNull();
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));

      it('clique em horario com reserva 200 e GET reconciliado forca o fim e preserva guards e unico slot confirmado', fakeAsync(() => {
        const p = montarPalco('c-i12-horario', { oferta: [slotA1, slotA2] });
        try {
          p.palco.scrollTop = 0;
          (p.hostEl.querySelector('.slot-botao') as HTMLButtonElement).click();
          p.fixture.detectChanges();

          const post = httpMock.expectOne('/conversas/c-i12-horario/agendamentos');
          expect(post.request.method).toBe('POST');
          expect(post.request.body).toEqual({ slotId: slotA1.id });
          expect(distancia(p.palco)).toBeLessThanOrEqual(1);
          for (const slot of Array.from(p.hostEl.querySelectorAll('.slot-botao')) as HTMLButtonElement[]) {
            expect(slot.disabled).toBeTrue();
          }

          post.flush(confItem12);
          tick();
          p.fixture.detectChanges();

          const get = httpMock.expectOne('/conversas/c-i12-horario');
          expect(get.request.method).toBe('GET');
          get.flush(
            conversaComOferta(
              'c-i12-horario',
              [],
              'Helena Braga',
              false,
              confItem12,
              historicoLongo(confItem12),
            ),
          );
          tick();
          p.fixture.detectChanges();

          expect(distancia(p.palco)).toBeLessThanOrEqual(1);
          expect(p.hostEl.querySelectorAll('app-cartao-agendamento').length).toBe(0);
          const eventosConfirmados = Array.from(p.hostEl.querySelectorAll('app-evento-sistema'));
          expect(eventosConfirmados.some((e) => e.textContent?.includes('Reunião agendada'))).toBeTrue();

          p.encerrar();
        } finally {
          p.limpar();
        }
      }));
    });

    it('R3: GET inicial com confirmado + oferta[] mantem unico slot real selecionado, sem Agora nao e sem linha verde', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-init-conf');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const conf: AgendamentoDaConversa = {
        estado: 'confirmado',
        horario: slotA1,
        alternativas: [],
      };

      const msgs: MensagemDaConversa[] = [
        {
          papel: 'lead',
          texto: 'Quero agendar',
          em: '2026-10-07T08:00:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Reunião agendada com sucesso!',
          em: '2026-10-07T08:01:00Z',
          proximaAcao: 'continuar_conversa',
          corretor: 'Helena Braga',
          agendamento: conf,
        },
      ];

      httpMock.expectOne('/conversas/c-init-conf').flush(
        conversaComOferta('c-init-conf', [], 'Helena Braga', false, conf, msgs),
      );
      tick();
      fixture.detectChanges();

      expect(store.ofertaAgendamento()).toEqual([]);
      expect(store.agendamentoEstaConfirmado()).toBeTrue();

      const slots = html(fixture).querySelectorAll('.slot-botao');
      expect(slots.length).toBe(0);
      expect(html(fixture).querySelectorAll('app-cartao-agendamento').length).toBe(0);
      expect(html(fixture).querySelector('.link-recolher')).toBeNull();
      expect(html(fixture).querySelector('.evento-compacto')).toBeNull();
      const eventos = Array.from(html(fixture).querySelectorAll('app-evento-sistema'));
      expect(eventos.some((e) => e.textContent?.includes('Reunião agendada'))).toBeTrue();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('GET inicial com confirmado e oferta residual preserva unico slot confirmado e limpa oferta do store', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-init-residual');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const conf: AgendamentoDaConversa = {
        estado: 'confirmado',
        horario: slotA1,
        alternativas: [],
      };

      const msgs: MensagemDaConversa[] = [
        {
          papel: 'lead',
          texto: 'Quero agendar',
          em: '2026-10-07T08:00:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Reunião agendada com sucesso!',
          em: '2026-10-07T08:01:00Z',
          proximaAcao: 'continuar_conversa',
          corretor: 'Helena Braga',
          agendamento: conf,
        },
      ];

      httpMock.expectOne('/conversas/c-init-residual').flush(
        conversaComOferta('c-init-residual', [slotA1, slotA2], 'Helena Braga', false, conf, msgs),
      );
      tick();
      fixture.detectChanges();

      expect(store.ofertaAgendamento()).toEqual([]);
      expect(html(fixture).querySelectorAll('app-cartao-agendamento').length).toBe(0);
      expect(html(fixture).querySelectorAll('.slot-botao').length).toBe(0);
      const eventosResidual = Array.from(html(fixture).querySelectorAll('app-evento-sistema'));
      expect(eventosResidual.some((e) => e.textContent?.includes('Reunião agendada'))).toBeTrue();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('R3: encaminhamento unico no chat no fluxo ao vivo, GET reconstruido, polling e reload preservando falas e eventos', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-enc-chat');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const msgs: MensagemDaConversa[] = [
        {
          papel: 'lead',
          texto: 'Quero comprar imóvel',
          em: '2026-10-07T08:00:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Encaminhando seu caso para especialista',
          em: '2026-10-07T08:01:00Z',
          proximaAcao: 'agendar_reuniao',
          corretor: 'Helena Braga',
          agendamento: null,
        },
      ];

      const reqInit = httpMock.expectOne('/conversas/c-enc-chat');
      expect(reqInit.request.method).toBe('GET');
      reqInit.flush(
        conversaComOferta('c-enc-chat', [slotA1], 'Helena Braga', true, null, msgs),
      );
      tick();
      fixture.detectChanges();

      let eventos = Array.from(html(fixture).querySelectorAll('app-evento-sistema'));
      let encs = eventos.filter((e) => e.textContent?.includes('Encaminhado'));
      expect(encs.length).toBe(1);

      tick(5000);
      const pollReq = httpMock.expectOne('/conversas/c-enc-chat');
      expect(pollReq.request.method).toBe('GET');
      const novaMsgLia: MensagemDaConversa = {
        papel: 'agente',
        texto: 'Ainda aguardo seu contato',
        em: '2026-10-07T08:05:00Z',
        proximaAcao: 'agendar_reuniao',
        corretor: 'Helena Braga',
        agendamento: null,
      };
      pollReq.flush(
        conversaComOferta('c-enc-chat', [slotA1], 'Helena Braga', true, null, [
          ...msgs,
          novaMsgLia,
        ]),
      );
      tick();
      fixture.detectChanges();

      eventos = Array.from(html(fixture).querySelectorAll('app-evento-sistema'));
      encs = eventos.filter((e) => e.textContent?.includes('Encaminhado'));
      expect(encs.length).toBe(1);

      const mensagensLia = Array.from(html(fixture).querySelectorAll('app-mensagem-lia'));
      expect(mensagensLia.length).toBe(2);
      expect(mensagensLia[0].textContent).toContain('Encaminhando seu caso para especialista');
      expect(mensagensLia[1].textContent).toContain('Ainda aguardo seu contato');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('R2/R3: ciclo completo de contato, privacidade DOM sem vazamento de sentinelas, recibo antes do cartao e reload', fakeAsync(() => {
      const sentinelaNome = 'SENTINELA_NOME_PRIVACIDADE';
      const sentinelaTel = '11999990000';
      const sentinelaEmail = 'sentinela@privacidade.teste';
      const idConversa = 'c-privacidade-dom';

      localStorage.setItem('solar.conversaId', idConversa);
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const reqInit = httpMock.expectOne(`/conversas/${idConversa}`);
      expect(reqInit.request.method).toBe('GET');
      reqInit.flush(
        conversaComOferta(idConversa, [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-formulario-contato')).not.toBeNull();
      expect(html(fixture).querySelector('app-cartao-agendamento')).toBeNull();

      const formDebug = fixture.debugElement.query(By.directive(FormularioContato));
      formDebug.componentInstance.enviar.emit({
        nome: sentinelaNome,
        telefone: sentinelaTel,
        email: sentinelaEmail,
      });
      tick();
      fixture.detectChanges();

      const reqContato = httpMock.expectOne(`/conversas/${idConversa}/contato`);
      expect(reqContato.request.method).toBe('POST');
      expect(reqContato.request.body).toEqual({
        nome: sentinelaNome,
        telefone: sentinelaTel,
        email: sentinelaEmail,
      });
      reqContato.flush({
        leadId: 'lead-privacidade',
        oferta: [slotA1, slotA2],
      });
      tick();
      fixture.detectChanges();

      let recibos = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Contato enviado'),
      );
      expect(recibos.length).toBe(1);
      const reciboTexto = recibos[0].textContent ?? '';
      expect(reciboTexto).toContain('O corretor usará o contato que você forneceu.');
      expect(reciboTexto.includes(sentinelaNome)).toBeFalse();
      expect(reciboTexto.includes(sentinelaTel)).toBeFalse();
      expect(reciboTexto.includes(sentinelaEmail)).toBeFalse();

      let cartao = html(fixture).querySelector('app-cartao-agendamento');
      expect(cartao).not.toBeNull();
      const cartaoTexto = cartao?.textContent ?? '';
      expect(cartaoTexto.includes(sentinelaNome)).toBeFalse();
      expect(cartaoTexto.includes(sentinelaTel)).toBeFalse();
      expect(cartaoTexto.includes(sentinelaEmail)).toBeFalse();

      const elementosColunaA = Array.from(html(fixture).querySelector('.coluna')?.children ?? []);
      const idxReciboA = elementosColunaA.indexOf(recibos[0]);
      const idxCartaoA = elementosColunaA.indexOf(cartao!);
      expect(idxReciboA).toBeLessThan(idxCartaoA);

      const btnRecolher = cartao?.querySelector('.link-recolher') as HTMLButtonElement;
      expect(btnRecolher).not.toBeNull();
      btnRecolher.click();
      fixture.detectChanges();
      const chaveRecolhido = `solar.agendamentoRecolhido.v1:${idConversa}`;
      expect(sessionStorage.getItem(chaveRecolhido)).toBe('1');
      expect(sessionStorage.getItem(chaveRecolhido)?.includes(sentinelaNome)).toBeFalse();

      const btnReabrir = html(fixture).querySelector('.link-reabrir') as HTMLButtonElement;
      expect(btnReabrir).not.toBeNull();
      btnReabrir.click();
      fixture.detectChanges();

      const primeiroSlot = html(fixture).querySelector('.slot-botao') as HTMLButtonElement;
      primeiroSlot.click();
      fixture.detectChanges();

      const confData: AgendamentoDaConversa = {
        estado: 'confirmado',
        horario: slotA1,
        alternativas: [],
      };
      const reqReserva = httpMock.expectOne(`/conversas/${idConversa}/agendamentos`);
      expect(reqReserva.request.method).toBe('POST');
      reqReserva.flush(confData);
      tick();
      fixture.detectChanges();
      const msgsAposReserva: MensagemDaConversa[] = [
        {
          papel: 'lead',
          texto: 'Quero agendar',
          em: '2026-10-07T08:00:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Encaminhando seu caso para especialista',
          em: '2026-10-07T08:00:30Z',
          proximaAcao: 'agendar_reuniao',
          corretor: 'Helena Braga',
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Combinado! Helena Braga vai te chamar no contato que você forneceu no horário agendado.',
          em: '2026-10-07T08:01:00Z',
          proximaAcao: 'continuar_conversa',
          corretor: 'Helena Braga',
          agendamento: confData,
        },
      ];

      const reqReconcilia = httpMock.expectOne(`/conversas/${idConversa}`);
      expect(reqReconcilia.request.method).toBe('GET');
      reqReconcilia.flush(
        conversaComOferta(idConversa, [], 'Helena Braga', false, confData, msgsAposReserva),
      );
      tick();
      fixture.detectChanges();

      cartao = html(fixture).querySelector('app-cartao-agendamento');
      expect(cartao).toBeNull();

      recibos = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Contato enviado'),
      );
      expect(recibos.length).toBe(1);
      expect(recibos[0].textContent).toContain('O corretor usará o contato que você forneceu.');
      expect(recibos[0].textContent?.includes(sentinelaNome)).toBeFalse();
      expect(recibos[0].textContent?.includes(sentinelaTel)).toBeFalse();
      expect(recibos[0].textContent?.includes(sentinelaEmail)).toBeFalse();

      const reunioes = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Reunião agendada'),
      );
      expect(reunioes.length).toBe(1);
      expect(reunioes[0].textContent?.includes(sentinelaNome)).toBeFalse();
      expect(reunioes[0].textContent?.includes(sentinelaTel)).toBeFalse();
      expect(reunioes[0].textContent?.includes(sentinelaEmail)).toBeFalse();

      store.pararPolling();
      fixture.destroy();
      flush();

      const fixtureReload = TestBed.createComponent(Chat);
      const storeReload = TestBed.inject(ConversaStore);
      fixtureReload.detectChanges();

      const reqReload = httpMock.expectOne(`/conversas/${idConversa}`);
      expect(reqReload.request.method).toBe('GET');
      reqReload.flush(
        conversaComOferta(idConversa, [], 'Helena Braga', false, confData, msgsAposReserva),
      );
      tick();
      fixtureReload.detectChanges();

      httpMock.expectNone(`/conversas/${idConversa}/mensagens`);
      httpMock.expectNone(`/conversas/${idConversa}/agendamentos`);
      httpMock.expectNone(`/conversas/${idConversa}/contato`);

      const recibosReload = Array.from(html(fixtureReload).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Contato enviado'),
      );
      expect(recibosReload.length).toBe(1);
      expect(recibosReload[0].textContent).toContain('O corretor usará o contato que você forneceu.');
      expect(recibosReload[0].textContent?.includes(sentinelaNome)).toBeFalse();
      expect(recibosReload[0].textContent?.includes(sentinelaTel)).toBeFalse();
      expect(recibosReload[0].textContent?.includes(sentinelaEmail)).toBeFalse();

      const cartaoReload = html(fixtureReload).querySelector('app-cartao-agendamento');
      expect(cartaoReload).toBeNull();

      const reunioesReload = Array.from(html(fixtureReload).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Reunião agendada'),
      );
      expect(reunioesReload.length).toBe(1);
      expect(reunioesReload[0].textContent?.includes(sentinelaNome)).toBeFalse();
      expect(reunioesReload[0].textContent?.includes(sentinelaTel)).toBeFalse();
      expect(reunioesReload[0].textContent?.includes(sentinelaEmail)).toBeFalse();

      const elementosColunaReload = Array.from(html(fixtureReload).querySelector('.coluna')?.children ?? []);
      const idxReciboReload = elementosColunaReload.indexOf(recibosReload[0]);
      const idxReuniaoReload = elementosColunaReload.indexOf(reunioesReload[0]);
      expect(idxReciboReload).toBeLessThan(idxReuniaoReload);

      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i) ?? '';
        const v = sessionStorage.getItem(k) ?? '';
        expect(v.includes(sentinelaNome)).toBeFalse();
        expect(v.includes(sentinelaTel)).toBeFalse();
        expect(v.includes(sentinelaEmail)).toBeFalse();
      }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) ?? '';
        const v = localStorage.getItem(k) ?? '';
        expect(v.includes(sentinelaNome)).toBeFalse();
        expect(v.includes(sentinelaTel)).toBeFalse();
        expect(v.includes(sentinelaEmail)).toBeFalse();
      }

      storeReload.pararPolling();
      httpMock.verify();
      fixtureReload.destroy();
      flush();
    }));

    it('Item 11: ancora recibo e cartao imediatamente apos Encaminhado preservando sequencia com novas mensagens, temas, viewport e fallback', fakeAsync(() => {
      const idConversa = 'c-item11-ancora';
      localStorage.setItem('solar.conversaId', idConversa);
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne(`/conversas/${idConversa}`).flush(
        conversaComOferta(idConversa, [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      const formDebug = fixture.debugElement.query(By.directive(FormularioContato));
      expect(formDebug).not.toBeNull();
      formDebug.componentInstance.enviar.emit({
        nome: 'Lead Item 11',
        telefone: '11999998888',
        email: 'lead11@solar.com.br',
      });
      tick();
      fixture.detectChanges();

      const reqContato = httpMock.expectOne(`/conversas/${idConversa}/contato`);
      expect(reqContato.request.method).toBe('POST');
      reqContato.flush({
        leadId: 'lead-item11',
        oferta: [slotA1, slotA2],
      });
      tick();
      fixture.detectChanges();

      let cartao = html(fixture).querySelector('app-cartao-agendamento');
      expect(cartao).not.toBeNull();
      const slotsAntes = cartao?.querySelectorAll('.slot-botao');
      expect(slotsAntes?.length).toBe(2);

      const primeiroSlot = slotsAntes?.[0] as HTMLButtonElement;
      primeiroSlot.click();
      fixture.detectChanges();

      const confData: AgendamentoDaConversa = {
        estado: 'confirmado',
        horario: slotA1,
        alternativas: [],
      };
      const reqReserva = httpMock.expectOne(`/conversas/${idConversa}/agendamentos`);
      expect(reqReserva.request.method).toBe('POST');
      reqReserva.flush(confData);
      tick();
      fixture.detectChanges();

      const msgsAposReserva: MensagemDaConversa[] = [
        {
          papel: 'lead',
          texto: 'Quero um apartamento.',
          em: '2026-10-07T08:00:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Encaminhando para Helena Braga.',
          em: '2026-10-07T08:00:30Z',
          proximaAcao: 'agendar_reuniao',
          corretor: 'Helena Braga',
          agendamento: null,
        },
        {
          papel: 'lead',
          texto: 'Quarta, 7 de outubro às 9h',
          em: '2026-10-07T08:01:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Combinado! Helena Braga vai te chamar no contato que você forneceu no horário agendado.',
          em: '2026-10-07T08:01:00Z',
          proximaAcao: 'agendar_reuniao',
          corretor: 'Helena Braga',
          agendamento: confData,
        },
      ];

      const reqReconcilia = httpMock.expectOne(`/conversas/${idConversa}`);
      expect(reqReconcilia.request.method).toBe('GET');
      reqReconcilia.flush(
        conversaComOferta(idConversa, [], 'Helena Braga', false, confData, msgsAposReserva),
      );
      tick();
      fixture.detectChanges();

      const snapshotFonteAntes = store.itens().map((i) => ({ ...i }));
      const apresentacaoPosConf = fixture.componentInstance.itensApresentacao();
      const snapshotFonteDepois = store.itens();
      expect(snapshotFonteDepois.length).toBe(snapshotFonteAntes.length);
      expect(snapshotFonteDepois).toEqual(snapshotFonteAntes);
      for (let i = 0; i < snapshotFonteAntes.length; i++) {
        expect(snapshotFonteDepois[i].id).toBe(snapshotFonteAntes[i].id);
        expect(snapshotFonteDepois[i].tipo).toBe(snapshotFonteAntes[i].tipo);
      }
      expect((store.itens() as { tipo: string }[]).some((i) => i.tipo === 'marcador-cartao')).toBeFalse();

      const itemReciboPosConf = apresentacaoPosConf.find(
        (i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado',
      );
      const itemCartaoPosConf = apresentacaoPosConf.find((i) => i.tipo === 'marcador-cartao');
      expect(itemReciboPosConf?.id).toBe(`recibo:${idConversa}`);
      expect(itemCartaoPosConf).toBeUndefined();
      expect(apresentacaoPosConf.some((i) => i.tipo === 'marcador-cartao')).toBeFalse();
      const idReciboAntes = itemReciboPosConf?.id;

      const domRecibosPosConf = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Contato enviado'),
      );
      const domReuniaoPosConf = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Reunião agendada'),
      );
      const domCartoesPosConf = html(fixture).querySelectorAll('app-cartao-agendamento');
      expect(domRecibosPosConf.length).toBe(1);
      expect(domReuniaoPosConf.length).toBe(1);
      expect(domReuniaoPosConf[0].textContent).toContain(
        'O corretor entrará em contato no horário agendado: quarta, 7 de outubro, 9h da manhã.',
      );
      expect(domCartoesPosConf.length).toBe(0);
      const refDomReciboAntes = domRecibosPosConf[0];
      const refDomReuniaoAntes = domReuniaoPosConf[0];

      void store.enviar('Tenho uma dúvida sobre a documentação.');
      fixture.detectChanges();

      const reqEnvio = httpMock.expectOne(`/conversas/${idConversa}/mensagens`);
      expect(reqEnvio.request.method).toBe('POST');
      expect(reqEnvio.request.body).toEqual({ texto: 'Tenho uma dúvida sobre a documentação.' });

      const respostaAoVivo: MensagemResponse = {
        conversaId: idConversa,
        resposta: 'Sua reunião já está confirmada e o corretor dará continuidade ao atendimento.',
        intencao: 'compra',
        proximaAcao: 'agendar_reuniao',
        perfilLead: {
          nome: null,
          intencao: 'compra',
          precoMin: null,
          precoMax: null,
          quartos: null,
          regiao: null,
          urgencia: null,
          expectativaRetorno: null,
          score: null,
        },
        imoveisSugeridos: [],
        corretor: 'Helena Braga',
        contatoPendente: false,
        agendamento: null,
      };
      reqEnvio.flush(respostaAoVivo);
      tick();
      fixture.detectChanges();

      const elementosAoVivo = Array.from(html(fixture).querySelector('.coluna')?.children ?? []);
      const idxEncAoVivo = elementosAoVivo.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-evento-sistema' && e.textContent?.includes('Encaminhado'),
      );
      const idxRecAoVivo = elementosAoVivo.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-evento-sistema' && e.textContent?.includes('Contato enviado'),
      );
      const idxReuniaoAoVivo = elementosAoVivo.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-evento-sistema' && e.textContent?.includes('Reunião agendada'),
      );
      const idxLeadHorarioAoVivo = elementosAoVivo.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-pessoa' && e.textContent?.includes('Quarta, 7 de outubro'),
      );
      const idxCombAoVivo = elementosAoVivo.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-lia' && e.textContent?.includes('Combinado!'),
      );
      const idxNovaPessoaAoVivo = elementosAoVivo.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-pessoa' && e.textContent?.includes('Tenho uma dúvida'),
      );
      const idxNovaLiaAoVivo = elementosAoVivo.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-lia' && e.textContent?.includes('Sua reunião já está confirmada'),
      );

      expect(idxEncAoVivo).toBeGreaterThan(-1);
      expect(idxRecAoVivo).toBe(idxEncAoVivo + 1);
      expect(idxReuniaoAoVivo).toBeGreaterThan(idxRecAoVivo);
      expect(idxLeadHorarioAoVivo).toBe(-1);
      expect(idxCombAoVivo).toBe(-1);
      expect(idxNovaPessoaAoVivo).toBeGreaterThan(idxReuniaoAoVivo);
      expect(idxNovaLiaAoVivo).toBeGreaterThan(idxNovaPessoaAoVivo);

      const cartoesAoVivo = html(fixture).querySelectorAll('app-cartao-agendamento');
      expect(cartoesAoVivo.length).toBe(0);
      const recibosAoVivo = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Contato enviado'),
      );
      expect(recibosAoVivo.length).toBe(1);
      const reunioesAoVivo = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Reunião agendada'),
      );
      expect(reunioesAoVivo.length).toBe(1);

      expect(recibosAoVivo[0]).toBe(refDomReciboAntes);
      expect(reunioesAoVivo[0]).toBe(refDomReuniaoAntes);

      const apresentacaoAoVivo = fixture.componentInstance.itensApresentacao();
      const itemReciboAoVivo = apresentacaoAoVivo.find(
        (i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado',
      );
      const itemCartaoAoVivo = apresentacaoAoVivo.find((i) => i.tipo === 'marcador-cartao');
      expect(itemReciboAoVivo?.id).toBe(idReciboAntes);
      expect(itemCartaoAoVivo).toBeUndefined();

      expect(elementosAoVivo[idxNovaPessoaAoVivo].textContent).toContain('Tenho uma dúvida sobre a documentação.');
      expect(elementosAoVivo[idxNovaLiaAoVivo].textContent).toContain(
        'Sua reunião já está confirmada e o corretor dará continuidade ao atendimento.',
      );

      httpMock.expectNone(`/conversas/${idConversa}/agendamentos`);
      httpMock.expectNone(`/conversas/${idConversa}/contato`);

      tick(3000);
      const reqPolling = httpMock.expectOne(`/conversas/${idConversa}`);
      expect(reqPolling.request.method).toBe('GET');
      const msgsAposPolling: MensagemDaConversa[] = [
        ...msgsAposReserva,
        {
          papel: 'lead',
          texto: 'Tenho uma dúvida sobre a documentação.',
          em: '2026-10-07T08:02:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Sua reunião já está confirmada e o corretor dará continuidade ao atendimento.',
          em: '2026-10-07T08:02:05Z',
          proximaAcao: 'agendar_reuniao',
          corretor: 'Helena Braga',
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Claro, estou preparando o catálogo dos imóveis.',
          em: '2026-10-07T08:02:10Z',
          proximaAcao: 'continuar_conversa',
          corretor: 'Helena Braga',
          agendamento: null,
        },
      ];
      reqPolling.flush(
        conversaComOferta(idConversa, [], 'Helena Braga', false, confData, msgsAposPolling),
      );
      tick();
      fixture.detectChanges();

      const apresentacaoAposPoll = fixture.componentInstance.itensApresentacao();
      const itemReciboAposPoll = apresentacaoAposPoll.find(
        (i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado',
      );
      const itemCartaoAposPoll = apresentacaoAposPoll.find((i) => i.tipo === 'marcador-cartao');
      expect(itemReciboAposPoll?.id).toBe(idReciboAntes);
      expect(itemCartaoAposPoll).toBeUndefined();

      const elementosAposPoll = Array.from(html(fixture).querySelector('.coluna')?.children ?? []);
      const idxLiaCatalogoAoVivo = elementosAposPoll.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-lia' && e.textContent?.includes('preparando o catálogo'),
      );
      expect(idxLiaCatalogoAoVivo).toBeGreaterThan(idxNovaLiaAoVivo);

      const reunioesAposPoll = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).filter(
        (e) => e.textContent?.includes('Reunião agendada'),
      );
      expect(reunioesAposPoll.length).toBe(1);
      expect(html(fixture).querySelectorAll('app-cartao-agendamento').length).toBe(0);

      const container360 = document.createElement('div');
      container360.style.width = '360px';
      container360.style.boxSizing = 'border-box';
      document.body.appendChild(container360);
      container360.appendChild(fixture.nativeElement);
      fixture.detectChanges();

      try {
        const rectContainer = container360.getBoundingClientRect();
        expect(rectContainer.width).toBe(360);

        const palco = html(fixture).querySelector('.palco') as HTMLElement;
        expect(palco).not.toBeNull();
        const rectPalco = palco.getBoundingClientRect();
        expect(rectPalco.width).toBeGreaterThan(0);
        expect(rectPalco.width).toBeLessThanOrEqual(rectContainer.width);

        const eventoReuniaoAtual = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).find(
          (e) => e.textContent?.includes('Reunião agendada'),
        ) as HTMLElement;
        expect(eventoReuniaoAtual).toBeDefined();
        const rectReuniao = eventoReuniaoAtual.getBoundingClientRect();
        expect(rectReuniao.width).toBeGreaterThan(0);
        expect(rectReuniao.right).toBeLessThanOrEqual(rectContainer.right + 1);

        const reciboAtual = Array.from(html(fixture).querySelectorAll('app-evento-sistema')).find(
          (e) => e.textContent?.includes('Contato enviado'),
        ) as HTMLElement;
        expect(reciboAtual).toBeDefined();
        const rectRecibo = reciboAtual.getBoundingClientRect();
        expect(rectRecibo.width).toBeGreaterThan(0);
        expect(rectRecibo.right).toBeLessThanOrEqual(rectContainer.right + 1);
      } finally {
        if (document.body.contains(container360)) {
          document.body.removeChild(container360);
        }
      }

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [Chat],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      });
      const httpMockReload = TestBed.inject(HttpTestingController);
      const storeReload = TestBed.inject(ConversaStore);
      expect(storeReload).not.toBe(store);

      const fixtureReload = TestBed.createComponent(Chat);
      fixtureReload.detectChanges();

      const reqReload = httpMockReload.expectOne(`/conversas/${idConversa}`);
      expect(reqReload.request.method).toBe('GET');
      reqReload.flush(
        conversaComOferta(idConversa, [], 'Helena Braga', false, confData, msgsAposPolling),
      );
      tick();
      fixtureReload.detectChanges();

      httpMockReload.expectNone(`/conversas/${idConversa}/mensagens`);
      httpMockReload.expectNone(`/conversas/${idConversa}/agendamentos`);
      httpMockReload.expectNone(`/conversas/${idConversa}/contato`);

      const snapshotFonteReloadAntes = storeReload.itens().map((i) => ({ ...i }));
      const apresentacaoReload = fixtureReload.componentInstance.itensApresentacao();
      const snapshotFonteReloadDepois = storeReload.itens();
      expect(snapshotFonteReloadDepois.length).toBe(snapshotFonteReloadAntes.length);
      expect(snapshotFonteReloadDepois).toEqual(snapshotFonteReloadAntes);
      for (let i = 0; i < snapshotFonteReloadAntes.length; i++) {
        expect(snapshotFonteReloadDepois[i].id).toBe(snapshotFonteReloadAntes[i].id);
        expect(snapshotFonteReloadDepois[i].tipo).toBe(snapshotFonteReloadAntes[i].tipo);
      }
      expect((storeReload.itens() as { tipo: string }[]).some((i) => i.tipo === 'marcador-cartao')).toBeFalse();

      const itemReciboReload = apresentacaoReload.find(
        (i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado',
      );
      const itemCartaoReload = apresentacaoReload.find((i) => i.tipo === 'marcador-cartao');
      expect(itemReciboReload?.id).toBe(`recibo:${idConversa}`);
      expect(itemCartaoReload).toBeUndefined();

      const elementosReload = Array.from(html(fixtureReload).querySelector('.coluna')?.children ?? []);
      const idxEncReload = elementosReload.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-evento-sistema' && e.textContent?.includes('Encaminhado'),
      );
      const idxRecReload = elementosReload.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-evento-sistema' && e.textContent?.includes('Contato enviado'),
      );
      const idxReuniaoReload = elementosReload.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-evento-sistema' && e.textContent?.includes('Reunião agendada'),
      );
      const idxLeadReload = elementosReload.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-pessoa' && e.textContent?.includes('Quarta, 7 de outubro'),
      );
      const idxCombReload = elementosReload.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-lia' && e.textContent?.includes('Combinado!'),
      );
      const idxPessoaDuvidaReload = elementosReload.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-pessoa' && e.textContent?.includes('Tenho uma dúvida'),
      );
      const idxLiaConfReload = elementosReload.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-lia' && e.textContent?.includes('Sua reunião já está confirmada'),
      );
      const idxLiaCatalogoReload = elementosReload.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-lia' && e.textContent?.includes('preparando o catálogo'),
      );

      expect(idxEncReload).toBeGreaterThan(-1);
      expect(idxRecReload).toBe(idxEncReload + 1);
      expect(idxReuniaoReload).toBeGreaterThan(idxRecReload);
      expect(idxLeadReload).toBe(-1);
      expect(idxCombReload).toBe(-1);
      expect(idxPessoaDuvidaReload).toBeGreaterThan(idxReuniaoReload);
      expect(idxLiaConfReload).toBeGreaterThan(idxPessoaDuvidaReload);
      expect(idxLiaCatalogoReload).toBeGreaterThan(idxLiaConfReload);

      expect(html(fixtureReload).querySelectorAll('app-cartao-agendamento').length).toBe(0);
      expect(
        Array.from(html(fixtureReload).querySelectorAll('app-evento-sistema')).filter(
          (e) => e.textContent?.includes('Contato enviado'),
        ).length,
      ).toBe(1);
      expect(
        Array.from(html(fixtureReload).querySelectorAll('app-evento-sistema')).filter(
          (e) => e.textContent?.includes('Reunião agendada'),
        ).length,
      ).toBe(1);

      const divisoresReload = apresentacaoReload.filter((i) => i.tipo === 'divisor');
      expect(divisoresReload.length).toBeGreaterThanOrEqual(1);

      storeReload.pararPolling();
      httpMockReload.verify();
      fixtureReload.destroy();
      flush();
    }));

    it('Item 11: fallback nao renderiza cartao confirmado ao final se Encaminhado estiver ausente e ancora aviso Reunião agendada quando historico completo chega', fakeAsync(() => {
      const idConversa = 'c-item11-fallback';
      localStorage.setItem('solar.conversaId', idConversa);
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const confData: AgendamentoDaConversa = {
        estado: 'confirmado',
        horario: slotA1,
        alternativas: [],
      };
      const msgsSemEncaminhado: MensagemDaConversa[] = [
        {
          papel: 'lead',
          texto: 'Quero um apartamento.',
          em: '2026-10-07T08:00:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Combinado! Helena Braga vai te chamar no horário agendado.',
          em: '2026-10-07T08:01:00Z',
          proximaAcao: 'continuar_conversa',
          corretor: 'Helena Braga',
          agendamento: confData,
        },
      ];

      httpMock.expectOne(`/conversas/${idConversa}`).flush(
        conversaComOferta(idConversa, [], 'Helena Braga', false, confData, msgsSemEncaminhado),
      );
      tick();
      fixture.detectChanges();

      expect((fixture.componentInstance as Chat).temMarcadorCartao()).toBeFalse();
      expect(html(fixture).querySelectorAll('app-cartao-agendamento').length).toBe(0);
      expect(
        Array.from(html(fixture).querySelectorAll('app-evento-sistema')).some(
          (e) => e.textContent?.includes('Reunião agendada'),
        ),
      ).toBeTrue();

      tick(3000);
      const reqPolling = httpMock.expectOne(`/conversas/${idConversa}`);
      expect(reqPolling.request.method).toBe('GET');

      const msgsCompletas: MensagemDaConversa[] = [
        {
          papel: 'lead',
          texto: 'Quero um apartamento.',
          em: '2026-10-07T08:00:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Encaminhando para Helena Braga.',
          em: '2026-10-07T08:00:30Z',
          proximaAcao: 'agendar_reuniao',
          corretor: 'Helena Braga',
          agendamento: null,
        },
        {
          papel: 'lead',
          texto: 'Quarta, 7 de outubro às 9h',
          em: '2026-10-07T08:01:00Z',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Combinado! Helena Braga vai te chamar no horário agendado.',
          em: '2026-10-07T08:01:00Z',
          proximaAcao: 'continuar_conversa',
          corretor: 'Helena Braga',
          agendamento: confData,
        },
      ];

      reqPolling.flush(
        conversaComOferta(idConversa, [], 'Helena Braga', false, confData, msgsCompletas),
      );
      tick();
      fixture.detectChanges();

      expect((fixture.componentInstance as Chat).temMarcadorCartao()).toBeFalse();
      expect(html(fixture).querySelectorAll('app-cartao-agendamento').length).toBe(0);

      const elementosReancorados = Array.from(
        html(fixture).querySelector('.coluna')?.children ?? [],
      );
      const idxEnc = elementosReancorados.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-evento-sistema' && e.textContent?.includes('Encaminhado'),
      );
      const idxRec = elementosReancorados.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-evento-sistema' && e.textContent?.includes('Contato enviado'),
      );
      const idxReuniao = elementosReancorados.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-evento-sistema' && e.textContent?.includes('Reunião agendada'),
      );
      const idxLead = elementosReancorados.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-pessoa' && e.textContent?.includes('Quarta, 7 de outubro'),
      );
      const idxComb = elementosReancorados.findIndex(
        (e) => e.tagName.toLowerCase() === 'app-mensagem-lia' && e.textContent?.includes('Combinado!'),
      );

      expect(idxEnc).toBeGreaterThan(-1);
      expect(idxRec).toBe(idxEnc + 1);
      expect(idxReuniao).toBeGreaterThan(idxRec);
      expect(idxLead).toBe(-1);
      expect(idxComb).toBe(-1);

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    describe('contato preenchido pela conta (T4)', () => {
    it('cliente com conta completa busca conta uma vez, preenche campos com telefone formatado e envia contato mantendo oferta', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-cliente');
      TestBed.inject(SessaoStore).definir(sessaoCliente());
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const reqConta = httpMock.expectOne('/api/conta');
      expect(reqConta.request.method).toBe('GET');
      reqConta.flush(conta(VERSAO_AVISO_PRIVACIDADE));

      const reqLista = httpMock.expectOne('/api/conta/conversas');
      reqLista.flush([
        { id: 'c-t4-cliente', titulo: 'Cliente', atualizadaEm: AGORA, estado: 'em_andamento' },
        ...conversas,
      ]);

      const reqConv = httpMock.expectOne('/conversas/c-t4-cliente');
      reqConv.flush(conversaComOferta('c-t4-cliente', [], 'Helena Braga', true));
      tick();
      fixture.detectChanges();

      httpMock.expectNone('/api/conta');

      const rotulo = html(fixture).querySelector('app-formulario-contato .rotulo');
      expect(rotulo?.textContent?.trim()).toBe('Como falar com você');

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      const inputTel = html(fixture).querySelector('app-formulario-contato input[type="tel"]') as HTMLInputElement;
      const inputEmail = html(fixture).querySelector('app-formulario-contato input[type="email"]') as HTMLInputElement;

      expect(inputNome.value).toBe('Marina Couto');
      expect(inputTel.value).toBe('(11) 98765-4321');
      expect(inputEmail.value).toBe('marina.couto@email.com');

      const btnEnviar = html(fixture).querySelector('app-formulario-contato .acao') as HTMLButtonElement;
      expect(btnEnviar.disabled).toBeFalse();
      btnEnviar.click();
      fixture.detectChanges();

      const reqContato = httpMock.expectOne('/conversas/c-t4-cliente/contato');
      expect(reqContato.request.method).toBe('POST');
      expect(reqContato.request.body).toEqual({
        nome: 'Marina Couto',
        telefone: '(11) 98765-4321',
        email: 'marina.couto@email.com',
      });

      reqContato.flush({
        leadId: 'lead-t4-cliente',
        oferta: [slotA1, slotA2],
      });
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelector('app-cartao-agendamento')).not.toBeNull();
      expect(html(fixture).querySelectorAll('.slot-botao').length).toBe(2);

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('editar campos antes de enviar altera o payload de contato e nao dispara PATCH na conta', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-edicao');
      TestBed.inject(SessaoStore).definir(sessaoCliente());
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/api/conta').flush(conta(VERSAO_AVISO_PRIVACIDADE));
      httpMock.expectOne('/api/conta/conversas').flush([
        { id: 'c-t4-edicao', titulo: 'Edicao', atualizadaEm: AGORA, estado: 'em_andamento' },
      ]);
      httpMock.expectOne('/conversas/c-t4-edicao').flush(
        conversaComOferta('c-t4-edicao', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      const inputTel = html(fixture).querySelector('app-formulario-contato input[type="tel"]') as HTMLInputElement;
      const inputEmail = html(fixture).querySelector('app-formulario-contato input[type="email"]') as HTMLInputElement;

      inputNome.value = 'Marina Silva Editada';
      inputNome.dispatchEvent(new Event('input'));
      inputTel.value = '(11) 91111-2222';
      inputTel.dispatchEvent(new Event('input'));
      inputEmail.value = 'novo.email@solar.com.br';
      inputEmail.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const btnEnviar = html(fixture).querySelector('app-formulario-contato .acao') as HTMLButtonElement;
      btnEnviar.click();
      fixture.detectChanges();

      const reqContato = httpMock.expectOne('/conversas/c-t4-edicao/contato');
      expect(reqContato.request.method).toBe('POST');
      expect(reqContato.request.body).toEqual({
        nome: 'Marina Silva Editada',
        telefone: '(11) 91111-2222',
        email: 'novo.email@solar.com.br',
      });
      reqContato.flush({
        leadId: 'lead-t4-edicao',
        oferta: [slotA1],
      });
      tick();
      fixture.detectChanges();

      httpMock.expectNone('/api/conta');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('supervisor autenticado com telefone nulo busca conta sem listar conversas e permite envio com telefone vazio', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-supervisor');
      TestBed.inject(SessaoStore).definir(sessaoSupervisor());
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const reqConta = httpMock.expectOne('/api/conta');
      expect(reqConta.request.method).toBe('GET');
      reqConta.flush({
        id: 'u-supervisor',
        nome: 'Helena Soares',
        email: 'helena@solar.com.br',
        telefone: null,
        perfil: 'supervisor',
        criadaEm: '2026-09-22T14:08:00Z',
        corretor: null,
        consentimento: null,
        conversasSalvas: 0,
      });

      httpMock.expectNone('/api/conta/conversas');

      httpMock.expectOne('/conversas/c-t4-supervisor').flush(
        conversaComOferta('c-t4-supervisor', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      const inputTel = html(fixture).querySelector('app-formulario-contato input[type="tel"]') as HTMLInputElement;
      const inputEmail = html(fixture).querySelector('app-formulario-contato input[type="email"]') as HTMLInputElement;

      expect(inputNome.value).toBe('Helena Soares');
      expect(inputTel.value).toBe('');
      expect(inputEmail.value).toBe('helena@solar.com.br');

      const btnEnviar = html(fixture).querySelector('app-formulario-contato .acao') as HTMLButtonElement;
      expect(btnEnviar.disabled).toBeFalse();

      btnEnviar.click();
      fixture.detectChanges();

      const reqContato = httpMock.expectOne('/conversas/c-t4-supervisor/contato');
      expect(reqContato.request.method).toBe('POST');
      expect(reqContato.request.body).toEqual({
        nome: 'Helena Soares',
        telefone: null,
        email: 'helena@solar.com.br',
      });
      reqContato.flush({
        leadId: 'lead-sup',
        oferta: [slotA1],
      });
      tick();
      fixture.detectChanges();

      httpMock.expectNone('/api/conta/conversas');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('anonimo nao chama conta e exibe formulario vazio com validacao normal', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-anon');
      TestBed.inject(SessaoStore).usuario.set(null);
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectNone('/api/conta');
      httpMock.expectNone('/api/conta/conversas');

      httpMock.expectOne('/conversas/c-t4-anon').flush(
        conversaComOferta('c-t4-anon', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      const inputTel = html(fixture).querySelector('app-formulario-contato input[type="tel"]') as HTMLInputElement;
      const inputEmail = html(fixture).querySelector('app-formulario-contato input[type="email"]') as HTMLInputElement;

      expect(inputNome.value).toBe('');
      expect(inputTel.value).toBe('');
      expect(inputEmail.value).toBe('');

      const btnEnviar = html(fixture).querySelector('app-formulario-contato .acao') as HTMLButtonElement;
      expect(btnEnviar.disabled).toBeTrue();

      inputEmail.value = 'visitante@solar.com.br';
      inputEmail.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(btnEnviar.disabled).toBeFalse();
      btnEnviar.click();
      fixture.detectChanges();

      const reqContato = httpMock.expectOne('/conversas/c-t4-anon/contato');
      expect(reqContato.request.body).toEqual({
        nome: null,
        telefone: null,
        email: 'visitante@solar.com.br',
      });
      reqContato.flush({ leadId: 'lead-anon', oferta: [] });
      tick();
      fixture.detectChanges();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('falha HTTP 500 da conta deixa formulario vazio sem bloquear contato', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-falha-conta');
      TestBed.inject(SessaoStore).definir(sessaoCliente());
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const reqConta = httpMock.expectOne('/api/conta');
      reqConta.flush('Erro', { status: 500, statusText: 'Internal Server Error' });

      httpMock.expectOne('/api/conta/conversas').flush([
        { id: 'c-t4-falha-conta', titulo: 'Falha', atualizadaEm: AGORA, estado: 'em_andamento' },
      ]);
      httpMock.expectOne('/conversas/c-t4-falha-conta').flush(
        conversaComOferta('c-t4-falha-conta', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      const inputTel = html(fixture).querySelector('app-formulario-contato input[type="tel"]') as HTMLInputElement;
      const inputEmail = html(fixture).querySelector('app-formulario-contato input[type="email"]') as HTMLInputElement;

      expect(inputNome.value).toBe('');
      expect(inputTel.value).toBe('');
      expect(inputEmail.value).toBe('');

      inputTel.value = '11999998888';
      inputTel.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const btnEnviar = html(fixture).querySelector('app-formulario-contato .acao') as HTMLButtonElement;
      expect(btnEnviar.disabled).toBeFalse();

      btnEnviar.click();
      fixture.detectChanges();

      const reqContato = httpMock.expectOne('/conversas/c-t4-falha-conta/contato');
      expect(reqContato.request.body).toEqual({
        nome: null,
        telefone: '11999998888',
        email: null,
      });
      reqContato.flush({ leadId: 'lead-falha', oferta: [] });
      tick();
      fixture.detectChanges();

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('resposta tardia da conta nao sobrescreve campo editado e preenche campos nao editados', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-tardio');
      TestBed.inject(SessaoStore).definir(sessaoCliente());
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const reqConta = httpMock.expectOne('/api/conta');
      httpMock.expectOne('/api/conta/conversas').flush([
        { id: 'c-t4-tardio', titulo: 'Tardio', atualizadaEm: AGORA, estado: 'em_andamento' },
      ]);
      httpMock.expectOne('/conversas/c-t4-tardio').flush(
        conversaComOferta('c-t4-tardio', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      const inputTel = html(fixture).querySelector('app-formulario-contato input[type="tel"]') as HTMLInputElement;
      const inputEmail = html(fixture).querySelector('app-formulario-contato input[type="email"]') as HTMLInputElement;

      inputNome.value = 'Nome Editado Antes';
      inputNome.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      reqConta.flush(conta(VERSAO_AVISO_PRIVACIDADE));
      tick();
      fixture.detectChanges();

      expect(inputNome.value).toBe('Nome Editado Antes');
      expect(inputTel.value).toBe('(11) 98765-4321');
      expect(inputEmail.value).toBe('marina.couto@email.com');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('logout antes do retorno da conta descarta a resposta e limpa o formulario', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-logout');
      const sessao = TestBed.inject(SessaoStore);
      sessao.definir(sessaoCliente());
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const reqConta = httpMock.expectOne('/api/conta');
      httpMock.expectOne('/api/conta/conversas').flush([
        { id: 'c-t4-logout', titulo: 'Logout', atualizadaEm: AGORA, estado: 'em_andamento' },
      ]);
      httpMock.expectOne('/conversas/c-t4-logout').flush(
        conversaComOferta('c-t4-logout', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      sessao.limpar();
      fixture.detectChanges();

      reqConta.flush(conta(VERSAO_AVISO_PRIVACIDADE));
      tick();
      fixture.detectChanges();

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      const inputTel = html(fixture).querySelector('app-formulario-contato input[type="tel"]') as HTMLInputElement;
      const inputEmail = html(fixture).querySelector('app-formulario-contato input[type="email"]') as HTMLInputElement;

      expect(inputNome.value).toBe('');
      expect(inputTel.value).toBe('');
      expect(inputEmail.value).toBe('');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('troca de conversa no mesmo usuario reinicia alteracoes locais e preenche novamente da conta', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-conv1');
      TestBed.inject(SessaoStore).definir(sessaoCliente());
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      httpMock.expectOne('/api/conta').flush(conta(VERSAO_AVISO_PRIVACIDADE));
      httpMock.expectOne('/api/conta/conversas').flush([
        { id: 'c-t4-conv1', titulo: 'Conversa 1', atualizadaEm: AGORA, estado: 'em_andamento' },
        { id: 'c-t4-conv2', titulo: 'Conversa 2', atualizadaEm: AGORA, estado: 'em_andamento' },
      ]);
      httpMock.expectOne('/conversas/c-t4-conv1').flush(
        conversaComOferta('c-t4-conv1', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      const inputNome1 = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      expect(inputNome1.value).toBe('Marina Couto');

      inputNome1.value = 'Alteracao Local Na Conversa 1';
      inputNome1.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(inputNome1.value).toBe('Alteracao Local Na Conversa 1');

      void store.abrirConversa('c-t4-conv2');
      fixture.detectChanges();

      httpMock.expectOne('/conversas/c-t4-conv2').flush(
        conversaComOferta('c-t4-conv2', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      const inputNome2 = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      const inputTel2 = html(fixture).querySelector('app-formulario-contato input[type="tel"]') as HTMLInputElement;
      const inputEmail2 = html(fixture).querySelector('app-formulario-contato input[type="email"]') as HTMLInputElement;

      expect(inputNome2.value).toBe('Marina Couto');
      expect(inputTel2.value).toBe('(11) 98765-4321');
      expect(inputEmail2.value).toBe('marina.couto@email.com');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('troca imediata de cliente A para cliente B sem detectChanges antes do flush de A descarta A e aplica apenas dados e consentimento de B', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-troca-imediata');
      const sessao = TestBed.inject(SessaoStore);
      sessao.definir(sessaoCliente({ usuario: { id: 'u-cliente-a', nome: 'Cliente A', email: 'a@solar.com.br' } }));
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      const spyConsentimento = spyOn(store, 'definirConsentimentoDaConta').and.callThrough();
      fixture.detectChanges();

      const reqContaA = httpMock.expectOne('/api/conta');
      httpMock.expectOne('/api/conta/conversas').flush([
        { id: 'c-t4-troca-imediata', titulo: 'Troca', atualizadaEm: AGORA, estado: 'em_andamento' },
      ]);
      httpMock.expectOne('/conversas/c-t4-troca-imediata').flush(
        conversaComOferta('c-t4-troca-imediata', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      sessao.definir(sessaoCliente({ usuario: { id: 'u-cliente-b', nome: 'Cliente B', email: 'b@solar.com.br' } }));

      reqContaA.flush({
        id: 'u-cliente-a',
        nome: 'Cliente A',
        email: 'a@solar.com.br',
        telefone: '11911111111',
        perfil: 'cliente',
        criadaEm: '2026-09-22T14:08:00Z',
        corretor: null,
        consentimento: { em: '2026-09-22T14:08:00Z', versao: 'v-consentimento-A' },
        conversasSalvas: 0,
      });

      expect(spyConsentimento).not.toHaveBeenCalledWith('v-consentimento-A');

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      expect(inputNome.value).not.toBe('Cliente A');

      fixture.detectChanges();
      tick();

      const reqContaB = httpMock.expectOne('/api/conta');
      expect(reqContaB.request.method).toBe('GET');

      reqContaB.flush({
        id: 'u-cliente-b',
        nome: 'Cliente B',
        email: 'b@solar.com.br',
        telefone: '11922222222',
        perfil: 'cliente',
        criadaEm: '2026-09-22T14:08:00Z',
        corretor: null,
        consentimento: { em: '2026-09-22T14:08:00Z', versao: 'v-consentimento-B' },
        conversasSalvas: 0,
      });
      tick();
      fixture.detectChanges();

      expect(spyConsentimento).toHaveBeenCalledWith('v-consentimento-B');

      const inputTel = html(fixture).querySelector('app-formulario-contato input[type="tel"]') as HTMLInputElement;
      const inputEmail = html(fixture).querySelector('app-formulario-contato input[type="email"]') as HTMLInputElement;

      expect(inputNome.value).toBe('Cliente B');
      expect(inputTel.value).toBe('(11) 92222-2222');
      expect(inputEmail.value).toBe('b@solar.com.br');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('erro na requisicao de conta A apos troca imediata para cliente B sem detectChanges nao altera dados correntes', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-erro-imediato');
      const sessao = TestBed.inject(SessaoStore);
      sessao.definir(sessaoCliente({ usuario: { id: 'u-cliente-a', nome: 'Cliente A', email: 'a@solar.com.br' } }));
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const reqContaA = httpMock.expectOne('/api/conta');
      httpMock.expectOne('/api/conta/conversas').flush([
        { id: 'c-t4-erro-imediato', titulo: 'Erro', atualizadaEm: AGORA, estado: 'em_andamento' },
      ]);
      httpMock.expectOne('/conversas/c-t4-erro-imediato').flush(
        conversaComOferta('c-t4-erro-imediato', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      sessao.definir(sessaoCliente({ usuario: { id: 'u-cliente-b', nome: 'Cliente B', email: 'b@solar.com.br' } }));

      reqContaA.flush('Erro servidor A', { status: 500, statusText: 'Internal Server Error' });

      fixture.detectChanges();
      tick();

      const reqContaB = httpMock.expectOne('/api/conta');
      reqContaB.flush(conta(VERSAO_AVISO_PRIVACIDADE));
      tick();
      fixture.detectChanges();

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      expect(inputNome.value).toBe('Marina Couto');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));

    it('logout imediato sem detectChanges antes do retorno de A descarta resposta de A e nao aplica consentimento', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t4-logout-imediato');
      const sessao = TestBed.inject(SessaoStore);
      sessao.definir(sessaoCliente({ usuario: { id: 'u-cliente-a', nome: 'Cliente A', email: 'a@solar.com.br' } }));
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      const spyConsentimento = spyOn(store, 'definirConsentimentoDaConta').and.callThrough();
      fixture.detectChanges();

      const reqContaA = httpMock.expectOne('/api/conta');
      httpMock.expectOne('/api/conta/conversas').flush([
        { id: 'c-t4-logout-imediato', titulo: 'Logout', atualizadaEm: AGORA, estado: 'em_andamento' },
      ]);
      httpMock.expectOne('/conversas/c-t4-logout-imediato').flush(
        conversaComOferta('c-t4-logout-imediato', [], 'Helena Braga', true),
      );
      tick();
      fixture.detectChanges();

      sessao.limpar();

      reqContaA.flush({
        id: 'u-cliente-a',
        nome: 'Cliente A',
        email: 'a@solar.com.br',
        telefone: '11911111111',
        perfil: 'cliente',
        criadaEm: '2026-09-22T14:08:00Z',
        corretor: null,
        consentimento: { em: '2026-09-22T14:08:00Z', versao: 'v-consentimento-A' },
        conversasSalvas: 0,
      });

      expect(spyConsentimento).not.toHaveBeenCalled();

      fixture.detectChanges();
      tick();

      httpMock.expectNone('/api/conta');

      const inputNome = html(fixture).querySelector('app-formulario-contato input[type="text"]') as HTMLInputElement;
      expect(inputNome.value).toBe('');

      store.pararPolling();
      httpMock.verify();
      fixture.destroy();
      flush();
    }));
  });

  describe('S-48 Tarefa 6: horas nos avisos no DOM e rolagem', () => {
    it('renderiza as horas dos tres avisos no DOM e preserva apos recarregar conversa', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t6-dom-horas');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      fixture.detectChanges();

      const emEncaminhado = '2026-10-07T10:01:00-03:00';
      const emContato = '2026-10-07T10:05:00-03:00';
      const emConfirmado = '2026-10-07T10:10:00-03:00';

      const slot501: SlotOferecido = {
        id: 501,
        inicio: '2026-10-15T14:00:00-03:00',
        fim: '2026-10-15T15:00:00-03:00',
      };

      const conf: AgendamentoDaConversa = {
        estado: 'confirmado',
        horario: slot501,
        alternativas: [],
      };

      const msgsIniciais: MensagemDaConversa[] = [
        {
          papel: 'lead',
          texto: 'Quero um apartamento.',
          em: '2026-10-07T10:00:00-03:00',
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Encaminhando para Helena Braga.',
          em: emEncaminhado,
          proximaAcao: 'agendar_reuniao',
          corretor: 'Helena Braga',
          agendamento: null,
        },
      ];

      httpMock.expectOne('/conversas/c-t6-dom-horas').flush(
        conversaComOferta(
          'c-t6-dom-horas',
          [slot501],
          'Helena Braga',
          false,
          null,
          msgsIniciais,
          '2026-10-07T10:00:00Z',
          VERSAO_AVISO_PRIVACIDADE,
          emContato,
        ),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelectorAll('app-cartao-agendamento').length).toBe(1);
      const msgsPessoaAntes = Array.from(html(fixture).querySelectorAll('app-mensagem-pessoa'));
      expect(msgsPessoaAntes.length).toBeGreaterThanOrEqual(1);
      expect(msgsPessoaAntes.some((el) => el.textContent?.includes('Quero um apartamento.'))).toBeTrue();

      void store.registrarAgendamento(501);
      const reqPost = httpMock.expectOne({ method: 'POST', url: '/conversas/c-t6-dom-horas/agendamentos' });
      expect(reqPost.request.body).toEqual({ slotId: 501 });
      reqPost.flush(conf);
      tick();

      const msgsPersistidas: MensagemDaConversa[] = [
        ...msgsIniciais,
        {
          papel: 'lead',
          texto: 'Quinta, 15 de outubro às 14h',
          em: emConfirmado,
          proximaAcao: null,
          corretor: null,
          agendamento: null,
        },
        {
          papel: 'agente',
          texto: 'Reunião agendada com Helena Braga.',
          em: emConfirmado,
          proximaAcao: 'continuar_conversa',
          corretor: 'Helena Braga',
          agendamento: conf,
        },
      ];

      httpMock.expectOne({ method: 'GET', url: '/conversas/c-t6-dom-horas' }).flush(
        conversaComOferta(
          'c-t6-dom-horas',
          [],
          'Helena Braga',
          false,
          conf,
          msgsPersistidas,
          '2026-10-07T10:00:00Z',
          VERSAO_AVISO_PRIVACIDADE,
          emContato,
        ),
      );
      tick();
      fixture.detectChanges();

      expect(html(fixture).querySelectorAll('app-cartao-agendamento').length).toBe(0);

      const falasPessoaAoVivo = Array.from(html(fixture).querySelectorAll('app-mensagem-pessoa'));
      expect(falasPessoaAoVivo.some((el) => el.textContent?.includes('Quinta, 15 de outubro às 14h'))).toBeFalse();
      expect(falasPessoaAoVivo.some((el) => el.textContent?.includes('Quero um apartamento.'))).toBeTrue();

      const falasLiaAoVivo = Array.from(html(fixture).querySelectorAll('app-mensagem-lia'));
      expect(falasLiaAoVivo.some((el) => el.textContent?.includes('Reunião agendada com Helena Braga.'))).toBeFalse();
      expect(falasLiaAoVivo.some((el) => el.textContent?.includes('Encaminhando para Helena Braga.'))).toBeTrue();

      const eventosAoVivo = html(fixture).querySelectorAll('app-evento-sistema');
      expect(eventosAoVivo.length).toBe(3);

      const eventoEncAoVivo = Array.from(eventosAoVivo).find(
        (el) => el.querySelector('.rotulo')?.textContent?.trim() === 'Encaminhado',
      );
      const eventoContatoAoVivo = Array.from(eventosAoVivo).find(
        (el) => el.querySelector('.rotulo')?.textContent?.trim() === 'Contato enviado',
      );
      const eventoReuniaoAoVivo = Array.from(eventosAoVivo).find(
        (el) => el.querySelector('.rotulo')?.textContent?.trim() === 'Reunião agendada',
      );

      expect(eventoEncAoVivo).not.toBeNull();
      expect(eventoContatoAoVivo).not.toBeNull();
      expect(eventoReuniaoAoVivo).not.toBeNull();

      const horaEncAoVivo = eventoEncAoVivo?.querySelector('.hora')?.textContent?.trim();
      const horaContatoAoVivo = eventoContatoAoVivo?.querySelector('.hora')?.textContent?.trim();
      const horaReuniaoAoVivo = eventoReuniaoAoVivo?.querySelector('.hora')?.textContent?.trim();

      expect(horaEncAoVivo).toBe(horaDe(emEncaminhado));
      expect(horaContatoAoVivo).toBe(horaDe(emContato));
      expect(horaReuniaoAoVivo).toBe(horaDe(emConfirmado));

      store.pararPolling();
      fixture.destroy();
      flush();

      const fixtureReload = TestBed.createComponent(Chat);
      const storeReload = TestBed.inject(ConversaStore);
      fixtureReload.detectChanges();

      httpMock.expectOne({ method: 'GET', url: '/conversas/c-t6-dom-horas' }).flush(
        conversaComOferta(
          'c-t6-dom-horas',
          [],
          'Helena Braga',
          false,
          conf,
          msgsPersistidas,
          '2026-10-07T10:00:00Z',
          VERSAO_AVISO_PRIVACIDADE,
          emContato,
        ),
      );
      tick();
      fixtureReload.detectChanges();

      expect(html(fixtureReload).querySelectorAll('app-cartao-agendamento').length).toBe(0);

      const falasPessoaReload = Array.from(html(fixtureReload).querySelectorAll('app-mensagem-pessoa'));
      expect(falasPessoaReload.some((el) => el.textContent?.includes('Quinta, 15 de outubro às 14h'))).toBeFalse();
      expect(falasPessoaReload.some((el) => el.textContent?.includes('Quero um apartamento.'))).toBeTrue();

      const falasLiaReload = Array.from(html(fixtureReload).querySelectorAll('app-mensagem-lia'));
      expect(falasLiaReload.some((el) => el.textContent?.includes('Reunião agendada com Helena Braga.'))).toBeFalse();
      expect(falasLiaReload.some((el) => el.textContent?.includes('Encaminhando para Helena Braga.'))).toBeTrue();

      const eventosReload = html(fixtureReload).querySelectorAll('app-evento-sistema');
      expect(eventosReload.length).toBe(3);

      const eventoEncReload = Array.from(eventosReload).find(
        (el) => el.querySelector('.rotulo')?.textContent?.trim() === 'Encaminhado',
      );
      const eventoContatoReload = Array.from(eventosReload).find(
        (el) => el.querySelector('.rotulo')?.textContent?.trim() === 'Contato enviado',
      );
      const eventoReuniaoReload = Array.from(eventosReload).find(
        (el) => el.querySelector('.rotulo')?.textContent?.trim() === 'Reunião agendada',
      );

      expect(eventoEncReload?.querySelector('.hora')?.textContent?.trim()).toBe(horaEncAoVivo);
      expect(eventoContatoReload?.querySelector('.hora')?.textContent?.trim()).toBe(horaContatoAoVivo);
      expect(eventoReuniaoReload?.querySelector('.hora')?.textContent?.trim()).toBe(horaReuniaoAoVivo);

      storeReload.pararPolling();
      httpMock.verify();
      fixtureReload.destroy();
      flush();
    }));

    it('atualizacao isolada de hora em evento e fala da Lia nao executa setter de scroll nem no topo nem perto do fim', fakeAsync(() => {
      localStorage.setItem('solar.conversaId', 'c-t6-scroll');
      const fixture = TestBed.createComponent(Chat);
      const store = TestBed.inject(ConversaStore);
      const hostEl = fixture.nativeElement as HTMLElement;
      hostEl.style.height = '350px';
      hostEl.style.display = 'flex';
      document.body.appendChild(hostEl);
      fixture.detectChanges();

      const muitasMensagens: MensagemDaConversa[] = [];
      for (let i = 0; i < 30; i++) {
        muitasMensagens.push({
          papel: i % 2 === 0 ? 'lead' : 'agente',
          texto: `Mensagem historico ${i} com texto suficiente para gerar rolagem no palco do chat.`,
          em: '2026-10-07T10:00:00Z',
          proximaAcao: i === 29 ? 'agendar_reuniao' : null,
          corretor: i === 29 ? 'Helena Braga' : null,
          agendamento: null,
        });
      }

      httpMock.expectOne('/conversas/c-t6-scroll').flush(
        conversaComOferta('c-t6-scroll', [], 'Helena Braga', false, null, muitasMensagens),
      );
      tick();
      fixture.detectChanges();

      const palco = hostEl.querySelector('.palco') as HTMLElement;
      expect(palco).not.toBeNull();
      const maximo = (el: HTMLElement) => el.scrollHeight - el.clientHeight;
      expect(maximo(palco)).toBeGreaterThan(200);

      const spyScrollTop = spyOnProperty(Element.prototype, 'scrollTop', 'set').and.callThrough();

      palco.scrollTop = 0;
      fixture.detectChanges();
      tick();
      spyScrollTop.calls.reset();

      store.itens.update((itens) =>
        itens.map((item) => {
          if (item.tipo === 'evento' && item.rotulo === 'Encaminhado') {
            return { ...item, hora: '10:01' };
          }
          if (item.tipo === 'lia') {
            return { ...item, hora: '10:01' };
          }
          return item;
        }),
      );
      fixture.detectChanges();
      tick();

      expect(spyScrollTop).not.toHaveBeenCalled();
      expect(palco.scrollTop).toBe(0);

      const posicaoPerto = maximo(palco) - 30;
      expect(maximo(palco) - posicaoPerto).toBeLessThanOrEqual(80);
      palco.scrollTop = posicaoPerto;
      fixture.detectChanges();
      tick();
      spyScrollTop.calls.reset();

      store.itens.update((itens) =>
        itens.map((item) => {
          if (item.tipo === 'evento' && item.rotulo === 'Encaminhado') {
            return { ...item, hora: '10:02' };
          }
          if (item.tipo === 'lia') {
            return { ...item, hora: '10:02' };
          }
          return item;
        }),
      );
      fixture.detectChanges();
      tick();

      expect(spyScrollTop).not.toHaveBeenCalled();
      expect(palco.scrollTop).toBe(posicaoPerto);

      store.pararPolling();
      httpMock.verify();
      if (hostEl.parentNode) {
        document.body.removeChild(hostEl);
      }
      fixture.destroy();
      flush();
    }));
  });
});
});
