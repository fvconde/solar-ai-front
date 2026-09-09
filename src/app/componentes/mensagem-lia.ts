import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ImovelSugerido } from '../conversa/contrato';
import { CardImovel } from './card-imovel';

@Component({
  selector: 'app-mensagem-lia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardImovel],
  template: `
    <div class="turno">
      <div class="autoria">
        <span class="rotulo">Lia</span>
        <span class="hora">{{ hora() }}</span>
      </div>
      <p class="fala">{{ texto() }}</p>
      @if (imoveis().length) {
        <div class="pilha">
          @for (imovel of imoveis().slice(0, 3); track imovel.id) {
            <app-card-imovel [imovel]="imovel" [intencao]="intencao()" />
          }
        </div>
      }
    </div>
  `,
  styles: `
    .turno {
      display: flex;
      flex-direction: column;
      max-width: 640px;
    }

    .autoria {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rotulo {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--marca);
    }

    .hora {
      font-size: 13px;
      color: var(--texto-secundario);
      font-variant-numeric: tabular-nums;
    }

    .fala {
      margin-top: 8px;
      line-height: 1.6;
      color: var(--texto-primario);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .pilha {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 8px;
    }

    @media (max-width: 640px) {
      .rotulo {
        font-size: 11.5px;
      }
      .hora {
        font-size: 12.5px;
      }
    }
  `,
})
export class MensagemLia {
  readonly texto = input.required<string>();
  readonly hora = input.required<string>();
  readonly imoveis = input<ImovelSugerido[]>([]);
  readonly intencao = input<string | null>(null);
}
