export type EtapaAvancoPainel =
  | 'iniciadas'
  | 'intencao'
  | 'essenciais'
  | 'encaminhamento'
  | 'corretor'
  | 'horario'
  | 'atribuidas';

export interface AvancoMetricasPainel {
  etapa: EtapaAvancoPainel;
  conversas: number;
  semEssenciais?: number;
}

export interface MetricasPainelResponse {
  periodo: {
    dias: number;
    inicio: string;
    atualizadoEm: string;
    historicoDesde: string;
  };
  conversasIniciadas: number;
  horariosConfirmados: number;
  reservasProximos7Dias: number;
  leadsPorIntencao: {
    compra: number;
    aluguel: number;
    investimento: number;
    semIntencao: number;
  };
  equipe: {
    atribuidasPorCorretor: {
      corretor: { id: string; nome: string; iniciais: string };
      conversas: number;
    }[];
    aguardandoCorretor: number;
    pendentesAprovacao: number;
  } | null;
  extras: {
    score: { frio: number; morno: number; quente: number; semAvaliacao: number };
    regioes: { top: { regiao: string; leads: number }[]; outras: number; informaram: number; leads: number };
    imoveis: { id: string; bairro: string; conversas: number }[];
    proximosHorarios: { inicio: string; iniciais: string }[];
    privacidade: {
      leads: number;
      comConsentimento: number;
      prazoRetencaoMeses: number;
      vencem30Dias: number;
      proximoVencimento: string | null;
    };
    tempoMedianoMin: number | null;
    tempoMedianoDiario: (number | null)[];
    followUp: {
      janelaDias: number;
      comFollowUp: number;
      janelaEncerrada: number;
      responderam: number;
      emObservacao: number;
    };
  };
  avanco: AvancoMetricasPainel[];
  dadosEssenciaisPreenchidos: number;
}
