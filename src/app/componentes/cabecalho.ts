import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-cabecalho',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <span class="marca">SOLAR</span>
      <span class="identificacao">Lia · assistente de IA</span>
    </header>
  `,
  styles: `
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 40px;
      background: var(--superficie-barra);
      border-bottom: 1px solid var(--borda-estrutura);
    }

    .marca {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.2em;
      color: var(--marca);
    }

    .identificacao {
      font-size: 13px;
      line-height: 1.3;
      color: var(--texto-secundario);
    }

    @media (max-width: 640px) {
      header {
        padding: 14px 20px;
      }
      .marca {
        font-size: 13px;
        letter-spacing: 0.18em;
      }
    }
  `,
})
export class Cabecalho {}
