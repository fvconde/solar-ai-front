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
      expect(cartaoJaConfirmado).not.toBeNull();
      const slotsJaConfirmados = cartaoJaConfirmado?.querySelectorAll('.slot-botao');
      expect(slotsJaConfirmados?.length).toBe(1);
      const btnConfirmado = slotsJaConfirmados?.[0] as HTMLButtonElement;
      expect(btnConfirmado.disabled).toBeTrue();
      expect(btnConfirmado.getAttribute('aria-pressed')).toBe('true');
      expect(cartaoJaConfirmado?.querySelector('.link-recolher')).toBeNull();
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
              em: '2026-10-07T10:02:05Z',
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
      expect(cartaoAposConfirmacao).not.toBeNull();

      const slotsConfirmados = cartaoAposConfirmacao?.querySelectorAll('.slot-botao');
      expect(slotsConfirmados?.length).toBe(1);
      const slotConfirmadoEl = slotsConfirmados?.[0] as HTMLButtonElement;
      expect(slotConfirmadoEl.disabled).toBeTrue();
      expect(slotConfirmadoEl.getAttribute('aria-pressed')).toBe('true');
      expect(slotConfirmadoEl.classList.contains('selecionado')).toBeTrue();
      expect(cartaoAposConfirmacao?.querySelector('.link-recolher')).toBeNull();

      const eventoCompacto = html(fixture).querySelector('.evento-compacto');
      expect(eventoCompacto).toBeNull();
      expect(html(fixture).querySelectorAll('.icone-check').length).toBe(0);

      const elementosNaColuna = Array.from(html(fixture).querySelector('.coluna')?.children ?? []);
      const elLead = elementosNaColuna.find((el) => el.tagName.toLowerCase() === 'app-mensagem-pessoa');
      const elEvento = elementosNaColuna.find((el) => el.tagName.toLowerCase() === 'app-evento-sistema');
      const elLia = elementosNaColuna.find((el) => el.tagName.toLowerCase() === 'app-mensagem-lia');

      expect(elLead).toBeDefined();
      expect(elEvento).toBeDefined();
      expect(elEvento?.textContent).toContain('Contato enviado');
      expect(elEvento?.textContent).toContain('O corretor usará o contato que você forneceu.');
      expect(elLia).toBeDefined();

      const idxLead = elementosNaColuna.indexOf(elLead!);
      const idxLia = elementosNaColuna.indexOf(elLia!);

      expect(idxLead).toBeLessThan(idxLia);
      expect(elLia?.textContent).toContain(
        'Combinado! Helena Braga vai te chamar no contato que você forneceu no horário agendado.',
      );

      document.documentElement.setAttribute('data-tema', 'claro');
      fixture.detectChanges();
      expect(window.getComputedStyle(slotConfirmadoEl).borderTopColor).toBeTruthy();

      document.documentElement.setAttribute('data-tema', 'escuro');
      fixture.detectChanges();
      expect(window.getComputedStyle(slotConfirmadoEl).borderTopColor).toBeTruthy();

      document.documentElement.removeAttribute('data-tema');
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
      expect(cartaoRecuperado).not.toBeNull();
      const slotsRecuperados = cartaoRecuperado?.querySelectorAll('.slot-botao');
      expect(slotsRecuperados?.length).toBe(1);
      const btnSlot = slotsRecuperados?.[0] as HTMLButtonElement;
      expect(btnSlot.disabled).toBeTrue();
      expect(btnSlot.getAttribute('aria-pressed')).toBe('true');
      expect(cartaoRecuperado?.querySelector('.link-recolher')).toBeNull();

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

    it('geometria wide centraliza cartao de agendamento confirmado com diferenca menor ou igual a 1px em relacao a coluna', fakeAsync(() => {
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
          [],
          'Helena Braga',
          false,
          { estado: 'confirmado', horario: slotA1, alternativas: [] },
          [
            {
              papel: 'agente',
              texto: 'Reunião confirmada.',
              em: '2026-10-07T10:00:00Z',
              proximaAcao: 'agendar_reuniao',
              corretor: 'Helena Braga',
              agendamento: { estado: 'confirmado', horario: slotA1, alternativas: [] },
            },
          ],
        ),
      );
      tick();
      fixture.detectChanges();

      const coluna = hostEl.querySelector('.coluna') as HTMLElement;
      const cartao = hostEl.querySelector('.cartao') as HTMLElement;
      expect(coluna).not.toBeNull();
      expect(cartao).not.toBeNull();
      expect(hostEl.querySelector('.evento-compacto')).toBeNull();

      const rectColuna = coluna.getBoundingClientRect();
      const rectCartao = cartao.getBoundingClientRect();

      const centroColuna = rectColuna.left + rectColuna.width / 2;
      const centroCartao = rectCartao.left + rectCartao.width / 2;
      const diferenca = Math.abs(centroColuna - centroCartao);

      expect(diferenca).toBeLessThanOrEqual(1);

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

      expect(palco.scrollTop).toBeGreaterThan(0);

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
