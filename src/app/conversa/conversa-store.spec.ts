import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConversaApi } from './conversa-api';
import { ConversaStore } from './conversa-store';
import {
  AgendamentoDaConversa,
  ConversaResponse,
  ExclusaoTitularResponse,
  ImovelSugerido,
  MensagemDaConversa,
  MensagemResponse,
  PerfilLead,
  ProximaAcao,
  SlotOferecido,
  VERSAO_AVISO_PRIVACIDADE,
} from './contrato';
import { ItemLia, ItemTrilha } from './trilha';
import { dataDoAgendamento, horaDe } from './horario';

const PERFIL_VAZIO: PerfilLead = {
  nome: null,
  intencao: null,
  precoMin: null,
  precoMax: null,
  quartos: null,
  regiao: null,
  urgencia: null,
  expectativaRetorno: null,
  score: null,
};

const RESPOSTA_ABERTURA = {
  conversaId: 'c1',
  resposta: 'Olá, como posso ajudar?',
  intencao: 'INDEFINIDA',
  proximaAcao: 'continuar_conversa' as const,
  perfilLead: PERFIL_VAZIO,
  imoveisSugeridos: [],
  corretor: null,
  contatoPendente: true,
  agendamento: null,
};

function fala(
  papel: 'lead' | 'agente',
  texto: string,
  proximaAcao: ProximaAcao | null = null,
  dias = 0,
  corretor: string | null = null,
  agendamento: AgendamentoDaConversa | null = null,
  imoveisSugeridos: ImovelSugerido[] | null = null,
): MensagemDaConversa {
  const em = new Date();
  em.setDate(em.getDate() - dias);
  return { papel, texto, em: em.toISOString(), proximaAcao, corretor, agendamento, imoveisSugeridos };
}

function conversa(
  mensagens: MensagemDaConversa[],
  contatoPendente = false,
  perfilLead = PERFIL_VAZIO,
  oferta: SlotOferecido[] = [],
): ConversaResponse {
  return {
    conversaId: 'c1',
    perfilLead,
    mensagens,
    contatoPendente,
    consentimentoEm: new Date().toISOString(),
    versaoAvisoPrivacidade: '2026-09-11',
    oferta,
  };
}

function textoDoEvento(itens: ItemTrilha[]): string {
  const evento = itens.find((item) => item.tipo === 'evento');
  return evento && evento.tipo === 'evento' ? evento.texto : '';
}

describe('ConversaStore ao retomar', () => {
  let store: ConversaStore;
  let api: jasmine.SpyObj<ConversaApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ConversaApi>('ConversaApi', [
      'obterConversa',
      'enviarMensagem',
      'registrarContato',
      'registrarConsentimento',
      'apagarConversa',
      'registrarAgendamento',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConversaApi, useValue: api },
      ],
    });

    localStorage.setItem('solar.conversaId', 'c1');
    store = TestBed.inject(ConversaStore);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  function tipos(itens: ItemTrilha[]): string[] {
    return itens.map((item) => item.tipo);
  }

  it('nao renderiza a mensagem de abertura', async () => {
    api.obterConversa.and.resolveTo(
      conversa([fala('lead', 'Olá'), fala('agente', 'Oi, em que posso ajudar?', 'continuar_conversa')]),
    );

    await store.iniciar();

    expect(tipos(store.itens())).toEqual(['divisor', 'lia']);
  });

  it('reconstroi o evento de desfecho depois da fala da Lia', async () => {
    api.obterConversa.and.resolveTo(
      conversa([
        fala('lead', 'Olá'),
        fala('agente', 'Oi', 'continuar_conversa'),
        fala('lead', 'quero falar com alguem'),
        fala('agente', 'Vou te passar para um corretor.', 'agendar_reuniao'),
      ]),
    );

    await store.iniciar();

    expect(tipos(store.itens())).toEqual(['divisor', 'lia', 'pessoa', 'lia', 'evento']);
  });

  it('o evento reconstruido nomeia o corretor atribuido', async () => {
    api.obterConversa.and.resolveTo(
      conversa([
        fala('lead', 'quero marcar'),
        fala('agente', 'Vou te passar para um corretor.', 'agendar_reuniao', 0, 'Helena Braga'),
      ]),
    );

    await store.iniciar();

    expect(textoDoEvento(store.itens())).toContain('Helena Braga');
  });

  it('sem corretor atribuido o evento nao inventa nome', async () => {
    api.obterConversa.and.resolveTo(
      conversa([
        fala('lead', 'quero marcar'),
        fala('agente', 'Vou te passar para um corretor.', 'agendar_reuniao'),
      ]),
    );

    await store.iniciar();

    expect(textoDoEvento(store.itens())).toBe(
      'Sua conversa foi encaminhada para a Solar. Um corretor assume a partir do que você já contou.',
    );
  });

  it('reconstroi a confirmacao do horario como fato do sistema', async () => {
    api.obterConversa.and.resolveTo(
      conversa([
        fala('lead', 'quinta as tres'),
        fala('agente', 'Vou reservar esse horário.', 'agendar_reuniao', 0, 'Helena Braga', {
          estado: 'confirmado',
          horario: {
            id: 42,
            inicio: '2026-09-10T15:00:00-03:00',
            fim: '2026-09-10T16:00:00-03:00',
          },
          alternativas: [],
        }),
      ]),
    );

    await store.iniciar();

    const eventoConfirmadaAntigo = store.itens().find((item) => item.tipo === 'evento' && item.rotulo === 'Reunião confirmada');
    expect(eventoConfirmadaAntigo).toBeUndefined();
    expect(store.agendamentoConfirmado()).toEqual({
      estado: 'confirmado',
      horario: {
        id: 42,
        inicio: '2026-09-10T15:00:00-03:00',
        fim: '2026-09-10T16:00:00-03:00',
      },
      alternativas: [],
    });
    expect(tipos(store.itens())).toEqual(['divisor', 'pessoa', 'evento', 'evento']);
    const eventoReuniao = store.itens().find((item) => item.tipo === 'evento' && item.rotulo === 'Reunião agendada');
    expect(eventoReuniao).toBeDefined();
    const eventoContato = store.itens().find((item) => item.tipo === 'evento' && item.rotulo === 'Contato enviado');
    expect(eventoContato).toBeDefined();
  });

  it('corrida perdida mostra as alternativas livres', async () => {
    api.obterConversa.and.resolveTo(
      conversa([
        fala('lead', 'quinta as tres'),
        fala('agente', 'Vou reservar esse horário.', 'agendar_reuniao', 0, 'Helena Braga', {
          estado: 'indisponivel',
          horario: null,
          alternativas: [
            {
              id: 43,
              inicio: '2026-09-11T11:00:00-03:00',
              fim: '2026-09-11T12:00:00-03:00',
            },
          ],
        }),
      ]),
    );

    await store.iniciar();

    expect(textoDoEvento(store.itens())).toContain('acabou de ser reservado');
    expect(textoDoEvento(store.itens())).toContain('11:00');
  });

  it('pede contato no handoff quando o lead ainda nao informou', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'quero marcar'),
          fala('agente', 'Vou te passar.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        true,
      ),
    );

    await store.iniciar();

    expect(tipos(store.itens())).toEqual(['divisor', 'pessoa', 'lia', 'evento', 'contato']);
  });

  it('lead que ja tem contato nao ve o formulario de novo', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'quero marcar'),
          fala('agente', 'Vou te passar.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        false,
      ),
    );

    await store.iniciar();

    expect(tipos(store.itens())).not.toContain('contato');
  });

  it('sem handoff nenhum o formulario nao aparece', async () => {
    api.obterConversa.and.resolveTo(
      conversa([fala('lead', 'oi'), fala('agente', 'Em que regiao?', 'continuar_conversa')], true),
    );

    await store.iniciar();

    expect(tipos(store.itens())).not.toContain('contato');
  });

  it('contato enviado troca o formulario por um evento de confirmacao', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'quero marcar'),
          fala('agente', 'Vou te passar.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        true,
      ),
    );
    api.registrarContato.and.resolveTo({ leadId: 'l1', oferta: [] });

    await store.iniciar();
    await store.enviarContato({ nome: 'Ana', telefone: '11999998888', email: null });

    expect(tipos(store.itens())).not.toContain('contato');
    expect(store.contatoErro()).toBeNull();
  });

  it('falha ao registrar contato mantem o formulario e avisa', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'quero marcar'),
          fala('agente', 'Vou te passar.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        true,
      ),
    );
    api.registrarContato.and.rejectWith(new Error('rede fora'));

    await store.iniciar();
    await store.enviarContato({ nome: 'Ana', telefone: '11999998888', email: null });

    expect(tipos(store.itens())).toContain('contato');
    expect(store.contatoErro()).not.toBeNull();
  });

  it('conversa encerrada continua encerrada depois do reload', async () => {
    api.obterConversa.and.resolveTo(
      conversa([fala('lead', 'tchau'), fala('agente', 'Até mais.', 'encerrar')]),
    );

    await store.iniciar();

    expect(store.estado()).toBe('encerrada');
    expect(store.composerRemovido()).toBeTrue();
  });

  it('conversa em andamento volta conversando', async () => {
    api.obterConversa.and.resolveTo(
      conversa([fala('lead', 'oi'), fala('agente', 'Em que regiao?', 'continuar_conversa')]),
    );

    await store.iniciar();

    expect(store.estado()).toBe('conversando');
    expect(store.envioDisponivel()).toBeTrue();
  });

  it('abre um divisor por dia de calendario', async () => {
    api.obterConversa.and.resolveTo(
      conversa([
        fala('lead', 'oi', null, 2),
        fala('agente', 'Em que regiao?', 'continuar_conversa', 2),
        fala('lead', 'voltei', null, 0),
        fala('agente', 'Que bom.', 'continuar_conversa', 0),
      ]),
    );

    await store.iniciar();

    expect(tipos(store.itens())).toEqual(['divisor', 'pessoa', 'lia', 'divisor', 'pessoa', 'lia']);
  });

  it('falha ao retomar NAO cria conversa nova nem troca o guid salvo', async () => {
    api.obterConversa.and.rejectWith(new Error('rede fora'));

    await store.iniciar();

    expect(localStorage.getItem('solar.conversaId')).toBe('c1');
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(store.estado()).toBe('falha');
  });

  it('falha ao retomar oferece tentar de novo, e a segunda tentativa reconstroi', async () => {
    api.obterConversa.and.rejectWith(new Error('rede fora'));
    await store.iniciar();

    api.obterConversa.and.resolveTo(
      conversa([fala('lead', 'oi'), fala('agente', 'Em que regiao?', 'continuar_conversa')]),
    );
    store.atenderAcao({ rotulo: 'Tentar novamente', tipo: 'retomar' });
    await Promise.resolve();
    await Promise.resolve();

    expect(store.estado()).toBe('conversando');
    expect(tipos(store.itens())).toEqual(['divisor', 'pessoa', 'lia']);
  });

  it('confirma o carimbo no servidor antes de enviar o kickoff', async () => {
    api.registrarConsentimento.and.resolveTo({
      conversaId: 'c1',
      leadId: 'l1',
      consentimentoEm: new Date().toISOString(),
      versaoAvisoPrivacidade: '2026-09-11',
    });
    api.obterConversa.and.resolveTo(conversa([]));
    api.enviarMensagem.and.resolveTo(RESPOSTA_ABERTURA);

    await store.aceitar();

    expect(api.registrarConsentimento).toHaveBeenCalledBefore(api.enviarMensagem);
    expect(api.enviarMensagem).toHaveBeenCalledOnceWith('c1', 'Olá');
    expect(store.estado()).toBe('conversando');
  });

  it('falha no carimbo nao envia kickoff', async () => {
    api.registrarConsentimento.and.rejectWith(new Error('rede fora'));

    await store.aceitar();

    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(store.estado()).toBe('aceite-pendente');
    expect(store.aceiteErro()).not.toBeNull();
  });

  it('carimbo ausente no servidor volta a pedir aceite', async () => {
    api.obterConversa.and.resolveTo({
      ...conversa([]),
      consentimentoEm: null,
      versaoAvisoPrivacidade: null,
    });

    await store.iniciar();

    expect(store.estado()).toBe('aceite-pendente');
    expect(api.enviarMensagem).not.toHaveBeenCalled();
  });

  it('recusa sem conversa salva nao chama a API nem cria identificador', () => {
    localStorage.clear();

    store.recusar();

    expect(api.registrarConsentimento).not.toHaveBeenCalled();
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(localStorage.getItem('solar.conversaId')).toBeNull();
  });

  it('reconstroi a trilha com mensagem de reengajamento ao retomar conversa', async () => {
    api.obterConversa.and.resolveTo(
      conversa([
        fala('lead', 'Olá'),
        fala('agente', 'Oi, em que posso ajudar?', 'continuar_conversa'),
        fala('lead', 'quero apto no Tatuapé até 500 mil'),
        fala('agente', 'Tatuapé é uma boa região.', 'continuar_conversa'),
        fala('agente', 'Oi! Lembrei da sua busca no Tatuapé até 500 mil, quer ver novas opções?', 'continuar_conversa'),
      ]),
    );

    await store.iniciar();

    expect(tipos(store.itens())).toEqual(['divisor', 'lia', 'pessoa', 'lia', 'lia']);
    const ultimoItem = store.itens()[4];
    expect(ultimoItem.tipo).toBe('lia');
    if (ultimoItem.tipo === 'lia') {
      expect(ultimoItem.texto).toContain('Tatuapé até 500 mil');
    }
  });

  it('polling na aba aberta entrega mensagem de reengajamento ao vivo', async () => {
    const inicial = [
      fala('lead', 'Olá'),
      fala('agente', 'Oi, em que posso ajudar?', 'continuar_conversa'),
    ];
    api.obterConversa.and.resolveTo(conversa(inicial));

    await store.iniciar();
    expect(tipos(store.itens())).toEqual(['divisor', 'lia']);

    const atualizada = [
      ...inicial,
      fala('agente', 'Oi! Lembrei da sua busca por apartamentos, ainda tem interesse?', 'continuar_conversa'),
    ];
    api.obterConversa.and.resolveTo(conversa(atualizada));

    await store.verificarNovasMensagens();

    expect(tipos(store.itens())).toEqual(['divisor', 'lia', 'lia']);
    const ultimoItem = store.itens()[2];
    expect(ultimoItem.tipo).toBe('lia');
    if (ultimoItem.tipo === 'lia') {
      expect(ultimoItem.texto).toContain('Lembrei da sua busca');
    }
  });

  it('polling atualiza estado para encerrada quando mensagem proativa tem desfecho encerrar', async () => {
    const inicial = [
      fala('lead', 'Olá'),
      fala('agente', 'Oi, em que posso ajudar?', 'continuar_conversa'),
    ];
    api.obterConversa.and.resolveTo(conversa(inicial));

    await store.iniciar();
    expect(store.estado()).toBe('conversando');

    const atualizada = [
      ...inicial,
      fala('agente', 'Esta conversa foi encerrada por inatividade.', 'encerrar'),
    ];
    api.obterConversa.and.resolveTo(conversa(atualizada));

    await store.verificarNovasMensagens();

    expect(store.estado()).toBe('encerrada');
    expect(tipos(store.itens())).toEqual(['divisor', 'lia', 'lia', 'evento']);
  });

  it('polling nao duplica mensagens se nada mudou', async () => {
    const inicial = [
      fala('lead', 'Olá'),
      fala('agente', 'Oi, em que posso ajudar?', 'continuar_conversa'),
    ];
    api.obterConversa.and.resolveTo(conversa(inicial));

    await store.iniciar();
    const contagemInicial = store.itens().length;

    await store.verificarNovasMensagens();
    await store.verificarNovasMensagens();

    expect(store.itens().length).toBe(contagemInicial);
  });

  it('reconstroi cartoes de imoveis sugeridos com mesma ordem e motivo ao retomar', async () => {
    const imoveisExemplo: ImovelSugerido[] = [
      {
        id: 'sp-moema-01',
        tipo: 'apartamento',
        bairro: 'Moema',
        quartos: 3,
        metragem: 95,
        precoVenda: 1200000,
        precoAluguel: null,
        motivo: 'Ideal para família com 3 quartos perto do parque',
      },
      {
        id: 'sp-moema-02',
        tipo: 'apartamento',
        bairro: 'Moema',
        quartos: 2,
        metragem: 70,
        precoVenda: 850000,
        precoAluguel: null,
        motivo: 'Ótimo custo-benefício na região solicitada',
      },
      {
        id: 'sp-pinheiros-03',
        tipo: 'apartamento',
        bairro: 'Pinheiros',
        quartos: 2,
        metragem: 65,
        precoVenda: 900000,
        precoAluguel: null,
        motivo: 'Excelente localização com metrô próximo',
      },
    ];

    api.obterConversa.and.resolveTo(
      conversa([
        fala('lead', 'Olá'),
        fala(
          'agente',
          'Encontrei 3 imóveis para você:',
          'sugerir_imoveis',
          0,
          null,
          null,
          imoveisExemplo,
        ),
      ]),
    );

    await store.iniciar();

    const itens = store.itens();
    expect(tipos(itens)).toEqual(['divisor', 'lia']);

    const itemLia = itens[1] as ItemLia;
    expect(itemLia.tipo).toBe('lia');
    expect(itemLia.imoveis.length).toBe(3);
    expect(itemLia.imoveis[0].id).toBe('sp-moema-01');
    expect(itemLia.imoveis[0].motivo).toBe('Ideal para família com 3 quartos perto do parque');
    expect(itemLia.imoveis[1].id).toBe('sp-moema-02');
    expect(itemLia.imoveis[1].motivo).toBe('Ótimo custo-benefício na região solicitada');
    expect(itemLia.imoveis[2].id).toBe('sp-pinheiros-03');
    expect(itemLia.imoveis[2].motivo).toBe('Excelente localização com metrô próximo');
  });

  it('preserva a intencao do perfil do lead ao reconstruir a fala da Lia com imoveis', async () => {
    const imoveisExemplo: ImovelSugerido[] = [
      {
        id: 'sp-01',
        tipo: 'apartamento',
        bairro: 'Moema',
        quartos: 2,
        metragem: 60,
        precoVenda: 700000,
        precoAluguel: 3500,
        motivo: 'Boa localização',
      },
    ];

    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Olá'),
          fala(
            'agente',
            'Aqui está uma opção:',
            'sugerir_imoveis',
            0,
            null,
            null,
            imoveisExemplo,
          ),
        ],
        false,
        { ...PERFIL_VAZIO, intencao: 'aluguel' },
      ),
    );

    await store.iniciar();

    const itemLia = store.itens()[1] as ItemLia;
    expect(itemLia.intencao).toBe('aluguel');
    expect(itemLia.imoveis.length).toBe(1);
    expect(itemLia.imoveis[0].precoAluguel).toBe(3500);
  });
});

