export type Papel = 'lead' | 'agente';

export type ProximaAcao =
  | 'continuar_conversa'
  | 'sugerir_imoveis'
  | 'agendar_reuniao'
  | 'direcionar_especialista'
  | 'encerrar';

export interface PerfilLead {
  nome: string | null;
  intencao: string | null;
  precoMin: number | null;
  precoMax: number | null;
  quartos: number | null;
  regiao: string | null;
  urgencia: string | null;
  expectativaRetorno: string | null;
  score: number | null;
}

export interface ImovelSugerido {
  id: string;
  tipo: string;
  bairro: string;
  quartos: number;
  metragem: number;
  precoVenda: number | null;
  precoAluguel: number | null;
  motivo: string;
}

export interface MensagemHistorico {
  papel: Papel;
  texto: string;
  em: string;
}

export interface NovaMensagemRequest {
  texto: string;
}

export interface MensagemResponse {
  conversaId: string;
  resposta: string;
  intencao: string;
  proximaAcao: ProximaAcao;
  perfilLead: PerfilLead;
  imoveisSugeridos: ImovelSugerido[];
}

export interface ConversaResponse {
  conversaId: string;
  perfilLead: PerfilLead;
  mensagens: MensagemHistorico[];
}

export const LIMITE_MENSAGEM = 4000;
