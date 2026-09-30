import { Perfil, StatusCorretor } from '../sessao/sessao-contrato';

export type Regiao = 'norte' | 'sul' | 'leste' | 'oeste' | 'centro';
export type Especialidade = 'moradia' | 'investimento';

export interface ContaResponse {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  perfil: Perfil;
  criadaEm: string;
  corretor: {
    status: StatusCorretor;
    regioes: string[];
    especialidades: string[];
    aprovadoEm: string | null;
  } | null;
  consentimento: { em: string; versao: string } | null;
  conversasSalvas: number;
}

export interface ConversaResumo {
  id: string;
  titulo: string;
  atualizadaEm: string;
  estado: 'em_andamento' | 'com_corretor' | 'encerrada';
}

export interface CadastroClienteRequest {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  aceitePrivacidade: true;
  conversaId?: string;
}

export interface CadastroCorretorRequest {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  aceitePrivacidade: true;
  regioes: Regiao[];
  especialidades: Especialidade[];
}

export interface EdicaoContaRequest {
  nome?: string;
  telefone?: string;
  email?: string;
  senhaAtual?: string;
  regioes?: Regiao[];
  especialidades?: Especialidade[];
}

export const REGIOES: { valor: Regiao; rotulo: string }[] = [
  { valor: 'norte', rotulo: 'Norte' },
  { valor: 'sul', rotulo: 'Sul' },
  { valor: 'leste', rotulo: 'Leste' },
  { valor: 'oeste', rotulo: 'Oeste' },
  { valor: 'centro', rotulo: 'Centro' },
];

export const ESPECIALIDADES: { valor: Especialidade; rotulo: string }[] = [
  { valor: 'investimento', rotulo: 'Investimento' },
  { valor: 'moradia', rotulo: 'Moradia' },
];

const ROTULOS: Record<string, string> = Object.fromEntries(
  [...REGIOES, ...ESPECIALIDADES].map((item) => [item.valor, item.rotulo]),
);

export function rotuloDe(valor: string): string {
  return ROTULOS[valor] ?? valor;
}

export function juntarComE(itens: string[]): string {
  if (itens.length <= 1) {
    return itens.join('');
  }
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

export function formatarTelefone(digitos: string): string {
  const d = digitos.replace(/\D/g, '');
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return digitos;
}
