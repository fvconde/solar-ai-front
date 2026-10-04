export interface MetricasPainelResponse {
  periodo: { dias: number; inicio: string; atualizadoEm: string };
  conversasIniciadas: number;
  horariosConfirmados: number;
  reservasProximos7Dias: number;
  leadsPorIntencao: { compra: number; aluguel: number; investimento: number; semIntencao: number };
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
  };
}
