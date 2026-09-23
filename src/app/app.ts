import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AvisoFlutuante } from './componentes/aviso-flutuante';
import { Cabecalho } from './componentes/cabecalho';
import { SessaoStore } from './sessao/sessao-store';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvisoFlutuante, Cabecalho, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    inject(SessaoStore).restaurar().subscribe();
  }
}
