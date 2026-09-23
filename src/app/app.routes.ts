import { Routes } from '@angular/router';
import { Chat } from './chat/chat';
import { Entrar } from './entrar/entrar';
import { Painel } from './painel/painel';
import { PoliticaPrivacidade } from './privacidade/politica-privacidade';
import { painelGuard } from './sessao/sessao-guard';

export const routes: Routes = [
  { path: '', component: Chat },
  { path: 'entrar', component: Entrar },
  { path: 'painel', component: Painel, canActivate: [painelGuard] },
  { path: 'painel/leads/:id', component: Painel, canActivate: [painelGuard] },
  { path: 'privacidade', component: PoliticaPrivacidade },
  { path: '**', redirectTo: '' },
];