describe('ConversaStore exclusao titular', () => {
  let store: ConversaStore;
  let api: jasmine.SpyObj<ConversaApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ConversaApi>('ConversaApi', [
      'obterConversa',
      'enviarMensagem',
      'registrarContato',
      'registrarConsentimento',
      'apagarConversa',
      'registrarAgendamento',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConversaApi, useValue: api },
      ],
    });

    localStorage.setItem('solar.conversaId', 'c1');
    store = TestBed.inject(ConversaStore);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('podeApagarConversa e verdadeiro somente quando existe id e ja passou pelo aceite', async () => {
    localStorage.clear();
    const storeNova = TestBed.inject(ConversaStore);
    expect(storeNova.podeApagarConversa()).toBeFalse();

    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    localStorage.setItem('solar.conversaId', 'c1');
    await store.iniciar();
    expect(store.podeApagarConversa()).toBeTrue();
  });

  it('ambos os escopos limpam somente a conversa local preservando preferencias e login', async () => {
    localStorage.setItem('solar.outro', 'tema-escuro');
    localStorage.setItem('solar.conta', 'token-ou-email');
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    await store.iniciar();

    const mockRespostaVinculos: ExclusaoTitularResponse = {
      leadExcluido: true,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    };
    api.apagarConversa.and.resolveTo(mockRespostaVinculos);

    const sucesso1 = await store.apagarConversa();
    expect(sucesso1).toBeTrue();
    expect(store.conversaApagada()).toBeTrue();
    expect(store.conversaGuardada()).toBeNull();
    expect(store.itens()).toEqual([]);
    expect(localStorage.getItem('solar.conversaId')).toBeNull();
    expect(localStorage.getItem('solar.outro')).toBe('tema-escuro');
    expect(localStorage.getItem('solar.conta')).toBe('token-ou-email');

    localStorage.setItem('solar.conversaId', 'c2');
    api.obterConversa.and.resolveTo({ ...conversa([]), conversaId: 'c2' });
    await store.abrirConversa('c2');
    const mockRespostaApenasConversa: ExclusaoTitularResponse = {
      leadExcluido: false,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'apenas_conversa',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    };
    api.apagarConversa.and.resolveTo(mockRespostaApenasConversa);

    const sucesso2 = await store.apagarConversa();
    expect(sucesso2).toBeTrue();
    expect(store.conversaApagada()).toBeTrue();
    expect(store.conversaGuardada()).toBeNull();

    localStorage.setItem('solar.conversaId', 'c3');
    api.obterConversa.and.resolveTo({ ...conversa([]), conversaId: 'c3' });
    await store.abrirConversa('c3');
    api.apagarConversa.and.rejectWith(new HttpErrorResponse({ status: 404 }));

    const sucesso404 = await store.apagarConversa();
    expect(sucesso404).toBeTrue();
    expect(store.conversaApagada()).toBeTrue();
    expect(store.conversaGuardada()).toBeNull();
  });

  it('403, 409 e 429 preservam estado com erro confirmada sem GET de verificacao', async () => {
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    await store.iniciar();

    for (const status of [403, 409, 429]) {
      api.obterConversa.calls.reset();
      api.apagarConversa.and.rejectWith(new HttpErrorResponse({ status }));

      const sucesso = await store.apagarConversa();
      expect(sucesso).toBeFalse();
      expect(store.erroExclusao()).toBe('confirmada');
      expect(store.conversaGuardada()).toBe('c1');
      expect(store.itens().length).toBeGreaterThan(0);
      expect(api.obterConversa).not.toHaveBeenCalled();
    }
  });

  it('rede com status 0 trata GET 200 como confirmada, GET 404 como incerta e falha no GET como incerta', async () => {
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    await store.iniciar();

    api.apagarConversa.and.rejectWith(new HttpErrorResponse({ status: 0 }));
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá')]));

    const res1 = await store.apagarConversa();
    expect(res1).toBeFalse();
    expect(store.erroExclusao()).toBe('confirmada');
    expect(store.conversaGuardada()).toBe('c1');

    api.obterConversa.and.rejectWith(new HttpErrorResponse({ status: 404 }));

    const res2 = await store.apagarConversa();
    expect(res2).toBeFalse();
    expect(store.erroExclusao()).toBe('incerta');
    expect(store.conversaGuardada()).toBe('c1');

    api.obterConversa.and.rejectWith(new Error('conexao recusada'));

    const res3 = await store.apagarConversa();
    expect(res3).toBeFalse();
    expect(store.erroExclusao()).toBe('incerta');
    expect(store.conversaGuardada()).toBe('c1');

    api.apagarConversa.and.rejectWith(new HttpErrorResponse({ status: 404 }));
    const retry = await store.apagarConversa();
    expect(retry).toBeTrue();
    expect(store.conversaApagada()).toBeTrue();
    expect(store.conversaGuardada()).toBeNull();
  });

  it('dois cliques concorrentes emitem somente um DELETE e acoes mutantes sao barradas durante exclusao', async () => {
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    await store.iniciar();

    let resolverDelete!: (v: ExclusaoTitularResponse) => void;
    api.apagarConversa.and.returnValue(
      new Promise<ExclusaoTitularResponse>((resolve) => {
        resolverDelete = resolve;
      }),
    );

    const p1 = store.apagarConversa();
    const p2 = store.apagarConversa();
    expect(api.apagarConversa).toHaveBeenCalledTimes(1);

    expect(store.apagando()).toBeTrue();
    expect(store.envioDisponivel()).toBeFalse();

    await store.enviar('mensagem ignorada');
    await store.novaConversa();
    await store.aceitar();
    expect(api.enviarMensagem).not.toHaveBeenCalled();

    resolverDelete({
      leadExcluido: true,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBeTrue();
    expect(r2).toBeFalse();
    expect(store.conversaApagada()).toBeTrue();
  });

  it('resposta tardia de turno e polling em andamento nao repoem trilha nem estado apos exclusao', async () => {
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    await store.iniciar();

    let resolverPolling!: (v: ConversaResponse) => void;
    api.obterConversa.and.returnValue(
      new Promise<ConversaResponse>((resolve) => {
        resolverPolling = resolve;
      }),
    );

    void store.verificarNovasMensagens();
    expect(api.obterConversa).toHaveBeenCalledWith('c1');

    let resolverMensagem!: (v: MensagemResponse) => void;
    api.enviarMensagem.and.returnValue(
      new Promise<MensagemResponse>((resolve) => {
        resolverMensagem = resolve;
      }),
    );

    void store.enviar('mensagem antes de apagar');
    expect(store.estado()).toBe('preparando');

    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    });

    await store.apagarConversa();
    expect(store.itens()).toEqual([]);
    expect(store.estado()).toBe('aceite-pendente');

    resolverMensagem({
      conversaId: 'c1',
      resposta: 'Resposta tardia da Lia',
      intencao: 'COMPRA',
      proximaAcao: 'continuar_conversa',
      perfilLead: PERFIL_VAZIO,
      imoveisSugeridos: [],
      corretor: null,
      contatoPendente: false,
      agendamento: null,
    });
    await Promise.resolve();

    expect(store.itens()).toEqual([]);
    expect(store.estado()).toBe('aceite-pendente');

    resolverPolling({
      ...conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa'), fala('agente', 'Polling tardio')]),
      conversaId: 'c1',
    });
    await Promise.resolve();

    expect(store.itens()).toEqual([]);
    expect(store.estado()).toBe('aceite-pendente');
  });

  it('resposta tardia de A apos exclusao nao cancela espera prolongada de B nem altera trilha de B', async () => {
    jasmine.clock().install();
    try {
      api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
      await store.iniciar();

      let resolverMensagemA!: (v: MensagemResponse) => void;
      api.enviarMensagem.and.returnValue(
        new Promise<MensagemResponse>((resolve) => {
          resolverMensagemA = resolve;
        }),
      );

      void store.enviar('mensagem da conversa A');
      expect(store.estado()).toBe('preparando');

      api.apagarConversa.and.resolveTo({
        leadExcluido: true,
        removidoEm: '2026-10-04T12:00:00Z',
        escopo: 'lead_e_vinculos',
        mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
      });
      await store.apagarConversa();

      api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá B'), fala('agente', 'Oi B', 'continuar_conversa')]));
      await store.abrirConversa('c2');

      let resolverMensagemB!: (v: MensagemResponse) => void;
      api.enviarMensagem.and.returnValue(
        new Promise<MensagemResponse>((resolve) => {
          resolverMensagemB = resolve;
        }),
      );

      void store.enviar('mensagem da conversa B');
      expect(store.estado()).toBe('preparando');

      resolverMensagemA({
        conversaId: 'c1',
        resposta: 'Resposta velha de A',
        intencao: 'COMPRA',
        proximaAcao: 'continuar_conversa',
        perfilLead: PERFIL_VAZIO,
        imoveisSugeridos: [],
        corretor: null,
        contatoPendente: false,
        agendamento: null,
      });
      await Promise.resolve();

      expect(store.estado()).toBe('preparando');
      const itensAntes = store.itens();
      expect(itensAntes.some((it) => it.tipo === 'lia' && it.texto === 'Resposta velha de A')).toBeFalse();

      jasmine.clock().tick(8001);

      expect(store.estado()).toBe('espera-prolongada');
      expect(store.itens()).toEqual(itensAntes);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('rejeicao tardia de A apos exclusao nao cancela espera prolongada de B nem altera trilha de B', async () => {
    jasmine.clock().install();
    try {
      api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
      await store.iniciar();

      let rejeitarMensagemA!: (e: any) => void;
      api.enviarMensagem.and.returnValue(
        new Promise<MensagemResponse>((_resolve, reject) => {
          rejeitarMensagemA = reject;
        }),
      );

      void store.enviar('mensagem da conversa A');
      expect(store.estado()).toBe('preparando');

      api.apagarConversa.and.resolveTo({
        leadExcluido: true,
        removidoEm: '2026-10-04T12:00:00Z',
        escopo: 'lead_e_vinculos',
        mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
      });
      await store.apagarConversa();

      api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá B'), fala('agente', 'Oi B', 'continuar_conversa')]));
      await store.abrirConversa('c2');

      let resolverMensagemB!: (v: MensagemResponse) => void;
      api.enviarMensagem.and.returnValue(
        new Promise<MensagemResponse>((resolve) => {
          resolverMensagemB = resolve;
        }),
      );

      void store.enviar('mensagem da conversa B');
      expect(store.estado()).toBe('preparando');

      rejeitarMensagemA(new Error('falha antiga'));
      await Promise.resolve();

      expect(store.estado()).toBe('preparando');
      const itensAntes = store.itens();
      expect(itensAntes.some((it) => it.tipo === 'evento' && it.variante === 'erro')).toBeFalse();

      jasmine.clock().tick(8001);

      expect(store.estado()).toBe('espera-prolongada');
      expect(store.itens()).toEqual(itensAntes);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('anonimo volta para aceite-pendente e conta com consentimento vai para inicio-conta e cria id no primeiro envio', async () => {
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    await store.iniciar();
    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    });
    await store.apagarConversa();
    expect(store.estado()).toBe('aceite-pendente');

    localStorage.setItem('solar.conversaId', 'c1');
    await store.definirConsentimentoDaConta(VERSAO_AVISO_PRIVACIDADE);
    await store.iniciar();

    api.enviarMensagem.calls.reset();
    api.registrarConsentimento.calls.reset();

    await store.apagarConversa();
    expect(store.estado()).toBe('inicio-conta');
    expect(store.conversaGuardada()).toBeNull();
    expect(store.itens()).toEqual([]);
    expect(store.campoEditavel()).toBeTrue();
    expect(store.envioDisponivel()).toBeTrue();
    expect(store.podeApagarConversa()).toBeFalse();
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(api.registrarConsentimento).not.toHaveBeenCalled();

    api.registrarConsentimento.and.resolveTo({
      conversaId: 'novo-uuid',
      leadId: 'lead-uuid',
      consentimentoEm: '2026-10-04T12:00:00Z',
      versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
    });
    api.enviarMensagem.and.resolveTo({
      conversaId: 'novo-uuid',
      resposta: 'Resposta da Lia para o envio novo',
      intencao: 'COMPRA',
      proximaAcao: 'continuar_conversa',
      perfilLead: PERFIL_VAZIO,
      imoveisSugeridos: [],
      corretor: null,
      contatoPendente: false,
      agendamento: null,
    });

    await store.enviar('Quero comprar apartamento');
    expect(api.registrarConsentimento).toHaveBeenCalledWith(
      jasmine.any(String),
      { versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE },
    );
    expect(api.enviarMensagem).toHaveBeenCalledWith(
      jasmine.any(String),
      'Quero comprar apartamento',
    );
    expect(store.estado()).toBe('conversando');
    expect(store.conversaGuardada()).not.toBe('c1');
  });

  it('em inicio-conta novo envio ou retry apos falha de consentimento registra consentimento com mesmo UUID sem enviar mensagem se falhar', async () => {
    localStorage.setItem('solar.conversaId', 'c1');
    await store.definirConsentimentoDaConta(VERSAO_AVISO_PRIVACIDADE);
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    await store.iniciar();

    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    });
    await store.apagarConversa();
    expect(store.estado()).toBe('inicio-conta');

    api.registrarConsentimento.calls.reset();
    api.enviarMensagem.calls.reset();
    api.registrarConsentimento.and.rejectWith(new Error('falha de rede no consentimento 1'));

    await store.enviar('Mensagem 1');
    expect(api.registrarConsentimento).toHaveBeenCalledTimes(1);
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(store.estado()).toBe('falha');
    expect(store.consentimentoPendente()).toBeTrue();

    const uuidGerado = store.conversaGuardada();
    expect(uuidGerado).toBeTruthy();

    api.registrarConsentimento.calls.reset();
    api.enviarMensagem.calls.reset();
    api.registrarConsentimento.and.rejectWith(new Error('falha de rede no consentimento 2'));

    await store.enviar('texto novo');
    expect(api.registrarConsentimento).toHaveBeenCalledWith(
      uuidGerado!,
      { versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE },
    );
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(store.estado()).toBe('falha');
    expect(store.consentimentoPendente()).toBeTrue();
    expect(store.conversaGuardada()).toBe(uuidGerado);

    api.registrarConsentimento.calls.reset();
    api.enviarMensagem.calls.reset();
    api.registrarConsentimento.and.resolveTo({
      conversaId: uuidGerado!,
      leadId: 'lead-uuid',
      consentimentoEm: '2026-10-04T12:00:00Z',
      versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
    });
    api.enviarMensagem.and.resolveTo({
      conversaId: uuidGerado!,
      resposta: 'Resposta apos sucesso',
      intencao: 'COMPRA',
      proximaAcao: 'continuar_conversa',
      perfilLead: PERFIL_VAZIO,
      imoveisSugeridos: [],
      corretor: null,
      contatoPendente: false,
      agendamento: null,
    });

    await store.tentarNovamente();
    expect(api.registrarConsentimento).toHaveBeenCalledWith(
      uuidGerado!,
      { versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE },
    );
    expect(api.enviarMensagem).toHaveBeenCalledWith(uuidGerado!, 'texto novo');
    expect(store.estado()).toBe('conversando');
    expect(store.consentimentoPendente()).toBeFalse();
  });

  it('registro de consentimento pendente ou falho impede exclusao e confirmacao reabilita exclusao durante turno', async () => {
    localStorage.setItem('solar.conversaId', 'c1');
    await store.definirConsentimentoDaConta(VERSAO_AVISO_PRIVACIDADE);
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    await store.iniciar();

    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    });
    await store.apagarConversa();
    expect(store.estado()).toBe('inicio-conta');

    let rejeitarConsentimento!: (e: any) => void;
    api.registrarConsentimento.and.returnValue(
      new Promise((_resolve, reject) => {
        rejeitarConsentimento = reject;
      }),
    );
    api.apagarConversa.calls.reset();

    void store.enviar('primeira mensagem');
    expect(store.estado()).toBe('preparando');
    expect(store.consentimentoPendente()).toBeTrue();
    expect(store.podeApagarConversa()).toBeFalse();

    const resultadoPendente = await store.apagarConversa();
    expect(resultadoPendente).toBeFalse();
    expect(api.apagarConversa).not.toHaveBeenCalled();

    rejeitarConsentimento(new Error('falha no consentimento'));
    await Promise.resolve();

    expect(store.estado()).toBe('falha');
    expect(store.consentimentoPendente()).toBeTrue();
    expect(store.podeApagarConversa()).toBeFalse();

    const resultadoFalho = await store.apagarConversa();
    expect(resultadoFalho).toBeFalse();
    expect(api.apagarConversa).not.toHaveBeenCalled();

    const uuid = store.conversaGuardada()!;
    let resolverMensagem!: (v: MensagemResponse) => void;
    api.enviarMensagem.and.returnValue(
      new Promise<MensagemResponse>((resolve) => {
        resolverMensagem = resolve;
      }),
    );
    api.registrarConsentimento.and.resolveTo({
      conversaId: uuid,
      leadId: 'lead-uuid',
      consentimentoEm: '2026-10-04T12:00:00Z',
      versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
    });

    void store.tentarNovamente();
    await Promise.resolve();
    await Promise.resolve();

    expect(store.consentimentoPendente()).toBeFalse();
    expect(store.estado()).toBe('preparando');
    expect(store.podeApagarConversa()).toBeTrue();

    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    });
    const apagou = await store.apagarConversa();
    expect(apagou).toBeTrue();
    expect(api.apagarConversa).toHaveBeenCalledWith(uuid);

    resolverMensagem({
      conversaId: uuid,
      resposta: 'Tardia',
      intencao: 'COMPRA',
      proximaAcao: 'continuar_conversa',
      perfilLead: PERFIL_VAZIO,
      imoveisSugeridos: [],
      corretor: null,
      contatoPendente: false,
      agendamento: null,
    });
    await Promise.resolve();
    expect(store.itens()).toEqual([]);
  });

  it('zera conversaApagada quando usuario aceitar, enviar, abrir ou criar nova conversa', async () => {
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Olá'), fala('agente', 'Oi', 'continuar_conversa')]));
    await store.iniciar();

    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-04T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'A conversa e suas mensagens foram apagadas definitivamente.',
    });
    await store.apagarConversa();
    expect(store.conversaApagada()).toBeTrue();

    await store.novaConversa();
    expect(store.conversaApagada()).toBeFalse();
  });
});

