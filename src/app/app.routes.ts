import { Routes } from '@angular/router';
import { Cadastro } from './cadastro/cadastro';
import { Chat } from './chat/chat';
import { Conta } from './conta/conta';
import { Entrar } from './entrar/entrar';
import { Painel } from './painel/painel';
import { PoliticaPrivacidade } from './privacidade/politica-privacidade';
import { painelGuard, sessaoGuard } from './sessao/sessao-guard';

export const routes: Routes = [
  { path: '', component: Chat },
  { path: 'entrar', component: Entrar },
  { path: 'cadastro', component: Cadastro, data: { tipo: 'cliente' } },
  { path: 'seja-corretor', component: Cadastro, data: { tipo: 'corretor' } },
  { path: 'painel', component: Painel, canActivate: [painelGuard] },
  { path: 'painel/leads/:id', component: Painel, canActivate: [painelGuard] },
  { path: 'conta', component: Conta, canActivate: [sessaoGuard] },
  { path: 'privacidade', component: PoliticaPrivacidade },
  { path: '**', redirectTo: '' },
];
