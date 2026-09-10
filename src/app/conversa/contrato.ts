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

export interface SlotOferecido {
  id: number;
  inicio: string;
  fim: string;
}

export interface AgendamentoDaConversa {
  estado: 'confirmado' | 'indisponivel';
  horario: SlotOferecido | null;
  alternativas: SlotOferecido[];
}

export interface MensagemHistorico {
  papel: Papel;
  texto: string;
  em: string;
}

/**
 * Uma fala ja gravada, como o GET /conversas/{id} devolve. Diferente do
 * MensagemHistorico do contrato do /turn: carrega o desfecho do turno, que e o
 * que permite redesenhar os eventos da trilha depois de um reload.
 */
export interface MensagemDaConversa {
  papel: Papel;
  texto: string;
  em: string;
  proximaAcao: ProximaAcao | null;
  /** Nome do corretor atribuido, nas falas que fecharam em handoff. */
  corretor: string | null;
  agendamento: AgendamentoDaConversa | null;
}

export interface ContatoRequest {
  nome: string | null;
  telefone: string | null;
  email: string | null;
}

export interface ContatoResponse {
  leadId: string;
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
  corretor: string | null;
  contatoPendente: boolean;
  agendamento: AgendamentoDaConversa | null;
}

export interface ConversaResponse {
  conversaId: string;
  perfilLead: PerfilLead;
  mensagens: MensagemDaConversa[];
  contatoPendente: boolean;
}

export const LIMITE_MENSAGEM = 4000;
export const LIMITE_NOME = 200;
export const LIMITE_TELEFONE = 20;
export const LIMITE_EMAIL = 200;
