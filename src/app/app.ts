import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { AvisoConsentimento } from './componentes/aviso-consentimento';
import { Cabecalho } from './componentes/cabecalho';
import { Composer } from './componentes/composer';
import { DivisorData } from './componentes/divisor-data';
import { EventoSistema } from './componentes/evento-sistema';
import { Indicador } from './componentes/indicador';
import { MensagemLia } from './componentes/mensagem-lia';
import { MensagemPessoa } from './componentes/mensagem-pessoa';
import { ConversaStore } from './conversa/conversa-store';
import { AcaoEvento } from './conversa/trilha';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Cabecalho,
    AvisoConsentimento,
    DivisorData,
    MensagemLia,
    MensagemPessoa,
    EventoSistema,
    Indicador,
    Composer,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly store = inject(ConversaStore);

  private readonly palco = viewChild.required<ElementRef<HTMLElement>>('palco');

  constructor() {
    afterRenderEffect(() => {
      this.store.itens();
      this.store.estado();
      const elemento = this.palco().nativeElement;
      elemento.scrollTop = elemento.scrollHeight;
    });
  }

  ngOnInit(): void {
    void this.store.iniciar();
  }

  protected atender(acao: AcaoEvento): void {
    this.store.atenderAcao(acao);
  }

  protected enviar(texto: string): void {
    void this.store.enviar(texto);
  }
}
