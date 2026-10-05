import { MetricasPainelResponse } from './metricas-contrato';

export function metricasParaTeste(vazio = false): MetricasPainelResponse {
  return {
    periodo: {
      dias: 30,
      inicio: '2026-09-03T15:00:00Z',
      atualizadoEm: '2026-10-03T15:00:00Z',
      historicoDesde: '2026-08-01T00:00:00Z',
    },
    conversasIniciadas: vazio ? 0 : 14,
    horariosConfirmados: vazio ? 0 : 4,
    reservasProximos7Dias: vazio ? 0 : 3,
    leadsPorIntencao: {
      compra: vazio ? 0 : 5,
      aluguel: vazio ? 0 : 4,
      investimento: vazio ? 0 : 3,
      semIntencao: vazio ? 0 : 2,
    },
    equipe: {
      atribuidasPorCorretor: vazio
        ? []
        : [
            { corretor: { id: 'c1', nome: 'Helena Nome Somente Acessível', iniciais: 'HN' }, conversas: 3 },
            { corretor: { id: 'c2', nome: 'Rafael Nome Somente Acessível', iniciais: 'RN' }, conversas: 2 },
          ],
      aguardandoCorretor: vazio ? 0 : 2,
      pendentesAprovacao: vazio ? 0 : 1,
    },
    extras: {
      score: { frio: vazio ? 0 : 4, morno: vazio ? 0 : 5, quente: vazio ? 0 : 3, semAvaliacao: vazio ? 0 : 2 },
      regioes: {
        top: vazio ? [] : [{ regiao: 'MOEMA', leads: 3 }],
        outras: vazio ? 0 : 9,
        informaram: vazio ? 0 : 12,
        leads: vazio ? 0 : 14,
      },
      imoveis: vazio ? [] : [{ id: 'IMV-001', bairro: 'Moema', conversas: 4 }],
      proximosHorarios: vazio ? [] : [{ inicio: '2026-10-04T18:00:00Z', iniciais: 'HN' }],
      privacidade: {
        leads: vazio ? 0 : 14,
        comConsentimento: vazio ? 0 : 14,
        prazoRetencaoMeses: 1,
        vencem30Dias: vazio ? 0 : 2,
        proximoVencimento: vazio ? null : '2026-10-15T15:00:00Z',
      },
      tempoMedianoMin: vazio ? null : 11,
      tempoMedianoDiario: vazio ? [] : [18, 15, 14, 12, 13, 11, 11],
      followUp: vazio
        ? { janelaDias: 7, comFollowUp: 0, janelaEncerrada: 0, responderam: 0, emObservacao: 0 }
        : { janelaDias: 7, comFollowUp: 5, janelaEncerrada: 4, responderam: 2, emObservacao: 1 },
    },
    avanco: vazio
      ? [
          { etapa: 'iniciadas', conversas: 0 },
          { etapa: 'intencao', conversas: 0 },
          { etapa: 'essenciais', conversas: 0 },
          { etapa: 'encaminhamento', conversas: 0 },
          { etapa: 'corretor', conversas: 0 },
          { etapa: 'horario', conversas: 0 },
        ]
      : [
          { etapa: 'iniciadas', conversas: 14 },
          { etapa: 'intencao', conversas: 12 },
          { etapa: 'essenciais', conversas: 8 },
          { etapa: 'encaminhamento', conversas: 9, semEssenciais: 2 },
          { etapa: 'corretor', conversas: 7 },
          { etapa: 'horario', conversas: 4 },
        ],
    dadosEssenciaisPreenchidos: vazio ? 0 : 8,
  };
}
