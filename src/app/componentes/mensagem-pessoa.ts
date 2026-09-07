import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-mensagem-pessoa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="turno">
      <div class="bolha">{{ texto() }}</div>
      <span class="hora">{{ hora() }}</span>
    </div>
  `,
  styles: `
    .turno {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }

    .bolha {
      max-width: 480px;
      padding: 15px 20px;
      border-radius: var(--raio-bolha) var(--raio-bolha) 6px var(--raio-bolha);
      background: var(--superficie-elevada);
      border: 1px solid var(--borda-componente);
      color: var(--texto-primario);
      line-height: 1.55;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .hora {
      font-size: 13px;
      color: var(--texto-secundario);
      font-variant-numeric: tabular-nums;
    }

    @media (max-width: 640px) {
      .bolha {
        max-width: 330px;
        padding: 14px 16px;
      }
      .hora {
        font-size: 12.5px;
      }
    }
  `,
})
export class MensagemPessoa {
  readonly texto = input.required<string>();
  readonly hora = input.required<string>();
}
