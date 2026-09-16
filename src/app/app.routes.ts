import { Routes } from '@angular/router';
import { Chat } from './chat/chat';
import { Entrar } from './entrar/entrar';
import { Painel } from './painel/painel';
import { PoliticaPrivacidade } from './privacidade/politica-privacidade';
import { sessaoGuard } from './sessao/sessao-guard';

export const routes: Routes = [
  { path: '', component: Chat },
  { path: 'entrar', component: Entrar },
  { path: 'painel', component: Painel, canActivate: [sessaoGuard] },
  { path: 'painel/leads/:id', component: Painel, canActivate: [sessaoGuard] },
  { path: 'privacidade', component: PoliticaPrivacidade },
  { path: '**', redirectTo: '' },
];
