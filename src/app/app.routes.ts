import { Routes } from '@angular/router';
import { Cadastro } from './cadastro/cadastro';
import { Chat } from './chat/chat';
import { Entrar } from './entrar/entrar';
import { Painel } from './painel/painel';
import { PoliticaPrivacidade } from './privacidade/politica-privacidade';
import { entrarGuard, painelGuard, sessaoGuard } from './sessao/sessao-guard';

export const routes: Routes = [
  { path: '', component: Chat },
  { path: 'entrar', component: Entrar, canActivate: [entrarGuard] },
  { path: 'cadastro', component: Cadastro, data: { tipo: 'cliente' } },
  { path: 'seja-corretor', component: Cadastro, data: { tipo: 'corretor' } },
  { path: 'painel', component: Painel, canActivate: [painelGuard] },
  { path: 'painel/leads/:id', component: Painel, canActivate: [painelGuard] },
  {
    path: 'conta',
    loadComponent: () => import('./conta/conta').then(({ Conta }) => Conta),
    canActivate: [sessaoGuard],
  },
  { path: 'privacidade', component: PoliticaPrivacidade },
  { path: '**', redirectTo: '' },
];
