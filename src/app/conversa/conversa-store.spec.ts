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
  VERSAO_AVISO_PRIVACIDADE,
} from './contrato';
import { ItemLia, ItemTrilha } from './trilha';

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
): ConversaResponse {
  return {
    conversaId: 'c1',
    perfilLead,
    mensagens,
    contatoPendente,
    consentimentoEm: new Date().toISOString(),
    versaoAvisoPrivacidade: '2026-09-11',
    oferta: [],
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

  afterEach(() => localStorage.clear());

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

    expect(textoDoEvento(store.itens())).toContain('15:00');
    expect(textoDoEvento(store.itens())).toContain('10/09/2026');
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

  afterEach(() => localStorage.clear());

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
