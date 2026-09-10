import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-cabecalho',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header>
      <div class="lado-esquerdo">
        <a routerLink="/" class="marca-link"><span class="marca">SOLAR</span></a>
        <span class="identificacao">Lia · assistente de IA</span>
      </div>
      <nav class="navegacao">
        <a routerLink="/" routerLinkActive="ativo" [routerLinkActiveOptions]="{ exact: true }" class="link-nav">Chat</a>
        <a routerLink="/painel" routerLinkActive="ativo" class="link-nav">Painel do Corretor</a>
      </nav>
    </header>
  `,
  styles: `
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 40px;
      background: var(--superficie-barra);
      border-bottom: 1px solid var(--borda-estrutura);
    }

    .lado-esquerdo {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }

    .marca-link {
      text-decoration: none;
      border-bottom: none;
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

    .navegacao {
      display: flex;
      gap: 16px;
    }

    .link-nav {
      font-size: 14px;
      color: var(--texto-secundario);
      text-decoration: none;
      border-bottom: 2px solid transparent;
      padding-bottom: 4px;
      transition: all 0.15s ease;

      &:hover {
        color: var(--texto-primario);
      }

      &.ativo {
        color: var(--marca);
        border-bottom-color: var(--marca);
        font-weight: 600;
      }
    }

    @media (max-width: 640px) {
      header {
        padding: 12px 20px;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .marca {
        font-size: 13px;
        letter-spacing: 0.18em;
      }
      .navegacao {
        gap: 12px;
      }
    }
  `,
})
export class Cabecalho {}
