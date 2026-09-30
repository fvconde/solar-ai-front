export type Perfil = 'cliente' | 'corretor' | 'supervisor';
export type StatusCorretor = 'em_analise' | 'aprovado';

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
}

export interface SessaoResponse {
  usuario: UsuarioSessao;
  perfil: Perfil;
  statusCorretor: StatusCorretor | null;
  corretorId: string | null;
  vinculoAtivo: boolean;
  filtrosPermitidos: string[];
  filtroInicial: string | null;
  pendentesAprovacao: number | null;
}

export interface ErroApi {
  codigo: string;
  mensagem?: string;
  campos?: Record<string, string>;
  segundosRestantes?: number;
}