describe('ConversaStore agenda e historico T4b1', () => {
  let store: ConversaStore;
  let api: jasmine.SpyObj<ConversaApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ConversaApi>('ConversaApi', [
      'obterConversa',
      'enviarMensagem',
      'registrarContato',
      'registrarConsentimento',
      'apagarConversa',
      'registrarAgendamento',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConversaApi, useValue: api },
      ],
    });

    localStorage.setItem('solar.conversaId', 'c1');
    store = TestBed.inject(ConversaStore);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('GET elegivel com corretor no historico e oferta nao vazia expoe signals, grupos e cartao visivel', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('agente', 'Encaminhando para Helena.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        false,
        PERFIL_VAZIO,
        [slot],
      ),
    );

    await store.iniciar();

    expect(store.corretorAgendamento()).toBe('Helena Braga');
    expect(store.contatoRegistrado()).toBeTrue();
    expect(store.ofertaAgendamento()).toEqual([slot]);
    expect(store.agendamentoConfirmado()).toBeNull();
    expect(store.agendamentoRecolhido()).toBeFalse();
    expect(store.agendaDisponivel()).toBeTrue();
    expect(store.cartaoAgendaVisivel()).toBeTrue();
    expect(store.faixaAgendaVisivel()).toBeFalse();
    expect(store.avisoAgendaVazia()).toBeFalse();
    expect(store.gruposAgendamento().length).toBe(1);
    expect(store.gruposAgendamento()[0].dia).toBe('2026-10-15');
    expect(store.gruposAgendamento()[0].horarios).toEqual([slot]);
  });

  it('GET com contato pendente nao expoe oferta elegivel nem agenda disponivel', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('agente', 'Encaminhando para Helena.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        true,
        PERFIL_VAZIO,
        [slot],
      ),
    );

    await store.iniciar();

    expect(store.corretorAgendamento()).toBe('Helena Braga');
    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendaDisponivel()).toBeFalse();
    expect(store.cartaoAgendaVisivel()).toBeFalse();
  });

  it('GET sem corretor conhecido no historico mantem agenda indisponivel mesmo com oferta', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Olá'),
          fala('agente', 'Oi, tudo bem?', 'continuar_conversa', 0, null),
        ],
        false,
        PERFIL_VAZIO,
        [slot],
      ),
    );

    await store.iniciar();

    expect(store.corretorAgendamento()).toBeNull();
    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendaDisponivel()).toBeFalse();
    expect(store.cartaoAgendaVisivel()).toBeFalse();
  });

  it('contato POST bem sucedido atualiza oferta e contato sem chamada extra de mensagem ou GET', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('agente', 'Vou te passar.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        true,
      ),
    );
    const slot: SlotOferecido = {
      id: 201,
      inicio: '2026-10-16T14:00:00-03:00',
      fim: '2026-10-16T15:00:00-03:00',
    };
    api.registrarContato.and.resolveTo({ leadId: 'l1', oferta: [slot] });

    await store.iniciar();
    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);

    await store.enviarContato({ nome: 'Ana', telefone: '11999998888', email: null });

    expect(store.contatoRegistrado()).toBeTrue();
    expect(store.ofertaAgendamento()).toEqual([slot]);
    expect(store.cartaoAgendaVisivel()).toBeTrue();
    expect(store.contatoErro()).toBeNull();
    const eventoExistente = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado');
    expect(eventoExistente).toBeDefined();
    const eventoContato = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(eventoContato).toBeDefined();
    if (eventoContato && eventoContato.tipo === 'evento') {
      expect(eventoContato.texto).toBe('O corretor usará o contato que você forneceu.');
    }
    expect(store.itens().some((i) => i.tipo === 'contato')).toBeFalse();
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(api.obterConversa.calls.count()).toBe(1);
  });

  it('falha no POST de contato nao aplica oferta nem contato registrado', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('agente', 'Vou te passar.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        true,
      ),
    );
    api.registrarContato.and.rejectWith(new Error('falha de rede'));

    await store.iniciar();
    await store.enviarContato({ nome: 'Ana', telefone: '11999998888', email: null });

    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.cartaoAgendaVisivel()).toBeFalse();
    expect(store.contatoErro()).not.toBeNull();
  });

  it('GET confirmado mantém cartão aberto readonly e não insere evento verde de confirmação', async () => {
    const slotConfirmado = {
      id: 50,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('agente', 'Passando para Helena', 'agendar_reuniao', 1, 'Helena Braga'),
          fala('lead', 'Quinta, 15 de outubro às 14h'),
          fala('agente', 'Perfeito! Sua reunião está confirmada.', 'continuar_conversa', 0, null, {
            estado: 'confirmado',
            horario: slotConfirmado,
            alternativas: [],
          }),
        ],
        false,
        PERFIL_VAZIO,
        [slotConfirmado],
      ),
    );

    await store.iniciar();

    expect(store.corretorAgendamento()).toBe('Helena Braga');
    expect(store.contatoRegistrado()).toBeTrue();
    expect(store.agendamentoConfirmado()).toEqual({
      estado: 'confirmado',
      horario: slotConfirmado,
      alternativas: [],
    });
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendaDisponivel()).toBeTrue();
    expect(store.cartaoAgendaVisivel()).toBeTrue();
    expect(store.faixaAgendaVisivel()).toBeFalse();
    expect(store.agendamentoEstaConfirmado()).toBeTrue();
    expect(store.agendamentoPodeSelecionar()).toBeFalse();
    expect(store.avisoAgendaVazia()).toBeFalse();

    const itens = store.itens();
    const indiceLead = itens.findIndex((i) => i.tipo === 'pessoa' && (i as any).texto === 'Quinta, 15 de outubro às 14h');
    const indiceEvento = itens.findIndex((i) => i.tipo === 'evento' && i.rotulo === 'Reunião confirmada');
    const indiceLia = itens.findIndex((i) => i.tipo === 'lia' && (i as any).texto === 'Perfeito! Sua reunião está confirmada.');
    const indiceReuniaoAgendada = itens.findIndex((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');

    expect(indiceLead).toBe(-1);
    expect(indiceEvento).toBe(-1);
    expect(indiceLia).toBe(-1);
    expect(indiceReuniaoAgendada).toBeGreaterThanOrEqual(0);

    const confirmacoes = itens.filter((i) => i.tipo === 'evento' && i.rotulo === 'Reunião confirmada');
    expect(confirmacoes.length).toBe(0);
  });

  it('oferta vazia em contexto elegivel ativa avisoAgendaVazia sem deduzir confirmacao', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('agente', 'Vou te passar para a Helena.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        false,
        PERFIL_VAZIO,
        [],
      ),
    );

    await store.iniciar();

    expect(store.corretorAgendamento()).toBe('Helena Braga');
    expect(store.contatoRegistrado()).toBeTrue();
    expect(store.agendamentoConfirmado()).toBeNull();
    expect(store.agendaDisponivel()).toBeTrue();
    expect(store.avisoAgendaVazia()).toBeTrue();
    expect(store.cartaoAgendaVisivel()).toBeFalse();
    expect(store.faixaAgendaVisivel()).toBeFalse();
  });

  it('recolher e reabrir agendamento operam com sessionStorage, sobrevivem a polling e persistem no reload', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    const dadosConversa = conversa(
      [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')],
      false,
      PERFIL_VAZIO,
      [slot],
    );
    api.obterConversa.and.resolveTo(dadosConversa);

    await store.iniciar();
    expect(store.cartaoAgendaVisivel()).toBeTrue();
    expect(store.faixaAgendaVisivel()).toBeFalse();
    expect(store.agendamentoRecolhido()).toBeFalse();

    const localLen = localStorage.length;

    store.recolherAgendamento();
    expect(store.agendamentoRecolhido()).toBeTrue();
    expect(store.cartaoAgendaVisivel()).toBeFalse();
    expect(store.faixaAgendaVisivel()).toBeTrue();
    expect(localStorage.length).toBe(localLen);
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c1')).toBe('1');

    await store.verificarNovasMensagens();
    expect(store.agendamentoRecolhido()).toBeTrue();
    expect(store.cartaoAgendaVisivel()).toBeFalse();
    expect(store.faixaAgendaVisivel()).toBeTrue();

    store.reabrirAgendamento();
    expect(store.agendamentoRecolhido()).toBeFalse();
    expect(store.cartaoAgendaVisivel()).toBeTrue();
    expect(store.faixaAgendaVisivel()).toBeFalse();
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c1')).toBeNull();

    store.recolherAgendamento();
    expect(store.agendamentoRecolhido()).toBeTrue();
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c1')).toBe('1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConversaApi, useValue: api },
      ],
    });
    const novaInstancia = TestBed.inject(ConversaStore);
    await novaInstancia.iniciar();
    expect(novaInstancia.agendamentoRecolhido()).toBeTrue();
    expect(novaInstancia.cartaoAgendaVisivel()).toBeFalse();
    expect(novaInstancia.faixaAgendaVisivel()).toBeTrue();
  });

  it('polling com mesma contagem de mensagens recalcula oferta sem duplicar itens', async () => {
    const slotA: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    const slotB: SlotOferecido = {
      id: 102,
      inicio: '2026-10-16T10:00:00-03:00',
      fim: '2026-10-16T11:00:00-03:00',
    };
    const msgs = [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')];
    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, [slotA]));

    await store.iniciar();
    expect(store.ofertaAgendamento()).toEqual([slotA]);
    const totalItensInicial = store.itens().length;

    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, [slotA, slotB]));
    await store.verificarNovasMensagens();

    expect(store.ofertaAgendamento()).toEqual([slotA, slotB]);
    expect(store.itens().length).toBe(totalItensInicial);

    await store.verificarNovasMensagens();
    expect(store.itens().length).toBe(totalItensInicial);
  });

  it('polling com novo par lead e Lia confirmado reconstroi na ordem e zera oferta sem duplicar na repeticao', async () => {
    const slot = {
      id: 301,
      inicio: '2026-10-17T09:00:00-03:00',
      fim: '2026-10-17T10:00:00-03:00',
    };
    const msgsIniciais = [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')];
    api.obterConversa.and.resolveTo(conversa(msgsIniciais, false, PERFIL_VAZIO, [slot]));

    await store.iniciar();
    expect(store.ofertaAgendamento().length).toBe(1);

    const msgsAtualizadas = [
      ...msgsIniciais,
      fala('lead', 'Sábado às 9h'),
      fala('agente', 'Horário agendado com sucesso!', 'continuar_conversa', 0, null, {
        estado: 'confirmado',
        horario: slot,
        alternativas: [],
      }),
    ];
    api.obterConversa.and.resolveTo(conversa(msgsAtualizadas, false, PERFIL_VAZIO, []));
    await store.verificarNovasMensagens();

    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendamentoConfirmado()).toEqual({
      estado: 'confirmado',
      horario: slot,
      alternativas: [],
    });

    const itens = store.itens();
    const idxLead = itens.findIndex((i) => i.tipo === 'pessoa' && (i as any).texto === 'Sábado às 9h');
    const idxEvento = itens.findIndex((i) => i.tipo === 'evento' && i.rotulo === 'Reunião confirmada');
    const idxLia = itens.findIndex((i) => i.tipo === 'lia' && (i as any).texto === 'Horário agendado com sucesso!');
    const idxEventoReuniao = itens.findIndex((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');

    expect(idxLead).toBeGreaterThanOrEqual(0);
    expect(idxEvento).toBe(-1);
    expect(idxLia).toBe(-1);
    expect(idxEventoReuniao).toBe(idxLead + 1);

    const totalApos = itens.length;
    await store.verificarNovasMensagens();
    expect(store.itens().length).toBe(totalApos);
  });

  it('polling com novas mensagens exclusivas de agente preserva append', async () => {
    const msgsIniciais = [fala('agente', 'Olá', 'continuar_conversa')];
    api.obterConversa.and.resolveTo(conversa(msgsIniciais));

    await store.iniciar();
    const contagemOriginal = store.itens().length;

    const msgsNovas = [
      ...msgsIniciais,
      fala('agente', 'Como posso ajudar com imóveis?', 'continuar_conversa'),
    ];
    api.obterConversa.and.resolveTo(conversa(msgsNovas));
    await store.verificarNovasMensagens();

    expect(store.itens().length).toBe(contagemOriginal + 1);
    const ultima = store.itens()[store.itens().length - 1];
    expect(ultima.tipo).toBe('lia');
    if (ultima.tipo === 'lia') {
      expect(ultima.texto).toBe('Como posso ajudar com imóveis?');
    }
  });

  it('nova conversa limpa estado da agenda para os defaults', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot],
      ),
    );

    await store.iniciar();
    store.recolherAgendamento();
    expect(store.corretorAgendamento()).toBe('Helena Braga');
    expect(store.ofertaAgendamento().length).toBe(1);
    expect(store.agendamentoRecolhido()).toBeTrue();

    await store.novaConversa();

    expect(store.corretorAgendamento()).toBeNull();
    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendamentoConfirmado()).toBeNull();
    expect(store.agendamentoRecolhido()).toBeFalse();
    expect(store.agendaDisponivel()).toBeFalse();
  });

  it('exclusao da conversa limpa todos os signals da agenda para os defaults', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot],
      ),
    );

    await store.iniciar();
    store.recolherAgendamento();
    expect(store.corretorAgendamento()).toBe('Helena Braga');
    expect(store.agendamentoRecolhido()).toBeTrue();

    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-07T12:00:00Z',
      escopo: 'lead_e_vinculos',
      mensagem: 'Conversa apagada',
    });

    await store.apagarConversa();

    expect(store.corretorAgendamento()).toBeNull();
    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendamentoConfirmado()).toBeNull();
    expect(store.agendamentoRecolhido()).toBeFalse();
    expect(store.agendaDisponivel()).toBeFalse();
  });

  it('polling sem consentimento limpa estado da agenda', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    const msgs = [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')];
    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, [slot]));

    await store.iniciar();
    expect(store.agendaDisponivel()).toBeTrue();
    expect(store.ofertaAgendamento()).toEqual([slot]);

    const semConsentimento: ConversaResponse = {
      conversaId: 'c1',
      perfilLead: PERFIL_VAZIO,
      mensagens: msgs,
      contatoPendente: false,
      consentimentoEm: null,
      versaoAvisoPrivacidade: '2026-09-11',
      oferta: [slot],
    };
    api.obterConversa.and.resolveTo(semConsentimento);
    await store.verificarNovasMensagens();

    expect(store.corretorAgendamento()).toBeNull();
    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendaDisponivel()).toBeFalse();
  });

  it('polling com versao antiga de privacidade limpa estado da agenda', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    const msgs = [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')];
    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, [slot]));

    await store.iniciar();
    expect(store.agendaDisponivel()).toBeTrue();
    expect(store.ofertaAgendamento()).toEqual([slot]);

    const versaoAntiga: ConversaResponse = {
      conversaId: 'c1',
      perfilLead: PERFIL_VAZIO,
      mensagens: msgs,
      contatoPendente: false,
      consentimentoEm: new Date().toISOString(),
      versaoAvisoPrivacidade: '2025-01-01',
      oferta: [slot],
    };
    api.obterConversa.and.resolveTo(versaoAntiga);
    await store.verificarNovasMensagens();

    expect(store.corretorAgendamento()).toBeNull();
    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendaDisponivel()).toBeFalse();
  });

  it('GET elegivel com conversa encerrada mantem agenda e cartao disponiveis', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'quero agendar'),
          fala('agente', 'Atendimento encerrado por aqui.', 'encerrar', 0, 'Helena Braga'),
        ],
        false,
        PERFIL_VAZIO,
        [slot],
      ),
    );

    await store.iniciar();

    expect(store.estado()).toBe('encerrada');
    expect(store.corretorAgendamento()).toBe('Helena Braga');
    expect(store.contatoRegistrado()).toBeTrue();
    expect(store.agendaDisponivel()).toBeTrue();
    expect(store.cartaoAgendaVisivel()).toBeTrue();
  });

  it('abrir outra conversa zera agenda e impede dados da conversa anterior', async () => {
    const slot1: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot1],
      ),
    );

    await store.iniciar();
    expect(store.corretorAgendamento()).toBe('Helena Braga');
    expect(store.ofertaAgendamento()).toEqual([slot1]);

    api.obterConversa.and.resolveTo({
      conversaId: 'c2',
      perfilLead: PERFIL_VAZIO,
      mensagens: [fala('lead', 'Olá'), fala('agente', 'Oi!', 'continuar_conversa')],
      contatoPendente: false,
      consentimentoEm: new Date().toISOString(),
      versaoAvisoPrivacidade: '2026-09-11',
      oferta: [],
    });

    await store.abrirConversa('c2');

    expect(store.corretorAgendamento()).toBeNull();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendaDisponivel()).toBeFalse();
  });

  it('ausencia de consentimento mantem agenda vazia', async () => {
    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    const semConsentimento: ConversaResponse = {
      conversaId: 'c1',
      perfilLead: PERFIL_VAZIO,
      mensagens: [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')],
      contatoPendente: false,
      consentimentoEm: null,
      versaoAvisoPrivacidade: '2026-09-11',
      oferta: [slot],
    };
    api.obterConversa.and.resolveTo(semConsentimento);

    await store.iniciar();

    expect(store.corretorAgendamento()).toBeNull();
    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendaDisponivel()).toBeFalse();
  });

  it('retorno tardio de GET anterior apos nova conversa nao restaura agenda antiga', async () => {
    let resolverGetAntigo!: (c: ConversaResponse) => void;
    const promiseGetAntigo = new Promise<ConversaResponse>((resolve) => {
      resolverGetAntigo = resolve;
    });
    api.obterConversa.and.returnValue(promiseGetAntigo);

    const inicioPromise = store.iniciar();

    await store.novaConversa();

    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    resolverGetAntigo(
      conversa(
        [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot],
      ),
    );

    await inicioPromise;

    expect(store.corretorAgendamento()).toBeNull();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendaDisponivel()).toBeFalse();
  });

  it('retorno tardio de contato anterior apos nova conversa nao restaura agenda antiga', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com Helena.', 'agendar_reuniao', 0, 'Helena Braga')],
        true,
      ),
    );
    let resolverContato!: (resp: { leadId: string; oferta: SlotOferecido[] }) => void;
    const promiseContato = new Promise<{ leadId: string; oferta: SlotOferecido[] }>((resolve) => {
      resolverContato = resolve;
    });
    api.registrarContato.and.returnValue(promiseContato);

    await store.iniciar();

    const promessaEnvio = store.enviarContato({ nome: 'Ana', telefone: '11999998888', email: null });

    await store.novaConversa();

    const slot: SlotOferecido = {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    };
    resolverContato({ leadId: 'l1', oferta: [slot] });

    await promessaEnvio;

    expect(store.corretorAgendamento()).toBeNull();
    expect(store.contatoRegistrado()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendaDisponivel()).toBeFalse();
  });
});

