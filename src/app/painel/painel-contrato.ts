export interface CorretorIdentificacao {
  id: string;
  nome: string;
  especialidade: string;
}

export interface LeadPainelItem {
  id: string;
  nome: string | null;
  intencao: string | null;
  score: number | null;
  ultimaInteracao: string;
  status: string;
  corretorId: string | null;
  corretorNome: string | null;
  regiao: string | null;
}

export interface FilaLeadsResponse {
  leads: LeadPainelItem[];
  total: number;
}
