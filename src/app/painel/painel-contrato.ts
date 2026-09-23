import { ImovelSugerido } from '../conversa/contrato';

export interface LeadCorretorResumo {
  id: string;
  nome: string;
  iniciais: string;
}

export interface LeadPainelItem {
  id: string;
  nomeExibicao: string | null;
  referencia: string;
  pedidoResumo: string;
  criadoEm: string;
  qualificacao: number | null;
  leadStatus: 'novo' | 'encaminhado';
  encaminhamentoStatus: 'aguardando' | 'atribuido' | null;
  corretor: LeadCorretorResumo | null;
}

export interface FilaLeadsResponse {
  itens: LeadPainelItem[];
  total: number;
}

export interface QualificacaoFator {
  codigo: string;
  rotulo: string;
  pontos: number;
  preenchido: boolean;
}

export interface QualificacaoLead {
  valor: number | null;
  fatores: QualificacaoFator[];
}

export interface ResumoLia {
  perfil: string | null;
  orcamento: string | null;
  imoveis: string | null;
  objecoes: string | null;
  proximoPasso: string | null;
}

export interface EncaminhamentoDetalhe {
  id: number;
  status: string;
  corretor: LeadCorretorResumo | null;
  atribuidoEm: string;
}

export interface AgendamentoDetalhe {
  dataHora: string;
  status: string;
}

export interface TurnoTranscricao {
  papel: 'lead' | 'lia';
  texto: string;
  em: string;
}

export interface LeadDetalheResponse {
  id: string;
  nomeExibicao: string | null;
  referencia: string;
  pedidoResumo: string;
  criadoEm: string;
  leadStatus: 'novo' | 'encaminhado';
  contato: {
    telefone: string | null;
    email: string | null;
  };
  qualificacao: QualificacaoLead;
  resumo: ResumoLia | null;
  encaminhamento: EncaminhamentoDetalhe | null;
  agendamento: AgendamentoDetalhe | null;
  imoveisSugeridos: ImovelSugerido[];
  transcricao: TurnoTranscricao[];
}
