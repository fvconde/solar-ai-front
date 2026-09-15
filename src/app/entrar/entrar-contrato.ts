export interface CorretorSessao {
  id: string;
  nome: string;
  especialidade: string;
}

export interface IdentificacaoResposta {
  cadastrado: boolean;
}

export interface SessaoResposta {
  corretor: CorretorSessao;
}

export interface RecuperacaoResposta {
  email: string;
}

export type TelaEntrar =
  | 'email'
  | 'senha'
  | 'nao-encontrado'
  | 'recuperar'
  | 'link-enviado'
  | 'nova-senha'
  | 'link-invalido';

export const TENTATIVAS_ATE_BLOQUEIO = 5;
export const SEGUNDOS_DE_BLOQUEIO = 30;
export const MINIMO_CARACTERES_SENHA = 8;
