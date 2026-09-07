import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-indicador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="indicador" role="status">
      <span class="pontos" aria-hidden="true">
        <span data-ponto></span>
        <span data-ponto></span>
        <span data-ponto></span>
      </span>
      <span class="frase">{{
        prolongada() ? 'Isso está levando um pouco mais de tempo' : 'Lia está preparando uma resposta'
      }}</span>
    </div>
  `,
  styles: `
    .indicador {
      min-height: 28px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .pontos {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    [data-ponto] {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--marca);
      display: block;
      animation: liaRespira 2.6s ease-in-out infinite;
    }

    [data-ponto]:nth-child(2) {
      animation-delay: 0.4s;
    }

    [data-ponto]:nth-child(3) {
      animation-delay: 0.8s;
    }

    .frase {
      font-size: 16px;
      line-height: 1.5;
      color: var(--texto-secundario);
    }
  `,
})
export class Indicador {
  readonly prolongada = input(false);
}
