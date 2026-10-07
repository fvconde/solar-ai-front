import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AcaoEvento, VarianteEvento } from '../conversa/trilha';

@Component({
  selector: 'app-evento-sistema',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (compacto()) {
      <div class="evento-compacto">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="icone-check"
          aria-hidden="true"
        >
          <path d="M3 8.5l3 3 7-7"></path>
        </svg>
        <span>{{ rotulo() }} · {{ texto() }}</span>
      </div>
    } @else {
      <div class="evento">
        <span class="regua"></span>
        <div class="cabeca">
          <span class="marca-estado" [attr.data-variante]="variante()"></span>
          <span class="rotulo">{{ rotulo() }}</span>
        </div>
        <p class="texto">{{ texto() }}</p>
        @if (acao(); as botao) {
          <button type="button" class="acao" (click)="acionar.emit(botao)">{{ botao.rotulo }}</button>
        }
      </div>
    }
  `,
  styles: `
    .evento-compacto {
      display: flex;
      align-items: center;
      justify-content: center;
      align-self: center;
      gap: 6px;
      max-width: 560px;
      width: 100%;
      box-sizing: border-box;
      text-align: center;
      font-size: 12px;
      font-weight: 500;
      color: var(--sucesso);
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .icone-check {
      flex: none;
    }

    .evento {
      display: flex;
      flex-direction: column;
      max-width: 560px;
    }

    .regua {
      width: 100%;
      height: 1px;
      background: var(--borda-estrutura);
    }

    .cabeca {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-top: 16px;
    }

    .marca-estado {
      width: 8px;
      height: 8px;
      border-radius: var(--raio-marca-estado);
      background: var(--neutro);
    }

    .marca-estado[data-variante='sucesso'] {
      background: var(--sucesso);
    }
    .marca-estado[data-variante='atencao'] {
      background: var(--atencao);
    }
    .marca-estado[data-variante='erro'] {
      background: var(--erro);
    }

    .rotulo {
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--texto-secundario);
    }

    .texto {
      margin-top: 9px;
      font-size: 15.5px;
      line-height: 1.55;
      color: var(--texto-primario);
    }

    .acao {
      align-self: flex-start;
      margin-top: 4px;
      min-height: 44px;
      padding: 0 20px;
      border-radius: var(--raio-acao-evento);
      border: 1px solid var(--borda-componente);
      background: var(--superficie-elevada);
      color: var(--texto-primario);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
  `,
})
export class EventoSistema {
  readonly variante = input.required<VarianteEvento>();
  readonly rotulo = input.required<string>();
  readonly texto = input.required<string>();
  readonly acao = input<AcaoEvento | null>(null);
  readonly compacto = input<boolean>(false);
  readonly acionar = output<AcaoEvento>();
}
