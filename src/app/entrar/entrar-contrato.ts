import { SessaoResponse } from '../sessao/sessao-contrato';

export interface RecuperacaoResposta {
  email: string;
}

export type TelaEntrar = 'entrar' | 'recuperar' | 'link-enviado' | 'nova-senha' | 'link-invalido';

export const MINIMO_CARACTERES_SENHA = 8;
export const SEGUNDOS_DE_BLOQUEIO = 30;
export const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function destinoDe(sessao: SessaoResponse): string[] {
  return sessao.perfil === 'cliente' ? ['/'] : ['/painel'];
}
