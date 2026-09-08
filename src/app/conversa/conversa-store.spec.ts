import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConversaApi } from './conversa-api';
import { ConversaStore } from './conversa-store';
import { ConversaResponse, MensagemDaConversa, PerfilLead, ProximaAcao } from './contrato';
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

function fala(
  papel: 'lead' | 'agente',
  texto: string,
  proximaAcao: ProximaAcao | null = null,
  dias = 0,
): MensagemDaConversa {
  const em = new Date();
  em.setDate(em.getDate() - dias);
  return { papel, texto, em: em.toISOString(), proximaAcao };
}

function conversa(mensagens: MensagemDaConversa[]): ConversaResponse {
  return { conversaId: 'c1', perfilLead: PERFIL_VAZIO, mensagens };
}

describe('ConversaStore ao retomar', () => {
  let store: ConversaStore;
  let api: jasmine.SpyObj<ConversaApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ConversaApi>('ConversaApi', ['obterConversa', 'enviarMensagem']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConversaApi, useValue: api },
      ],
    });

    localStorage.setItem('solar.consentimento', 'aceito');
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
});