describe('ConversaStore reserva por botao e reconciliacao T4b2', () => {
  let store: ConversaStore;
  let api: jasmine.SpyObj<ConversaApi>;

  const slot1: SlotOferecido = {
    id: 101,
    inicio: '2026-10-15T14:00:00-03:00',
    fim: '2026-10-15T15:00:00-03:00',
  };
  const slot2: SlotOferecido = {
    id: 102,
    inicio: '2026-10-16T10:00:00-03:00',
    fim: '2026-10-16T11:00:00-03:00',
  };
  const confirmacaoSlot1: AgendamentoDaConversa = {
    estado: 'confirmado',
    horario: {
      id: 101,
      inicio: '2026-10-15T14:00:00-03:00',
      fim: '2026-10-15T15:00:00-03:00',
    },
    alternativas: [],
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('solar.conversaId', 'c1');

    api = jasmine.createSpyObj<ConversaApi>('ConversaApi', [
      'obterConversa',
      'enviarMensagem',
      'registrarContato',
      'registrarConsentimento',
      'apagarConversa',
      'registrarAgendamento',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConversaApi, useValue: api },
      ],
    });

    store = TestBed.inject(ConversaStore);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  async function inicializarComOferta(
    oferta: SlotOferecido[] = [slot1, slot2],
    corretor = 'Helena Braga',
  ): Promise<void> {
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, corretor)],
        false,
        PERFIL_VAZIO,
        oferta,
      ),
    );
    await store.iniciar();
  }

  it('clique chama registrarAgendamento uma vez com busy imediato sem mensagens nem GET previo e sem confirmacao otimista', async () => {
    await inicializarComOferta();
    let resolverPost!: (c: AgendamentoDaConversa) => void;
    const promessaPost = new Promise<AgendamentoDaConversa>((resolve) => {
      resolverPost = resolve;
    });
    api.registrarAgendamento.and.returnValue(promessaPost);

    const promessaReserva = store.registrarAgendamento(101);

    expect(api.registrarAgendamento).toHaveBeenCalledWith('c1', 101);
    expect(store.agendamentoEnviando()).toBeTrue();
    expect(store.agendamentoPodeSelecionar()).toBeFalse();
    expect(store.agendamentoConfirmado()).toBeNull();
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(api.obterConversa.calls.count()).toBe(1);

    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Quero o horario'),
          fala('agente', 'Reunião agendada.', null, 0, 'Helena Braga', confirmacaoSlot1),
        ],
        false,
        PERFIL_VAZIO,
        [],
      ),
    );

    resolverPost(confirmacaoSlot1);
    await promessaReserva;

    expect(store.agendamentoEnviando()).toBeFalse();
    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.ofertaAgendamento()).toEqual([]);
  });

  it('dois cliques concorrentes no mesmo ou em slots diferentes emitem apenas um POST', async () => {
    await inicializarComOferta();
    let resolverPost!: (c: AgendamentoDaConversa) => void;
    const promessaPost = new Promise<AgendamentoDaConversa>((resolve) => {
      resolverPost = resolve;
    });
    api.registrarAgendamento.and.returnValue(promessaPost);

    const p1 = store.registrarAgendamento(101);
    const p2 = store.registrarAgendamento(102);

    expect(api.registrarAgendamento.calls.count()).toBe(1);
    expect(api.registrarAgendamento).toHaveBeenCalledWith('c1', 101);

    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Quero o horario'),
          fala('agente', 'Reunião confirmada.', null, 0, 'Helena Braga', confirmacaoSlot1),
        ],
        false,
        PERFIL_VAZIO,
        [],
      ),
    );
    resolverPost(confirmacaoSlot1);
    await Promise.all([p1, p2]);
    expect(api.registrarAgendamento.calls.count()).toBe(1);
  });

  it('ignora selecao com slotId fora da oferta, nao inteiro, ou quando nao elegivel', async () => {
    await inicializarComOferta();

    await store.registrarAgendamento(999);
    await store.registrarAgendamento(0);
    await store.registrarAgendamento(-1);
    await store.registrarAgendamento(1.5 as unknown as number);
    expect(api.registrarAgendamento).not.toHaveBeenCalled();

    store.recusar();
    await store.registrarAgendamento(101);
    expect(api.registrarAgendamento).not.toHaveBeenCalled();
  });

  it('200 seguido de GET canonico exibe pessoa e Lia na ordem sem evento verde duplicado com dados reais do GET', async () => {
    await inicializarComOferta([slot1]);
    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Quero agendar reunião'),
          fala('agente', 'Reunião agendada com Helena.', null, 0, 'Helena Braga', confirmacaoSlot1),
        ],
        false,
        PERFIL_VAZIO,
        [],
      ),
    );

    await store.registrarAgendamento(101);

    expect(api.registrarAgendamento).toHaveBeenCalledWith('c1', 101);
    expect(api.obterConversa.calls.count()).toBe(2);
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendamentoEnviando()).toBeFalse();
    expect(store.agendamentoSincronizacaoPendente()).toBeFalse();

    const itens = store.itens();
    expect(itens.map((i) => i.tipo)).toEqual(['divisor', 'pessoa', 'evento']);
    const itemPessoa = itens[1];
    expect(itemPessoa.tipo === 'pessoa' && itemPessoa.texto).toBe('Quero agendar reunião');
    const itemEvento = itens[2];
    expect(itemEvento.tipo === 'evento' && itemEvento.rotulo).toBe('Reunião agendada');
    expect(itens.some((i) => i.tipo === 'lia')).toBeFalse();
  });

  it('GET inicial em conversa encerrada elegivel permite reserva por botao sem mensagem LLM extra', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Atendimento concluido.', 'encerrar', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot1],
      ),
    );
    await store.iniciar();

    expect(store.estado()).toBe('encerrada');
    expect(store.agendaDisponivel()).toBeTrue();
    expect(store.agendamentoPodeSelecionar()).toBeTrue();

    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Quero agendar'),
          fala('agente', 'Agendado.', 'encerrar', 0, 'Helena Braga', confirmacaoSlot1),
        ],
        false,
        PERFIL_VAZIO,
        [],
      ),
    );

    await store.registrarAgendamento(101);

    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.estado()).toBe('encerrada');
  });

  it('200 seguido de GET rejeitado preserva confirmacao, bloqueia selecao e sincronizar recupera via GET sem novo POST', async () => {
    await inicializarComOferta([slot1]);
    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
    api.obterConversa.and.rejectWith(new Error('falha de rede'));

    await store.registrarAgendamento(101);

    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendamentoSincronizacaoPendente()).toBeTrue();
    expect(store.agendamentoPodeSelecionar()).toBeFalse();
    expect(store.agendamentoErro()).toBe(
      'A reunião foi confirmada. Não foi possível carregar o histórico. Atualize a confirmação.',
    );
    expect(store.envioDisponivel()).toBeFalse();
    expect(store.motivoEnvio()).toBe('Atualize a confirmação do horário antes de enviar.');

    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Quero agendar'),
          fala('agente', 'Reunião confirmada.', null, 0, 'Helena Braga', confirmacaoSlot1),
        ],
        false,
        PERFIL_VAZIO,
        [],
      ),
    );

    await store.sincronizarAgendamento();

    expect(api.registrarAgendamento.calls.count()).toBe(1);
    expect(store.agendamentoSincronizacaoPendente()).toBeFalse();
    expect(store.agendamentoErro()).toBeNull();
    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.agendamentoEstaConfirmado()).toBeTrue();
    expect(store.cartaoAgendaVisivel()).toBeTrue();
    expect(store.itens().some((i) => i.tipo === 'evento' && i.rotulo === 'Reunião confirmada')).toBeFalse();
  });

  it('GET vazio valido apos 200 mantem confirmacao conhecida pendente sem chamar abrir nem Olá', async () => {
    await inicializarComOferta([slot1]);
    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
    api.obterConversa.and.resolveTo(conversa([], false, PERFIL_VAZIO, []));

    await store.registrarAgendamento(101);

    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.agendamentoSincronizacaoPendente()).toBeTrue();
    expect(store.agendamentoErro()).toBe(
      'A reunião foi confirmada. Não foi possível carregar o histórico. Atualize a confirmação.',
    );
    expect(api.enviarMensagem).not.toHaveBeenCalled();
  });

  it('409 com horario_indisponivel e alternativas atualiza oferta, define horarioPerdido e salva memo sem GET extra', async () => {
    await inicializarComOferta([slot1, slot2]);
    api.registrarAgendamento.and.rejectWith(
      new HttpErrorResponse({
        status: 409,
        error: { codigo: 'horario_indisponivel', oferta: [slot2] },
      }),
    );

    await store.registrarAgendamento(101);

    expect(api.obterConversa.calls.count()).toBe(1);
    expect(store.ofertaAgendamento()).toEqual([slot2]);
    expect(store.horarioPerdido()).toEqual(slot1);
    expect(store.agendamentoConfirmado()).toBeNull();
    expect(store.agendamentoErro()).toBeNull();
    expect(store.agendamentoSincronizacaoPendente()).toBeFalse();
    expect(store.agendamentoRecolhido()).toBeFalse();
    expect(sessionStorage.getItem('solar.agendamentoPerdido.c1')).toBe(
      JSON.stringify({ id: 101, inicio: slot1.inicio, fim: slot1.fim }),
    );
  });

  it('409 com horario_indisponivel e oferta vazia exibe apenas aviso com computeds de cartao e faixa falsos', async () => {
    await inicializarComOferta([slot1]);
    api.registrarAgendamento.and.rejectWith(
      new HttpErrorResponse({
        status: 409,
        error: { codigo: 'horario_indisponivel', oferta: [] },
      }),
    );

    await store.registrarAgendamento(101);

    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.cartaoAgendaVisivel()).toBeFalse();
    expect(store.faixaAgendaVisivel()).toBeFalse();
    expect(store.avisoAgendaVazia()).toBeTrue();
    expect(store.horarioPerdido()).toEqual(slot1);
    expect(sessionStorage.getItem('solar.agendamentoPerdido.c1')).not.toBeNull();
  });

  it('409 com agendamento_ja_confirmado reconcilia por GET e reconhece confirmacao sem marcar perdido', async () => {
    await inicializarComOferta([slot1]);
    api.registrarAgendamento.and.rejectWith(
      new HttpErrorResponse({
        status: 409,
        error: { codigo: 'agendamento_ja_confirmado' },
      }),
    );
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Reunião já confirmada.', null, 0, 'Helena Braga', confirmacaoSlot1)],
        false,
        PERFIL_VAZIO,
        [],
      ),
    );

    await store.registrarAgendamento(101);

    expect(store.horarioPerdido()).toBeNull();
    expect(sessionStorage.getItem('solar.agendamentoPerdido.c1')).toBeNull();
    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.agendamentoSincronizacaoPendente()).toBeFalse();
  });

  it('409 contato_pendente, sem oferta ou codigo diferente reconcilia via GET e nao vira perda', async () => {
    await inicializarComOferta([slot1, slot2]);
    api.registrarAgendamento.and.rejectWith(
      new HttpErrorResponse({
        status: 409,
        error: { codigo: 'contato_pendente' },
      }),
    );
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot2],
      ),
    );

    await store.registrarAgendamento(101);

    expect(store.horarioPerdido()).toBeNull();
    expect(sessionStorage.getItem('solar.agendamentoPerdido.c1')).toBeNull();
    expect(store.agendamentoErro()).toBe(
      'Não foi possível confirmar esse horário. Confira os horários atualizados.',
    );
    expect(store.ofertaAgendamento()).toEqual([slot2]);
    expect(store.agendamentoPodeSelecionar()).toBeTrue();
  });

  it('falha de POST e falha de GET mantem pendente ate sincronizarAgendamento GET-only', async () => {
    await inicializarComOferta([slot1]);
    api.registrarAgendamento.and.rejectWith(new HttpErrorResponse({ status: 500 }));
    api.obterConversa.and.rejectWith(new HttpErrorResponse({ status: 500 }));

    await store.registrarAgendamento(101);

    expect(store.agendamentoSincronizacaoPendente()).toBeTrue();
    expect(store.agendamentoErro()).toBe(
      'Não foi possível verificar o horário. Atualize os horários antes de tentar de novo.',
    );
    expect(store.agendamentoConfirmado()).toBeNull();

    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot2],
      ),
    );

    await store.sincronizarAgendamento();

    expect(api.registrarAgendamento.calls.count()).toBe(1);
    expect(store.agendamentoSincronizacaoPendente()).toBeFalse();
    expect(store.agendamentoErro()).toBe(
      'Não foi possível confirmar esse horário. Confira os horários atualizados.',
    );
    expect(store.ofertaAgendamento()).toEqual([slot2]);
  });

  it('reload de conversa restaura horarioPerdido do memo quando elegivel sem confirmacao e recolhimento persiste via sessionStorage', async () => {
    await inicializarComOferta([slot1, slot2]);
    api.registrarAgendamento.and.rejectWith(
      new HttpErrorResponse({
        status: 409,
        error: { codigo: 'horario_indisponivel', oferta: [slot2] },
      }),
    );
    await store.registrarAgendamento(101);
    store.recolherAgendamento();
    expect(store.agendamentoRecolhido()).toBeTrue();

    const storeRecarregado = TestBed.inject(ConversaStore);
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot2],
      ),
    );
    await storeRecarregado.iniciar();

    expect(storeRecarregado.horarioPerdido()).toEqual(slot1);
    expect(storeRecarregado.agendamentoRecolhido()).toBeTrue();
    expect(storeRecarregado.faixaAgendaVisivel()).toBeTrue();
  });

  it('limpa memo de perda quando slot volta a ser ofertado, quando ha confirmacao, ou em nova, troca e exclusao', async () => {
    sessionStorage.setItem(
      'solar.agendamentoPerdido.c1',
      JSON.stringify({ id: 101, inicio: slot1.inicio, fim: slot1.fim }),
    );
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot1, slot2],
      ),
    );
    await store.iniciar();

    expect(store.horarioPerdido()).toBeNull();
    expect(sessionStorage.getItem('solar.agendamentoPerdido.c1')).toBeNull();

    sessionStorage.setItem(
      'solar.agendamentoPerdido.c1',
      JSON.stringify({ id: 101, inicio: slot1.inicio, fim: slot1.fim }),
    );
    await store.novaConversa();
    expect(sessionStorage.getItem('solar.agendamentoPerdido.c1')).toBeNull();

    localStorage.setItem('solar.conversaId', 'c1');
    sessionStorage.setItem(
      'solar.agendamentoPerdido.c1',
      JSON.stringify({ id: 101, inicio: slot1.inicio, fim: slot1.fim }),
    );
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot2],
      ),
    );
    await store.iniciar();
    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-07T12:00:00Z',
      escopo: 'apenas_conversa',
      mensagem: 'apagada',
    });
    await store.apagarConversa();
    expect(sessionStorage.getItem('solar.agendamentoPerdido.c1')).toBeNull();
  });

  it('sessionStorage com JSON invalido nao quebra a inicializacao', async () => {
    sessionStorage.setItem('solar.agendamentoPerdido.c1', '{json_invalido');
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot2],
      ),
    );
    await store.iniciar();

    expect(store.horarioPerdido()).toBeNull();
    expect(store.ofertaAgendamento()).toEqual([slot2]);
  });

  it('GET de polling iniciado antes do POST 200 resolve depois e nao desfaz a confirmacao', async () => {
    await inicializarComOferta([slot1]);
    let resolverPolling!: (c: ConversaResponse) => void;
    const promessaPolling = new Promise<ConversaResponse>((resolve) => {
      resolverPolling = resolve;
    });
    api.obterConversa.and.returnValue(promessaPolling);

    const pollingExecucao = store.verificarNovasMensagens();

    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
    const conversaConfirmada = conversa(
      [
        fala('lead', 'Quero o horario'),
        fala('agente', 'Confirmado.', null, 0, 'Helena Braga', confirmacaoSlot1),
      ],
      false,
      PERFIL_VAZIO,
      [],
    );

    let resolverCanonico!: (c: ConversaResponse) => void;
    const promessaCanonica = new Promise<ConversaResponse>((resolve) => {
      resolverCanonico = resolve;
    });
    api.obterConversa.and.returnValue(promessaCanonica);

    const promessaReserva = store.registrarAgendamento(101);
    resolverCanonico(conversaConfirmada);
    await promessaReserva;

    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);

    resolverPolling(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot1],
      ),
    );
    await pollingExecucao;

    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.ofertaAgendamento()).toEqual([]);
  });

  it('GET de polling anterior ao contato nao remove nova oferta', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Encaminhando.', 'agendar_reuniao', 0, 'Helena Braga')],
        true,
        PERFIL_VAZIO,
        [],
      ),
    );
    await store.iniciar();

    let resolverPolling!: (c: ConversaResponse) => void;
    const promessaPolling = new Promise<ConversaResponse>((resolve) => {
      resolverPolling = resolve;
    });
    api.obterConversa.and.returnValue(promessaPolling);

    const pollingExec = store.verificarNovasMensagens();

    api.registrarContato.and.resolveTo({ leadId: 'l1', oferta: [slot1] });
    await store.enviarContato({ nome: 'Ana', telefone: '11999998888', email: null });

    expect(store.ofertaAgendamento()).toEqual([slot1]);

    resolverPolling(
      conversa(
        [fala('agente', 'Encaminhando.', 'agendar_reuniao', 0, 'Helena Braga')],
        true,
        PERFIL_VAZIO,
        [],
      ),
    );
    await pollingExec;

    expect(store.ofertaAgendamento()).toEqual([slot1]);
  });

  it('polling simultaneo nao executa chamadas concorrentes', async () => {
    await inicializarComOferta();
    let resolverPolling!: (c: ConversaResponse) => void;
    const promessaPolling = new Promise<ConversaResponse>((resolve) => {
      resolverPolling = resolve;
    });
    api.obterConversa.and.returnValue(promessaPolling);

    const p1 = store.verificarNovasMensagens();
    const p2 = store.verificarNovasMensagens();

    expect(api.obterConversa.calls.count()).toBe(2);

    resolverPolling(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot1, slot2],
      ),
    );
    await Promise.all([p1, p2]);
  });

  it('POST de reserva antigo resolvendo apos nova conversa nao afeta nova conversa nem limpa busy novo', async () => {
    await inicializarComOferta([slot1]);
    let resolverPost!: (c: AgendamentoDaConversa) => void;
    const promessaPost = new Promise<AgendamentoDaConversa>((resolve) => {
      resolverPost = resolve;
    });
    api.registrarAgendamento.and.returnValue(promessaPost);

    const reservaAntiga = store.registrarAgendamento(101);

    await store.novaConversa();

    resolverPost(confirmacaoSlot1);
    await reservaAntiga;

    expect(store.agendamentoConfirmado()).toBeNull();
    expect(store.conversaAtual()).toBe('');
  });

  it('contatoEnviando anterior nao fica preso apos troca de conversa', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Encaminhando.', 'agendar_reuniao', 0, 'Helena Braga')],
        true,
        PERFIL_VAZIO,
        [],
      ),
    );
    await store.iniciar();

    let resolverContato!: (r: { leadId: string; oferta: SlotOferecido[] }) => void;
    const promessaContato = new Promise<{ leadId: string; oferta: SlotOferecido[] }>((resolve) => {
      resolverContato = resolve;
    });
    api.registrarContato.and.returnValue(promessaContato);

    const envioContato = store.enviarContato({ nome: 'Ana', telefone: '11999998888', email: null });
    expect(store.contatoEnviando()).toBeTrue();

    api.obterConversa.and.resolveTo(conversa([], false, PERFIL_VAZIO, []));
    await store.abrirConversa('c2');

    expect(store.contatoEnviando()).toBeFalse();
    resolverContato({ leadId: 'l1', oferta: [] });
    await envioContato;
    expect(store.contatoEnviando()).toBeFalse();
  });

  it('recolher e reabrir durante agendamentoEnviando ou sincronizacaoPendente sao ignorados', async () => {
    await inicializarComOferta([slot1]);
    let resolverPost!: (c: AgendamentoDaConversa) => void;
    const promessaPost = new Promise<AgendamentoDaConversa>((resolve) => {
      resolverPost = resolve;
    });
    api.registrarAgendamento.and.returnValue(promessaPost);

    const reserva = store.registrarAgendamento(101);
    expect(store.agendamentoEnviando()).toBeTrue();
    expect(store.agendamentoRecolhido()).toBeFalse();

    store.recolherAgendamento();
    expect(store.agendamentoRecolhido()).toBeFalse();

    api.obterConversa.and.rejectWith(new Error('falha sincronizacao'));
    resolverPost(confirmacaoSlot1);
    await reserva;

    expect(store.agendamentoSincronizacaoPendente()).toBeTrue();
    store.recolherAgendamento();
    expect(store.agendamentoRecolhido()).toBeFalse();
  });

  it('envioDisponivel e motivoEnvio refletem estados de envio e sincronizacao pendente e voltam ao normal', async () => {
    await inicializarComOferta([slot1]);
    let resolverPost!: (c: AgendamentoDaConversa) => void;
    const promessaPost = new Promise<AgendamentoDaConversa>((resolve) => {
      resolverPost = resolve;
    });
    api.registrarAgendamento.and.returnValue(promessaPost);

    const reserva = store.registrarAgendamento(101);

    expect(store.envioDisponivel()).toBeFalse();
    expect(store.motivoEnvio()).toBe('Aguarde a confirmação do horário.');

    api.obterConversa.and.rejectWith(new Error('falha GET'));
    resolverPost(confirmacaoSlot1);
    await reserva;

    expect(store.envioDisponivel()).toBeFalse();
    expect(store.motivoEnvio()).toBe('Atualize a confirmação do horário antes de enviar.');

    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Reunião confirmada.', null, 0, 'Helena Braga', confirmacaoSlot1)],
        false,
        PERFIL_VAZIO,
        [],
      ),
    );
    await store.sincronizarAgendamento();

    expect(store.envioDisponivel()).toBeTrue();
    expect(store.motivoEnvio()).toBeNull();
    expect(api.enviarMensagem).not.toHaveBeenCalled();
  });

  it('retoma polling periodico apos reserva 200 com GET bem sucedido', async () => {
    jasmine.clock().install();
    try {
      await inicializarComOferta([slot1]);
      api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
      api.obterConversa.and.resolveTo(
        conversa(
          [
            fala('lead', 'Quero agendar'),
            fala('agente', 'Reunião confirmada.', null, 0, 'Helena Braga', confirmacaoSlot1),
          ],
          false,
          PERFIL_VAZIO,
          [],
        ),
      );

      await store.registrarAgendamento(101);
      expect(api.obterConversa.calls.count()).toBe(2);

      jasmine.clock().tick(3001);

      expect(api.obterConversa.calls.count()).toBe(3);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('retoma polling periodico apos sincronizarAgendamento recuperar pendencia com sucesso', async () => {
    jasmine.clock().install();
    try {
      await inicializarComOferta([slot1]);
      api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
      api.obterConversa.and.rejectWith(new Error('falha sincronizacao'));
      await store.registrarAgendamento(101);

      expect(store.agendamentoSincronizacaoPendente()).toBeTrue();

      api.obterConversa.and.resolveTo(
        conversa(
          [
            fala('lead', 'Quero agendar'),
            fala('agente', 'Reunião confirmada.', null, 0, 'Helena Braga', confirmacaoSlot1),
          ],
          false,
          PERFIL_VAZIO,
          [],
        ),
      );

      await store.sincronizarAgendamento();
      const chamadasAntes = api.obterConversa.calls.count();

      jasmine.clock().tick(3001);

      expect(api.obterConversa.calls.count()).toBe(chamadasAntes + 1);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('ignora memo com data de inicio invalida e mantem horarioPerdido nulo', async () => {
    const getItemSpy = spyOn(sessionStorage, 'getItem').and.callThrough();
    sessionStorage.setItem(
      'solar.agendamentoPerdido.c1',
      JSON.stringify({ id: 101, inicio: 'data-invalida', fim: '2026-10-15T15:00:00-03:00' }),
    );
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot2],
      ),
    );
    await store.iniciar();

    expect(getItemSpy).toHaveBeenCalledWith('solar.agendamentoPerdido.c1');
    expect(store.horarioPerdido()).toBeNull();
    expect(store.ofertaAgendamento()).toEqual([slot2]);
  });

  it('ignora memo com data de fim invalida e mantem horarioPerdido nulo', async () => {
    const getItemSpy = spyOn(sessionStorage, 'getItem').and.callThrough();
    sessionStorage.setItem(
      'solar.agendamentoPerdido.c1',
      JSON.stringify({ id: 101, inicio: '2026-10-15T14:00:00-03:00', fim: 'data-invalida' }),
    );
    api.obterConversa.and.resolveTo(
      conversa(
        [fala('agente', 'Com corretor.', 'agendar_reuniao', 0, 'Helena Braga')],
        false,
        PERFIL_VAZIO,
        [slot2],
      ),
    );
    await store.iniciar();

    expect(getItemSpy).toHaveBeenCalledWith('solar.agendamentoPerdido.c1');
    expect(store.horarioPerdido()).toBeNull();
    expect(store.ofertaAgendamento()).toEqual([slot2]);
  });

  it('409 com JSON em string contendo alternativas preserva a lista exata de alternativas na oferta', async () => {
    await inicializarComOferta([slot1, slot2]);
    api.registrarAgendamento.and.rejectWith(
      new HttpErrorResponse({
        status: 409,
        error: JSON.stringify({ codigo: 'horario_indisponivel', oferta: [slot2] }),
      }),
    );

    await store.registrarAgendamento(101);

    expect(api.obterConversa.calls.count()).toBe(1);
    expect(store.ofertaAgendamento()).toEqual([slot2]);
    expect(store.horarioPerdido()).toEqual(slot1);
    expect(sessionStorage.getItem('solar.agendamentoPerdido.c1')).toBe(
      JSON.stringify({ id: 101, inicio: slot1.inicio, fim: slot1.fim }),
    );
  });

  it('reconciliacao de erro no POST por GET valido vazio limpa mensagens anteriores da trilha', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Quero comprar'),
          fala('agente', 'Com Helena Braga.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        false,
        PERFIL_VAZIO,
        [slot1],
      ),
    );
    await store.iniciar();
    expect(store.itens().length).toBeGreaterThan(1);

    api.registrarAgendamento.and.rejectWith(new HttpErrorResponse({ status: 500 }));
    api.obterConversa.and.resolveTo(conversa([], false, PERFIL_VAZIO, [slot2]));

    await store.registrarAgendamento(101);

    expect(store.itens().filter((i) => i.tipo === 'pessoa' || i.tipo === 'lia')).toEqual([]);
    expect(store.itens().some((i) => i.tipo === 'evento')).toBeFalse();
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(store.agendamentoPodeSelecionar()).toBeFalse();
    expect(store.ofertaAgendamento()).toEqual([]);
  });

  it('sessionStorage bloqueado com excecao nao quebra inicializacao nem reserva', async () => {
    spyOn(sessionStorage, 'getItem').and.throwError(new Error('SecurityError'));
    spyOn(sessionStorage, 'setItem').and.throwError(new Error('SecurityError'));

    await inicializarComOferta([slot1, slot2]);
    expect(store.horarioPerdido()).toBeNull();

    api.registrarAgendamento.and.rejectWith(
      new HttpErrorResponse({
        status: 409,
        error: { codigo: 'horario_indisponivel', oferta: [slot2] },
      }),
    );

    await store.registrarAgendamento(101);
    expect(store.horarioPerdido()).toEqual(slot1);
    expect(store.ofertaAgendamento()).toEqual([slot2]);
  });

  it('POST de reserva antigo resolvendo apos exclusao bem sucedida nao afeta novo estado', async () => {
    await inicializarComOferta([slot1]);
    let resolverPost!: (c: AgendamentoDaConversa) => void;
    const promessaPost = new Promise<AgendamentoDaConversa>((resolve) => {
      resolverPost = resolve;
    });
    api.registrarAgendamento.and.returnValue(promessaPost);

    const reservaAntiga = store.registrarAgendamento(101);

    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-07T12:00:00Z',
      escopo: 'apenas_conversa',
      mensagem: 'apagada',
    });
    await store.apagarConversa();

    resolverPost(confirmacaoSlot1);
    await reservaAntiga;

    expect(store.agendamentoConfirmado()).toBeNull();
    expect(store.conversaAtual()).toBe('');
    expect(store.conversaApagada()).toBeTrue();
  });

  it('GET canonico de reserva antigo em voo resolvendo apos exclusao bem sucedida nao afeta novo estado', async () => {
    await inicializarComOferta([slot1]);
    expect(api.obterConversa.calls.count()).toBe(1);

    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);

    let resolverGetCanonico!: (c: ConversaResponse) => void;
    const promessaGetCanonica = new Promise<ConversaResponse>((resolve) => {
      resolverGetCanonico = resolve;
    });
    api.obterConversa.and.returnValue(promessaGetCanonica);

    const reservaAntiga = store.registrarAgendamento(101);
    await Promise.resolve();

    expect(api.obterConversa.calls.count()).toBe(2);
    expect(store.agendamentoEnviando()).toBeTrue();

    api.apagarConversa.and.resolveTo({
      leadExcluido: true,
      removidoEm: '2026-10-07T12:00:00Z',
      escopo: 'apenas_conversa',
      mensagem: 'apagada',
    });
    const sucessoExclusao = await store.apagarConversa();
    expect(sucessoExclusao).toBeTrue();

    resolverGetCanonico(
      conversa(
        [
          fala('lead', 'Quero o horario'),
          fala('agente', 'Reunião confirmada.', null, 0, 'Helena Braga', confirmacaoSlot1),
        ],
        false,
        PERFIL_VAZIO,
        [slot1],
      ),
    );
    await reservaAntiga;

    expect(store.conversaAtual()).toBe('');
    expect(store.conversaApagada()).toBeTrue();
    expect(store.agendamentoConfirmado()).toBeNull();
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.corretorAgendamento()).toBeNull();
    expect(store.horarioPerdido()).toBeNull();
    expect(store.agendamentoEnviando()).toBeFalse();
    expect(store.agendamentoSincronizacaoPendente()).toBeFalse();
    expect(store.itens().filter((i) => i.tipo === 'pessoa' || i.tipo === 'lia')).toEqual([]);
    expect(store.itens().some((i) => i.tipo === 'evento')).toBeFalse();
    expect(api.enviarMensagem).not.toHaveBeenCalled();
  });

  it('T9 item 7: recibo neutro Contato enviado persiste na reconstrucao do GET quando contato nao pendente e corretor definido', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Quero comprar um imovel'),
          fala('agente', 'Vou te passar para Helena.', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        false,
        PERFIL_VAZIO,
        [slot1],
      ),
    );

    await store.iniciar();

    const eventosContato = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(eventosContato.length).toBe(1);
    const evento = eventosContato[0];
    if (evento.tipo === 'evento') {
      expect(evento.texto).toBe('O corretor usará o contato que você forneceu.');
      expect(evento.variante).toBe('neutro');
    }
  });

  it('T9 item 8: linha Encaminhado para corretor aparece no maximo uma vez no chat mesmo com multiplos turnos', async () => {
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Oi'),
          fala('agente', 'Encaminhando 1', 'agendar_reuniao', 0, 'Helena Braga'),
          fala('lead', 'Qual horario?'),
          fala('agente', 'Encaminhando 2', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        false,
        PERFIL_VAZIO,
        [slot1],
      ),
    );

    await store.iniciar();

    const encaminhados = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado');
    expect(encaminhados.length).toBe(1);
    if (encaminhados[0].tipo === 'evento') {
      expect(encaminhados[0].texto).toContain('Helena Braga');
    }

    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Oi'),
          fala('agente', 'Encaminhando 1', 'agendar_reuniao', 0, 'Helena Braga'),
          fala('lead', 'Qual horario?'),
          fala('agente', 'Encaminhando 2', 'agendar_reuniao', 0, 'Helena Braga'),
          fala('agente', 'Encaminhando 3', 'agendar_reuniao', 0, 'Helena Braga'),
        ],
        false,
        PERFIL_VAZIO,
        [slot1],
      ),
    );
    await store.verificarNovasMensagens();
    const encaminhadosApos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado');
    expect(encaminhadosApos.length).toBe(1);
  });

  it('T9 item 5: gruposAgendamento apos confirmacao contem somente o slot confirmado e agendamentoPodeSelecionar e false', async () => {
    await inicializarComOferta([slot1, slot2]);
    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
    api.obterConversa.and.resolveTo(
      conversa(
        [
          fala('lead', 'Quero slot 1'),
          fala('agente', 'Confirmado!', 'continuar_conversa', 0, 'Helena Braga', confirmacaoSlot1),
        ],
        false,
        PERFIL_VAZIO,
        [],
      ),
    );

    await store.registrarAgendamento(101);

    expect(store.agendamentoEstaConfirmado()).toBeTrue();
    expect(store.agendamentoPodeSelecionar()).toBeFalse();
    expect(store.agendaDisponivel()).toBeTrue();
    expect(store.cartaoAgendaVisivel()).toBeTrue();
    expect(store.faixaAgendaVisivel()).toBeFalse();

    const grupos = store.gruposAgendamento();
    expect(grupos.length).toBe(1);
    expect(grupos[0].horarios.length).toBe(1);
    expect(grupos[0].horarios[0].id).toBe(101);

    store.recolherAgendamento();
    expect(store.agendamentoRecolhido()).toBeFalse();
    expect(store.cartaoAgendaVisivel()).toBeTrue();
  });

  it('R1: poll com mesma contagem e contatoPendente false->true remove recibo e exibe form; true->false repoem unico recibo sem novo POST', async () => {
    const mensagensFixas = [
      fala('lead', 'Quero atendimento'),
      fala('agente', 'Encaminhando para Helena', 'agendar_reuniao', 0, 'Helena Braga'),
    ];
    localStorage.setItem('solar.conversaId', 'c1');
    api.obterConversa.and.resolveTo(conversa(mensagensFixas, false, PERFIL_VAZIO, [slot1]));
    await store.iniciar();

    let recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);
    expect(store.itens().some((i) => i.tipo === 'contato')).toBeFalse();

    api.obterConversa.and.resolveTo(conversa(mensagensFixas, true, PERFIL_VAZIO, []));
    await store.verificarNovasMensagens();

    recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(0);
    expect(store.itens().some((i) => i.tipo === 'contato')).toBeTrue();
    expect(store.contatoRegistrado()).toBeFalse();

    api.obterConversa.and.resolveTo(conversa(mensagensFixas, false, PERFIL_VAZIO, [slot1]));
    await store.verificarNovasMensagens();

    recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);
    expect(store.itens().some((i) => i.tipo === 'contato')).toBeFalse();
    expect(store.contatoRegistrado()).toBeTrue();

    expect(api.obterConversa).toHaveBeenCalledTimes(3);
    expect(api.enviarMensagem).not.toHaveBeenCalled();
    expect(api.registrarContato).not.toHaveBeenCalled();
    expect(api.registrarAgendamento).not.toHaveBeenCalled();
  });

  it('R1: ciclo completo POST contato200 -> GET -> reserva -> GET/reload conserva exatamente um recibo antes do cartao e sem vazar sentinelas', async () => {
    const mensagensFixas = [
      fala('lead', 'Quero atendimento'),
      fala('agente', 'Encaminhando para Helena', 'agendar_reuniao', 0, 'Helena Braga'),
    ];
    localStorage.setItem('solar.conversaId', 'c1');
    api.obterConversa.and.resolveTo(conversa(mensagensFixas, true, PERFIL_VAZIO, []));
    await store.iniciar();

    expect(store.itens().some((i) => i.tipo === 'contato')).toBeTrue();
    expect(store.itens().some((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado')).toBeFalse();

    api.registrarContato.and.resolveTo({ leadId: 'lead-sentinela', oferta: [slot1] });
    await store.enviarContato({
      nome: 'Sentinela Nome',
      telefone: '11988887777',
      email: 'sentinela@teste.com',
    });

    let recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);
    if (recibos[0].tipo === 'evento') {
      expect(recibos[0].texto).toBe('O corretor usará o contato que você forneceu.');
      expect(recibos[0].texto).not.toContain('Sentinela');
      expect(recibos[0].texto).not.toContain('11988887777');
      expect(recibos[0].texto).not.toContain('sentinela@teste.com');
    }

    api.obterConversa.and.resolveTo(conversa(mensagensFixas, false, PERFIL_VAZIO, [slot1]));
    await store.verificarNovasMensagens();
    recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);

    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
    const mensagensConfirmadas = [
      ...mensagensFixas,
      fala('agente', 'Reunião agendada!', 'continuar_conversa', 0, 'Helena Braga', confirmacaoSlot1),
    ];
    api.obterConversa.and.resolveTo(conversa(mensagensConfirmadas, false, PERFIL_VAZIO, []));
    await store.registrarAgendamento(101);

    expect(store.agendamentoEstaConfirmado()).toBeTrue();
    recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);

    const storeReload = TestBed.runInInjectionContext(() => new ConversaStore());
    api.obterConversa.and.resolveTo(conversa(mensagensConfirmadas, false, PERFIL_VAZIO, []));
    await storeReload.abrirConversa('c1');

    expect(storeReload.agendamentoEstaConfirmado()).toBeTrue();
    const recibosReload = storeReload.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibosReload.length).toBe(1);

    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)!;
      const v = sessionStorage.getItem(k)!;
      expect(v).not.toContain('Sentinela');
      expect(v).not.toContain('11988887777');
      expect(v).not.toContain('sentinela@teste.com');
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      const v = localStorage.getItem(k)!;
      expect(v).not.toContain('Sentinela');
      expect(v).not.toContain('11988887777');
      expect(v).not.toContain('sentinela@teste.com');
    }
  });

  it('R1: oferta[] sem confirmacao mantem recibo e apenas aviso vazio; falha no POST nao gera falso recibo e novaConversa limpa estado', async () => {
    const mensagensFixas = [
      fala('lead', 'Quero atendimento'),
      fala('agente', 'Encaminhando para Helena', 'agendar_reuniao', 0, 'Helena Braga'),
    ];
    localStorage.setItem('solar.conversaId', 'c1');
    api.obterConversa.and.resolveTo(conversa(mensagensFixas, true, PERFIL_VAZIO, []));
    await store.iniciar();

    api.registrarContato.and.rejectWith(new Error('500 Internal Error'));
    await store.enviarContato({ nome: 'Teste', telefone: '11999990000', email: null });

    expect(store.contatoErro()).toBe('Não foi possível registrar seu contato. Tente novamente.');
    expect(store.itens().some((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado')).toBeFalse();
    expect(store.itens().some((i) => i.tipo === 'contato')).toBeTrue();

    api.registrarContato.and.resolveTo({ leadId: 'lead-vazio', oferta: [] });
    await store.enviarContato({ nome: 'Teste', telefone: '11999990000', email: null });

    expect(store.contatoRegistrado()).toBeTrue();
    expect(store.ofertaAgendamento().length).toBe(0);
    expect(store.agendamentoConfirmado()).toBeNull();
    expect(store.avisoAgendaVazia()).toBeTrue();
    expect(store.cartaoAgendaVisivel()).toBeFalse();
    const recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);

    await store.novaConversa();
    expect(store.itens().length).toBe(0);
    expect(store.itens().some((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado')).toBeFalse();
  });

  it('R2: chave versionada solar.agendamentoRecolhido.v1:<id> com valor 1, ciclo recolher/reload/reabrir e valor invalido', async () => {
    await inicializarComOferta([slot1, slot2]);
    const chave = 'solar.agendamentoRecolhido.v1:c1';

    expect(sessionStorage.getItem(chave)).toBeNull();
    expect(store.agendamentoRecolhido()).toBeFalse();

    store.recolherAgendamento();
    expect(store.agendamentoRecolhido()).toBeTrue();
    expect(sessionStorage.getItem(chave)).toBe('1');

    const storeF5 = TestBed.runInInjectionContext(() => new ConversaStore());
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Oi'), fala('agente', 'Ola', 'agendar_reuniao', 0, 'Helena Braga')], false, PERFIL_VAZIO, [slot1, slot2]));
    await storeF5.abrirConversa('c1');
    expect(storeF5.agendamentoRecolhido()).toBeTrue();

    storeF5.reabrirAgendamento();
    expect(storeF5.agendamentoRecolhido()).toBeFalse();
    expect(sessionStorage.getItem(chave)).toBeNull();

    sessionStorage.setItem(chave, 'qualquer-coisa');
    const storeInvalido = TestBed.runInInjectionContext(() => new ConversaStore());
    await storeInvalido.abrirConversa('c1');
    expect(storeInvalido.agendamentoRecolhido()).toBeFalse();
  });

  it('R2: excecoes em getItem/setItem/removeItem de sessionStorage nao quebram UX nem lanca erro', async () => {
    const chaveC1 = 'solar.agendamentoRecolhido.v1:c1';
    const spySet = spyOn(sessionStorage, 'setItem').and.throwError(new DOMException('QuotaExceededError'));
    const spyGet = spyOn(sessionStorage, 'getItem').and.throwError(new DOMException('SecurityError'));
    const spyRemove = spyOn(sessionStorage, 'removeItem').and.throwError(new DOMException('SecurityError'));

    const storeComErro = TestBed.runInInjectionContext(() => new ConversaStore());
    api.obterConversa.and.resolveTo(
      conversa([fala('lead', 'Oi'), fala('agente', 'Ola', 'agendar_reuniao', 0, 'Helena Braga')], false, PERFIL_VAZIO, [slot1, slot2]),
    );
    await storeComErro.abrirConversa('c1');

    expect(spyGet).toHaveBeenCalledWith(chaveC1);
    expect(storeComErro.agendamentoRecolhido()).toBeFalse();

    expect(() => storeComErro.recolherAgendamento()).not.toThrow();
    expect(spySet).toHaveBeenCalledWith(chaveC1, '1');
    expect(storeComErro.agendamentoRecolhido()).toBeTrue();

    expect(() => storeComErro.reabrirAgendamento()).not.toThrow();
    expect(spyRemove).toHaveBeenCalledWith(chaveC1);
    expect(storeComErro.agendamentoRecolhido()).toBeFalse();

    expect(() => storeComErro.novaConversa()).not.toThrow();
  });

  it('R2: isolamento entre conversas, exclusao remove apenas a chave relevante e confirmacao prevalece', async () => {
    sessionStorage.setItem('solar.agendamentoRecolhido.v1:c1', '1');
    sessionStorage.setItem('solar.agendamentoRecolhido.v1:c2', '1');

    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Oi'), fala('agente', 'Ola', 'agendar_reuniao', 0, 'Helena Braga')], false, PERFIL_VAZIO, [slot1]));
    await store.abrirConversa('c1');
    expect(store.agendamentoRecolhido()).toBeTrue();

    await store.novaConversa();
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c1')).toBeNull();
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c2')).toBe('1');

    sessionStorage.setItem('solar.agendamentoRecolhido.v1:c1', '1');
    api.obterConversa.and.resolveTo(conversa([fala('lead', 'Oi'), fala('agente', 'Ola', 'agendar_reuniao', 0, 'Helena Braga')], false, PERFIL_VAZIO, [slot1]));
    await store.abrirConversa('c1');
    api.apagarConversa.and.resolveTo({ leadExcluido: true, removidoEm: new Date().toISOString(), escopo: 'lead_e_vinculos', mensagem: 'Apagado' });
    await store.apagarConversa();

    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c1')).toBeNull();
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c2')).toBe('1');

    sessionStorage.setItem('solar.agendamentoRecolhido.v1:c-post-conf', '1');
    api.obterConversa.and.resolveTo({
      ...conversa([fala('lead', 'Oi'), fala('agente', 'Ola', 'agendar_reuniao', 0, 'Helena Braga')], false, PERFIL_VAZIO, [slot1]),
      conversaId: 'c-post-conf',
    });
    await store.abrirConversa('c-post-conf');
    expect(store.agendamentoRecolhido()).toBeTrue();
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c-post-conf')).toBe('1');

    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
    api.obterConversa.and.resolveTo({
      ...conversa([fala('lead', 'Oi'), fala('agente', 'Confirmado!', 'continuar_conversa', 0, 'Helena Braga', confirmacaoSlot1)], false, PERFIL_VAZIO, []),
      conversaId: 'c-post-conf',
    });
    await store.registrarAgendamento(101);
    expect(store.agendamentoEstaConfirmado()).toBeTrue();
    expect(store.agendamentoRecolhido()).toBeFalse();
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c-post-conf')).toBeNull();

    sessionStorage.setItem('solar.agendamentoRecolhido.v1:c4', '1');
    sessionStorage.setItem('solar.agendamentoRecolhido.v1:c5', '1');
    api.obterConversa.and.resolveTo({
      ...conversa([fala('lead', 'Oi'), fala('agente', 'Confirmado!', 'continuar_conversa', 0, 'Helena Braga', confirmacaoSlot1)], false, PERFIL_VAZIO, []),
      conversaId: 'c4',
    });
    await store.abrirConversa('c4');
    expect(store.agendamentoEstaConfirmado()).toBeTrue();
    expect(store.agendamentoRecolhido()).toBeFalse();
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c4')).toBeNull();
    expect(sessionStorage.getItem('solar.agendamentoRecolhido.v1:c5')).toBe('1');
  });

  it('R3: encaminhamento unico no fluxo ao vivo, polling e reload preservando falas e eventos', async () => {
    localStorage.setItem('solar.conversaId', 'c-enc');
    api.obterConversa.and.resolveTo(conversa([], false, PERFIL_VAZIO, []));
    await store.iniciar();

    api.enviarMensagem.and.resolveTo({
      conversaId: 'c-enc',
      resposta: 'Encaminhando seu caso para especialista',
      intencao: 'COMPRA',
      proximaAcao: 'agendar_reuniao',
      perfilLead: PERFIL_VAZIO,
      imoveisSugeridos: [],
      corretor: 'Helena Braga',
      contatoPendente: true,
      agendamento: null,
    });
    const msgsAteHandoff: MensagemDaConversa[] = [
      fala('lead', 'Quero agendar'),
      fala('agente', 'Encaminhando seu caso para especialista', 'agendar_reuniao', 0, 'Helena Braga'),
    ];
    api.obterConversa.and.resolveTo({
      ...conversa(msgsAteHandoff, true, PERFIL_VAZIO, []),
      conversaId: 'c-enc',
    });
    await store.enviar('Quero agendar');

    let encs = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado');
    expect(encs.length).toBe(1);

    api.registrarContato.and.resolveTo({ leadId: 'lead-1', oferta: [slot1] });
    await store.enviarContato({ nome: 'Ana', telefone: '11999990000', email: 'ana@teste.com' });

    let recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);
    expect(store.ofertaAgendamento()).toEqual([slot1]);
    expect(store.agendamentoPodeSelecionar()).toBeTrue();

    api.registrarAgendamento.and.resolveTo(confirmacaoSlot1);
    const msgsAposReserva: MensagemDaConversa[] = [
      fala('lead', 'Quero agendar'),
      fala('agente', 'Encaminhando seu caso para especialista', 'agendar_reuniao', 0, 'Helena Braga'),
      fala(
        'agente',
        'Combinado! Helena Braga vai te chamar no contato que você forneceu no horário agendado.',
        'continuar_conversa',
        0,
        'Helena Braga',
        confirmacaoSlot1,
      ),
    ];
    api.obterConversa.and.resolveTo({
      ...conversa(msgsAposReserva, false, PERFIL_VAZIO, []),
      conversaId: 'c-enc',
    });
    await store.registrarAgendamento(101);

    expect(api.registrarAgendamento).toHaveBeenCalledWith('c-enc', 101);
    expect(api.registrarAgendamento).toHaveBeenCalledTimes(1);
    expect(store.agendamentoEstaConfirmado()).toBeTrue();
    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendamentoPodeSelecionar()).toBeFalse();

    encs = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado');
    expect(encs.length).toBe(1);
    recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);

    api.enviarMensagem.and.resolveTo({
      conversaId: 'c-enc',
      resposta: 'Ainda estou encaminhando você para Helena Braga',
      intencao: 'COMPRA',
      proximaAcao: 'agendar_reuniao',
      perfilLead: PERFIL_VAZIO,
      imoveisSugeridos: [],
      corretor: 'Helena Braga',
      contatoPendente: false,
      agendamento: null,
    });
    await store.enviar('Mais uma dúvida');

    expect(store.agendamentoEstaConfirmado()).toBeTrue();
    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendamentoPodeSelecionar()).toBeFalse();

    encs = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado');
    expect(encs.length).toBe(1);
    recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);

    const falasLiaAoVivo = store.itens().filter((i) => i.tipo === 'lia').map((i) => (i as any).texto);
    expect(falasLiaAoVivo).toEqual([
      'Encaminhando seu caso para especialista',
      'Ainda estou encaminhando você para Helena Braga',
    ]);
    const eventoReuniaoAoVivo = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');
    expect(eventoReuniaoAoVivo).toBeDefined();
    expect((eventoReuniaoAoVivo as any).texto).toBe(
      'O corretor entrará em contato no horário agendado: quinta, 15 de outubro, 14h da tarde.',
    );
    expect(api.registrarAgendamento).toHaveBeenCalledTimes(1);

    const msgsCompletas = [
      fala('lead', 'Quero agendar'),
      fala('agente', 'Encaminhando seu caso para especialista', 'agendar_reuniao', 0, 'Helena Braga'),
      fala(
        'agente',
        'Combinado! Helena Braga vai te chamar no contato que você forneceu no horário agendado.',
        'continuar_conversa',
        0,
        'Helena Braga',
        confirmacaoSlot1,
      ),
      fala('lead', 'Mais uma dúvida'),
      fala('agente', 'Ainda estou encaminhando você para Helena Braga', 'agendar_reuniao', 0, 'Helena Braga', null),
    ];
    api.obterConversa.and.resolveTo({
      ...conversa(msgsCompletas, false, PERFIL_VAZIO, []),
      conversaId: 'c-enc',
    });
    const contagemGetAntesPoll = api.obterConversa.calls.count();
    await store.verificarNovasMensagens();
    expect(api.obterConversa.calls.count()).toBe(contagemGetAntesPoll + 1);

    expect(store.agendamentoEstaConfirmado()).toBeTrue();
    expect(store.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(store.ofertaAgendamento()).toEqual([]);
    expect(store.agendamentoPodeSelecionar()).toBeFalse();

    encs = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado');
    expect(encs.length).toBe(1);
    recibos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);

    const falasLiaPoll = store.itens().filter((i) => i.tipo === 'lia').map((i) => (i as any).texto);
    expect(falasLiaPoll).toEqual([
      'Encaminhando seu caso para especialista',
      'Ainda estou encaminhando você para Helena Braga',
    ]);
    const eventoReuniaoPoll = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');
    expect(eventoReuniaoPoll).toBeDefined();
    expect((eventoReuniaoPoll as any).texto).toBe(
      'O corretor entrará em contato no horário agendado: quinta, 15 de outubro, 14h da tarde.',
    );
    expect(api.registrarAgendamento).toHaveBeenCalledTimes(1);

    const storeReload = TestBed.runInInjectionContext(() => new ConversaStore());
    api.obterConversa.and.resolveTo({
      ...conversa(msgsCompletas, false, PERFIL_VAZIO, []),
      conversaId: 'c-enc',
    });
    const contagemGetAntesReload = api.obterConversa.calls.count();
    await storeReload.abrirConversa('c-enc');
    expect(api.obterConversa.calls.count()).toBe(contagemGetAntesReload + 1);

    expect(storeReload.agendamentoEstaConfirmado()).toBeTrue();
    expect(storeReload.agendamentoConfirmado()).toEqual(confirmacaoSlot1);
    expect(storeReload.ofertaAgendamento()).toEqual([]);
    expect(storeReload.agendamentoPodeSelecionar()).toBeFalse();

    encs = storeReload.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado');
    expect(encs.length).toBe(1);
    recibos = storeReload.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado');
    expect(recibos.length).toBe(1);

    const falasLiaReload = storeReload.itens().filter((i) => i.tipo === 'lia').map((i) => (i as any).texto);
    expect(falasLiaReload).toEqual([
      'Encaminhando seu caso para especialista',
      'Ainda estou encaminhando você para Helena Braga',
    ]);
    const eventoReuniaoReload = storeReload.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');
    expect(eventoReuniaoReload).toBeDefined();
    expect((eventoReuniaoReload as any).texto).toBe(
      'O corretor entrará em contato no horário agendado: quinta, 15 de outubro, 14h da tarde.',
    );
    const falasPessoaReload = storeReload.itens().filter((i) => i.tipo === 'pessoa').map((i) => (i as any).texto);
    expect(falasPessoaReload).toEqual(['Quero agendar', 'Mais uma dúvida']);
    expect(api.registrarAgendamento).toHaveBeenCalledTimes(1);
  });
});

