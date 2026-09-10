import { Routes } from '@angular/router';
import { Chat } from './chat/chat';
import { Painel } from './painel/painel';

export const routes: Routes = [
  { path: '', component: Chat },
  { path: 'painel', component: Painel },
  { path: '**', redirectTo: '' },
];
