import { SessaoResponse } from './sessao-contrato';

export const TEMAS = ['claro', 'escuro'] as const;

export function aplicarTema(tema: (typeof TEMAS)[number]): void {
  document.documentElement.setAttribute('data-tema', tema);
  const semTransicao = document.createElement('style');
  semTransicao.id = 'tema-sem-transicao';
  semTransicao.textContent = '* { transition: none !important; }';
  document.head.appendChild(semTransicao);
}

export function limparTema(): void {
  document.documentElement.removeAttribute('data-tema');
  document.getElementById('tema-sem-transicao')?.remove();
}

export const MARCA_POR_TEMA = {
  claro: 'rgb(162, 69, 42)',
  escuro: 'rgb(224, 133, 95)',
} as const;

export function sessaoCliente(extra: Partial<SessaoResponse> = {}): SessaoResponse {
  return {
    usuario: { id: 'u-cliente', nome: 'Marina Couto', email: 'marina.couto@email.com' },
    perfil: 'cliente',
    statusCorretor: null,
    corretorId: null,
    vinculoAtivo: false,
    filtrosPermitidos: [],
    filtroInicial: null,
    pendentesAprovacao: null,
    ...extra,
  };
}

export function sessaoCorretor(
  status: 'em_analise' | 'aprovado',
  extra: Partial<SessaoResponse> = {},
): SessaoResponse {
  return {
    usuario: { id: 'u-corretor', nome: 'Rafael Nunes', email: 'rafael@imob.com' },
    perfil: 'corretor',
    statusCorretor: status,
    corretorId: 'c-201',
    vinculoAtivo: true,
    filtrosPermitidos: ['meus_leads'],
    filtroInicial: 'meus_leads',
    pendentesAprovacao: null,
    ...extra,
  };
}

export function sessaoSupervisor(
  pendentes = 2,
  extra: Partial<SessaoResponse> = {},
): SessaoResponse {
  return {
    usuario: { id: 'u-supervisor', nome: 'Helena Soares', email: 'helena@solar.com.br' },
    perfil: 'supervisor',
    statusCorretor: 'aprovado',
    corretorId: null,
    vinculoAtivo: false,
    filtrosPermitidos: ['sem_corretor', 'visao_geral'],
    filtroInicial: 'sem_corretor',
    pendentesAprovacao: pendentes,
    ...extra,
  };
}