describe('ConversaStore S-48 Tarefa 2: aviso Reunião agendada e regras de ocultação', () => {
  let store: ConversaStore;
  let api: jasmine.SpyObj<ConversaApi>;

  const isoInicioManha = '2026-10-09T09:00:00-03:00';
  const isoFimManha = '2026-10-09T10:00:00-03:00';
  const slotManha: SlotOferecido = { id: 201, inicio: isoInicioManha, fim: isoFimManha };
  const confManha: AgendamentoDaConversa = {
    estado: 'confirmado',
    horario: slotManha,
    alternativas: [],
  };

  const isoInicioTardeMin = '2026-10-07T14:30:00-03:00';
  const isoFimTardeMin = '2026-10-07T15:30:00-03:00';
  const slotTardeMin: SlotOferecido = { id: 202, inicio: isoInicioTardeMin, fim: isoFimTardeMin };
  const confTardeMin: AgendamentoDaConversa = {
    estado: 'confirmado',
    horario: slotTardeMin,
    alternativas: [],
  };

  const isoInicioNoite = '2026-10-08T19:00:00-03:00';
  const isoFimNoite = '2026-10-08T20:00:00-03:00';
  const slotNoite: SlotOferecido = { id: 203, inicio: isoInicioNoite, fim: isoFimNoite };
  const confNoite: AgendamentoDaConversa = {
    estado: 'confirmado',
    horario: slotNoite,
    alternativas: [],
  };

  const isoInicioNoiteMin = '2026-10-08T20:15:00-03:00';
  const isoFimNoiteMin = '2026-10-08T21:15:00-03:00';
  const slotNoiteMin: SlotOferecido = { id: 204, inicio: isoInicioNoiteMin, fim: isoFimNoiteMin };
  const confNoiteMin: AgendamentoDaConversa = {
    estado: 'confirmado',
    horario: slotNoiteMin,
    alternativas: [],
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('solar.conversaId', 'c-t2');

    api = jasmine.createSpyObj<ConversaApi>('ConversaApi', [
      'obterConversa',
      'enviarMensagem',
      'registrarContato',
      'registrarConsentimento',
      'apagarConversa',
      'registrarAgendamento',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConversaApi, useValue: api },
      ],
    });

    store = TestBed.inject(ConversaStore);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('par completo com mesmo em, papel lead e texto exato oculta lead e fala da Lia gerando aviso unico e sem divisor vazio', async () => {
    const timestamp = '2026-10-08T15:00:00.000Z';
    const msgs: MensagemDaConversa[] = [
      {
        papel: 'lead',
        texto: 'Sexta, 9 de outubro às 9h',
        em: timestamp,
        proximaAcao: null,
        corretor: null,
        agendamento: null,
      },
      {
        papel: 'agente',
        texto: 'Combinado! O corretor assume no horário.',
        em: timestamp,
        proximaAcao: 'continuar_conversa',
        corretor: 'Helena Braga',
        agendamento: confManha,
      },
    ];

    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, []));
    await store.iniciar();

    const itens = store.itens();
    expect(itens.some((i) => i.tipo === 'pessoa')).toBeFalse();
    expect(itens.some((i) => i.tipo === 'lia')).toBeFalse();

    const eventos = itens.filter((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');
    expect(eventos.length).toBe(1);
    expect((eventos[0] as any).texto).toBe(
      'O corretor entrará em contato no horário agendado: sexta, 9 de outubro, 9h da manhã.',
    );

    const divisores = itens.filter((i) => i.tipo === 'divisor');
    expect(divisores.length).toBe(1);
    expect(itens.indexOf(divisores[0])).toBe(0);
    expect(itens.indexOf(eventos[0])).toBe(1);
  });

  it('fallback: preserva fala do lead quando o em for distinto', async () => {
    const msgs: MensagemDaConversa[] = [
      {
        papel: 'lead',
        texto: 'Sexta, 9 de outubro às 9h',
        em: '2026-10-08T15:00:00.000Z',
        proximaAcao: null,
        corretor: null,
        agendamento: null,
      },
      {
        papel: 'agente',
        texto: 'Combinado!',
        em: '2026-10-08T15:00:02.000Z',
        proximaAcao: 'continuar_conversa',
        corretor: 'Helena Braga',
        agendamento: confManha,
      },
    ];

    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, []));
    await store.iniciar();

    const itens = store.itens();
    const itemPessoa = itens.find((i) => i.tipo === 'pessoa');
    expect(itemPessoa).toBeDefined();
    expect((itemPessoa as any).texto).toBe('Sexta, 9 de outubro às 9h');

    const eventos = itens.filter((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');
    expect(eventos.length).toBe(1);
    expect(itens.some((i) => i.tipo === 'lia')).toBeFalse();
  });

  it('fallback: preserva fala do lead quando o texto for diferente do formato do slot', async () => {
    const timestamp = '2026-10-08T15:00:00.000Z';
    const msgs: MensagemDaConversa[] = [
      {
        papel: 'lead',
        texto: 'Prefiro na sexta de manha',
        em: timestamp,
        proximaAcao: null,
        corretor: null,
        agendamento: null,
      },
      {
        papel: 'agente',
        texto: 'Combinado!',
        em: timestamp,
        proximaAcao: 'continuar_conversa',
        corretor: 'Helena Braga',
        agendamento: confManha,
      },
    ];

    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, []));
    await store.iniciar();

    const itens = store.itens();
    const itemPessoa = itens.find((i) => i.tipo === 'pessoa');
    expect(itemPessoa).toBeDefined();
    expect((itemPessoa as any).texto).toBe('Prefiro na sexta de manha');

    const eventos = itens.filter((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');
    expect(eventos.length).toBe(1);
    expect(itens.some((i) => i.tipo === 'lia')).toBeFalse();
  });

  it('fallback: preserva quando lead estiver ausente antes da confirmacao', async () => {
    const msgs: MensagemDaConversa[] = [
      {
        papel: 'agente',
        texto: 'Agendamento restaurado.',
        em: '2026-10-08T15:00:00.000Z',
        proximaAcao: 'continuar_conversa',
        corretor: 'Helena Braga',
        agendamento: confManha,
      },
    ];

    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, []));
    await store.iniciar();

    const itens = store.itens();
    expect(itens.some((i) => i.tipo === 'pessoa')).toBeFalse();
    expect(itens.some((i) => i.tipo === 'lia')).toBeFalse();
    const eventos = itens.filter((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');
    expect(eventos.length).toBe(1);
  });

  it('fallback: confirmacao sem slot valido preserva fala da Lia sem inventar data ou evento', async () => {
    const semSlot: AgendamentoDaConversa = {
      estado: 'confirmado',
      horario: null as any,
      alternativas: [],
    };
    const msgs: MensagemDaConversa[] = [
      {
        papel: 'agente',
        texto: 'Confirmamos sua intencao.',
        em: '2026-10-08T15:00:00.000Z',
        proximaAcao: 'continuar_conversa',
        corretor: 'Helena Braga',
        agendamento: semSlot,
      },
    ];

    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, []));
    await store.iniciar();

    const itens = store.itens();
    expect(itens.some((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada')).toBeFalse();
    const lia = itens.find((i) => i.tipo === 'lia');
    expect(lia).toBeDefined();
    expect((lia as any).texto).toBe('Confirmamos sua intencao.');
  });

  it('preserva mensagens alheias que contenham Combinado ou texto de horario sem confirmacao associada', async () => {
    const msgs: MensagemDaConversa[] = [
      {
        papel: 'lead',
        texto: 'Combinado! Sexta, 9 de outubro às 9h é um ótimo horário.',
        em: '2026-10-08T10:00:00.000Z',
        proximaAcao: null,
        corretor: null,
        agendamento: null,
      },
      {
        papel: 'agente',
        texto: 'Combinado! Vou verificar as opções.',
        em: '2026-10-08T10:00:05.000Z',
        proximaAcao: 'continuar_conversa',
        corretor: null,
        agendamento: null,
      },
    ];

    api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, []));
    await store.iniciar();

    const itens = store.itens();
    const pessoa = itens.find((i) => i.tipo === 'pessoa');
    expect(pessoa).toBeDefined();
    expect((pessoa as any).texto).toBe('Combinado! Sexta, 9 de outubro às 9h é um ótimo horário.');

    const lia = itens.find((i) => i.tipo === 'lia');
    expect(lia).toBeDefined();
    expect((lia as any).texto).toBe('Combinado! Vou verificar as opções.');

    expect(itens.some((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada')).toBeFalse();
  });

  it('formata periodos manha, tarde, noite e minutos em slots distintos', async () => {
    const casos = [
      {
        conf: confManha,
        esperado: 'O corretor entrará em contato no horário agendado: sexta, 9 de outubro, 9h da manhã.',
      },
      {
        conf: confTardeMin,
        esperado: 'O corretor entrará em contato no horário agendado: quarta, 7 de outubro, 14h30 da tarde.',
      },
      {
        conf: confNoite,
        esperado: 'O corretor entrará em contato no horário agendado: quinta, 8 de outubro, 19h da noite.',
      },
      {
        conf: confNoiteMin,
        esperado: 'O corretor entrará em contato no horário agendado: quinta, 8 de outubro, 20h15 da noite.',
      },
    ];

    for (const { conf, esperado } of casos) {
      const msgs: MensagemDaConversa[] = [
        {
          papel: 'agente',
          texto: 'Confirmado.',
          em: '2026-10-08T12:00:00.000Z',
          proximaAcao: 'continuar_conversa',
          corretor: 'Helena Braga',
          agendamento: conf,
        },
      ];
      api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, []));
      await store.iniciar();

      const evento = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada');
      expect(evento).toBeDefined();
      expect((evento as any).texto).toBe(esperado);
    }
  });

  describe('S-48 Tarefa 6: horas nos avisos do chat', () => {
    it('Encaminhado: ao vivo reconcilia hora canonica com GET imediato na fala da Lia e no evento', async () => {
      localStorage.setItem('solar.conversaId', 'c-hora-enc');
      const msgsIniciais: MensagemDaConversa[] = [
        fala('lead', 'Ola'),
        fala('agente', 'Ola! Como posso ajudar?'),
      ];
      api.obterConversa.and.resolveTo(conversa(msgsIniciais, false, PERFIL_VAZIO, []));
      await store.iniciar();

      const emPersistido = '2026-10-08T14:32:00-03:00';
      const horaEsperada = horaDe(emPersistido);

      api.enviarMensagem.and.resolveTo({
        conversaId: 'c-hora-enc',
        resposta: 'Encaminhando seu caso para Helena Braga',
        intencao: 'COMPRA',
        proximaAcao: 'agendar_reuniao',
        perfilLead: PERFIL_VAZIO,
        imoveisSugeridos: [],
        corretor: 'Helena Braga',
        contatoPendente: true,
        agendamento: null,
      });

      const msgsHandoff: MensagemDaConversa[] = [
        ...msgsIniciais,
        fala('lead', 'Quero corretor'),
        {
          ...fala('agente', 'Encaminhando seu caso para Helena Braga', 'agendar_reuniao', 0, 'Helena Braga'),
          em: emPersistido,
        },
      ];

      api.obterConversa.and.resolveTo({
        ...conversa(msgsHandoff, true, PERFIL_VAZIO, []),
        conversaId: 'c-hora-enc',
      });

      await store.enviar('Quero corretor');

      const eventoEnc = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado') as any;
      expect(eventoEnc).toBeDefined();
      expect(eventoEnc.hora).toBe(horaEsperada);

      const falaLia = store.itens().find((i) => i.tipo === 'lia' && i.texto.includes('Helena Braga')) as any;
      expect(falaLia).toBeDefined();
      expect(falaLia.hora).toBe(horaEsperada);

      expect(api.enviarMensagem).toHaveBeenCalledTimes(1);
    });

    it('Encaminhado: falha do GET imediato mantem turno e polling recupera hora posteriormente', async () => {
      localStorage.setItem('solar.conversaId', 'c-falha-get');
      api.obterConversa.and.resolveTo(conversa([], false, PERFIL_VAZIO, []));
      await store.iniciar();

      api.enviarMensagem.and.resolveTo({
        conversaId: 'c-falha-get',
        resposta: 'Encaminhando para especialista',
        intencao: 'COMPRA',
        proximaAcao: 'agendar_reuniao',
        perfilLead: PERFIL_VAZIO,
        imoveisSugeridos: [],
        corretor: 'Helena Braga',
        contatoPendente: true,
        agendamento: null,
      });

      api.obterConversa.and.rejectWith(new Error('Falha de rede'));

      await store.enviar('Preciso de ajuda');

      expect(store.estado()).toBe('conversando');
      let eventoEnc = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado') as any;
      expect(eventoEnc).toBeDefined();
      expect(eventoEnc.hora).toBeNull();

      const emPersistido = '2026-10-08T15:10:00-03:00';
      const msgsHandoff: MensagemDaConversa[] = [
        fala('lead', 'Preciso de ajuda'),
        {
          ...fala('agente', 'Encaminhando para especialista', 'agendar_reuniao', 0, 'Helena Braga'),
          em: emPersistido,
        },
      ];
      api.obterConversa.and.resolveTo({
        ...conversa(msgsHandoff, true, PERFIL_VAZIO, []),
        conversaId: 'c-falha-get',
      });

      await store.verificarNovasMensagens();

      eventoEnc = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado') as any;
      expect(eventoEnc.hora).toBe(horaDe(emPersistido));
    });

    it('Encaminhado: primeira origem prevalece sobre handoffs posteriores', async () => {
      const emPrimeiro = '2026-10-08T10:00:00-03:00';
      const emSegundo = '2026-10-08T11:00:00-03:00';
      const msgs: MensagemDaConversa[] = [
        fala('lead', 'Primeiro pedido'),
        { ...fala('agente', 'Primeiro handoff', 'agendar_reuniao', 0, 'Helena Braga'), em: emPrimeiro },
        fala('lead', 'Segundo pedido'),
        { ...fala('agente', 'Segundo handoff', 'agendar_reuniao', 0, 'Helena Braga'), em: emSegundo },
      ];
      api.obterConversa.and.resolveTo(conversa(msgs, true, PERFIL_VAZIO, []));
      await store.iniciar();

      const encs = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Encaminhado') as any[];
      expect(encs.length).toBe(1);
      expect(encs[0].hora).toBe(horaDe(emPrimeiro));
    });

    it('Reunião agendada: hora deriva de mensagem.em da confirmacao e nao de horario.inicio', async () => {
      const emConfirmacao = '2026-10-08T16:20:00-03:00';
      const conf = {
        estado: 'confirmado' as const,
        horario: {
          id: 99,
          inicio: '2026-10-15T09:00:00-03:00',
          fim: '2026-10-15T10:00:00-03:00',
        },
        alternativas: [],
      };
      const msgs: MensagemDaConversa[] = [
        fala('lead', 'Quero marcar'),
        {
          ...fala('agente', 'Confirmado seu horario', 'continuar_conversa', 0, 'Helena Braga', conf),
          em: emConfirmacao,
        },
      ];
      api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, []));
      await store.iniciar();

      const reuniao = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Reunião agendada') as any;
      expect(reuniao).toBeDefined();
      expect(reuniao.hora).toBe(horaDe(emConfirmacao));
      expect(reuniao.hora).not.toBe(horaDe(conf.horario.inicio));
    });

    it('Contato enviado: POST registra contatoEm, reload preserva hora e campo nulo fica sem hora', async () => {
      localStorage.setItem('solar.conversaId', 'c-contato-hora');
      api.obterConversa.and.resolveTo(conversa([], false, PERFIL_VAZIO, []));
      await store.iniciar();

      const emContato = '2026-10-08T17:45:00-03:00';
      api.registrarContato.and.resolveTo({
        leadId: 'l1',
        oferta: [],
        contatoEm: emContato,
      });

      await store.enviarContato({ nome: 'Carlos', telefone: '11988887777', email: 'c@teste.com' });

      let recibo = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado') as any;
      expect(recibo).toBeDefined();
      expect(recibo.hora).toBe(horaDe(emContato));

      const msgsComCorretor: MensagemDaConversa[] = [
        fala('agente', 'Atendimento com corretor', 'agendar_reuniao', 0, 'Helena Braga'),
      ];
      api.obterConversa.and.resolveTo({
        ...conversa(msgsComCorretor, false, PERFIL_VAZIO, []),
        conversaId: 'c-contato-hora',
        contatoEm: emContato,
      });

      await store.abrirConversa('c-contato-hora-2');
      api.obterConversa.and.resolveTo({
        ...conversa(msgsComCorretor, false, PERFIL_VAZIO, []),
        conversaId: 'c-contato-hora',
        contatoEm: emContato,
      });
      await store.abrirConversa('c-contato-hora');

      recibo = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado') as any;
      expect(recibo).toBeDefined();
      expect(recibo.hora).toBe(horaDe(emContato));
    });

    it('Contato enviado: migracao antiga sem contatoEm fica sem hora e polling atualiza sem duplicar nem trocar ID', async () => {
      const msgsComCorretor: MensagemDaConversa[] = [
        fala('agente', 'Atendimento com corretor', 'agendar_reuniao', 0, 'Helena Braga'),
      ];
      api.obterConversa.and.resolveTo({
        ...conversa(msgsComCorretor, false, PERFIL_VAZIO, []),
        conversaId: 'c-legado',
        contatoEm: null,
      });
      await store.iniciar();

      let recibo = store.itens().find((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado') as any;
      expect(recibo).toBeDefined();
      expect(recibo.hora).toBeNull();
      const idOriginal = recibo.id;

      const emChegada = '2026-10-08T18:00:00-03:00';
      api.obterConversa.and.resolveTo({
        ...conversa(msgsComCorretor, false, PERFIL_VAZIO, []),
        conversaId: 'c-legado',
        contatoEm: emChegada,
      });

      await store.verificarNovasMensagens();

      const recibosApos = store.itens().filter((i) => i.tipo === 'evento' && i.rotulo === 'Contato enviado') as any[];
      expect(recibosApos.length).toBe(1);
      expect(recibosApos[0].id).toBe(idOriginal);
      expect(recibosApos[0].hora).toBe(horaDe(emChegada));
    });

    it('limpa timestampContato em resetarAgenda, novaConversa e exclusao', async () => {
      localStorage.setItem('solar.conversaId', 'c-limpeza');
      api.obterConversa.and.resolveTo(conversa([], false, PERFIL_VAZIO, []));
      await store.iniciar();

      api.registrarContato.and.resolveTo({
        leadId: 'l1',
        oferta: [],
        contatoEm: '2026-10-08T12:00:00-03:00',
      });
      await store.enviarContato({ nome: 'Bia', telefone: '11977776666', email: 'b@teste.com' });

      expect((store as any).timestampContato).toBe('2026-10-08T12:00:00-03:00');

      await store.novaConversa();
      expect((store as any).timestampContato).toBeNull();

      localStorage.setItem('solar.conversaId', 'c-limpeza-2');
      const msgs: MensagemDaConversa[] = [fala('lead', 'Ola'), fala('agente', 'Ola!')];
      api.obterConversa.and.resolveTo(conversa(msgs, false, PERFIL_VAZIO, []));
      await store.iniciar();

      (store as any).timestampContato = '2026-10-08T12:00:00-03:00';
      api.apagarConversa.and.resolveTo({
        leadExcluido: true,
        removidoEm: new Date().toISOString(),
        escopo: 'lead_e_vinculos',
        mensagem: 'Apagado',
      });
      const apagou = await store.apagarConversa();
      expect(apagou).toBeTrue();
      expect((store as any).timestampContato).toBeNull();
    });
  });
});

