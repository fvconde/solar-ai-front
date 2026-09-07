import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-divisor-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="divisor">
      <span class="regua"></span>
      <span class="rotulo">{{ rotulo() }}</span>
      <span class="regua"></span>
    </div>
  `,
  styles: `
    .divisor {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .regua {
      flex: 1;
      height: 1px;
      background: var(--borda-estrutura);
    }

    .rotulo {
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--texto-secundario);
    }
  `,
})
export class DivisorData {
  readonly rotulo = input.required<string>();
}
