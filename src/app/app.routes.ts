import { Routes } from '@angular/router';
import { Chat } from './chat/chat';
import { Painel } from './painel/painel';
import { PoliticaPrivacidade } from './privacidade/politica-privacidade';

export const routes: Routes = [
  { path: '', component: Chat },
  { path: 'painel', component: Painel },
  { path: 'privacidade', component: PoliticaPrivacidade },
  { path: '**', redirectTo: '' },
];
