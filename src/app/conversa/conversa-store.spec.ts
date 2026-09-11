import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConversaApi } from './conversa-api';
import { ConversaStore } from './conversa-store';
import {
  AgendamentoDaConversa,
  ConversaResponse,
  MensagemDaConversa,
  PerfilLead,
  ProximaAcao,
} from './contrato';
import { ItemTrilha } from './trilha';

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
): MensagemDaConversa {
  const em = new Date();
  em.setDate(em.getDate() - dias);
  return { papel, texto, em: em.toISOString(), proximaAcao, corretor, agendamento };
}

function conversa(
  mensagens: MensagemDaConversa[],
  contatoPendente = false,
): ConversaResponse {
  return {
    conversaId: 'c1',
    perfilLead: PERFIL_VAZIO,
    mensagens,
    contatoPendente,
    consentimentoEm: new Date().toISOString(),
    versaoAvisoPrivacidade: '2026-09-11.2',
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
    api.registrarContato.and.resolveTo({ leadId: 'l1' });

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
      versaoAvisoPrivacidade: '2026-09-11.2',
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
});
