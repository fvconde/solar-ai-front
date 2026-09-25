import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessaoStore } from '../sessao/sessao-store';
import { MenuPerfil } from './menu-perfil';

@Component({
  selector: 'app-cabecalho',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MenuPerfil, RouterLink],
  template: `
    <header>
      <div class="linha">
        <div class="lado-esquerdo">
          <a routerLink="/" class="marca-link"><span class="marca">SOLAR</span></a>
          <span class="identificacao">{{ identificacao() }}</span>
        </div>
        <div class="lado-direito">
          <nav class="navegacao" aria-label="Principal">
            <a
              routerLink="/"
              class="link-nav"
              [class.ativo]="chatAtivo()"
              [attr.aria-current]="chatAtivo() ? 'page' : null"
              >Chat</a
            >
            @if (sessao.temPainel()) {
              <a
                routerLink="/painel"
                class="link-nav"
                [class.ativo]="painelAtivo()"
                [attr.aria-current]="painelAtivo() ? 'page' : null"
                >Painel do Corretor
                @if (selo(); as s) {
                  <span class="selo" [class.neutro]="s.neutro">{{ s.texto }}</span>
                }
              </a>
            }
          </nav>
          @if (sessao.ativa()) {
            <app-menu-perfil />
          } @else {
            <a routerLink="/entrar" class="pilula-entrar">Entrar</a>
          }
        </div>
      </div>
      @if (sessao.temPainel()) {
        <nav class="abas" aria-label="Páginas">
          <a routerLink="/" class="aba" [class.ativo]="chatAtivo()">Chat</a>
          <a routerLink="/painel" class="aba" [class.ativo]="painelAtivo()"
            >Painel
            @if (selo(); as s) {
              <span class="selo" [class.neutro]="s.neutro">{{ s.curto }}</span>
            }
          </a>
        </nav>
      }
    </header>
  `,
  styles: `
    header {
      background: var(--superficie-barra);
      border-bottom: 1px solid var(--borda-estrutura);
    }

    .linha {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 64px;
      padding: 10px 40px;
    }

    .lado-esquerdo {
      display: flex;
      align-items: baseline;
      gap: 12px;
      min-width: 0;
    }

    .marca-link,
    .link-nav,
    .pilula-entrar,
    .aba {
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
      white-space: nowrap;
    }

    .lado-direito,
    .navegacao {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .link-nav {
      font-size: 14px;
      color: var(--texto-secundario);
      border-bottom: 2px solid transparent;
      padding: 4px 0;
      white-space: nowrap;
      transition: color 0.15s ease;

      &:hover {
        color: var(--texto-primario);
        border-bottom-color: transparent;
      }

      &.ativo {
        color: var(--marca);
        border-bottom-color: var(--marca);
        font-weight: 600;
      }
    }

    .selo {
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 3px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      vertical-align: 1px;
      color: var(--atencao);
      background: color-mix(in srgb, var(--atencao) 14%, var(--superficie-elevada));

      &.neutro {
        color: var(--marca);
        background: color-mix(in srgb, var(--marca) 14%, var(--superficie-elevada));
      }
    }

    .pilula-entrar {
      padding: 7px 18px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      color: var(--marca-contraste);
      background: var(--marca);

      &:hover {
        background: color-mix(in srgb, var(--marca) 86%, var(--texto-primario));
      }
    }

    .abas {
      display: none;
    }

    @media (max-width: 640px) {
      .linha {
        min-height: 56px;
        padding: 8px 20px;
        gap: 8px;
      }

      .lado-esquerdo,
      .lado-direito {
        gap: 8px;
      }

      .lado-direito {
        flex-shrink: 0;
      }

      .identificacao {
        display: inline;
        font-size: 12px;
      }

      .navegacao {
        display: none;
      }

      .abas {
        display: flex;
        border-top: 1px solid var(--borda-estrutura);
      }

      .aba {
        flex: 1;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: var(--texto-secundario);
        border-bottom: 2px solid transparent;

        &.ativo {
          color: var(--marca);
          border-bottom-color: var(--marca);
          font-weight: 600;
        }
      }
    }
  `,
})
export class Cabecalho {
  private readonly router = inject(Router);
  protected readonly sessao = inject(SessaoStore);

  private readonly urlAtual = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly rotaAtual = computed(() => this.urlAtual().split(/[?#]/)[0]);

  readonly painelAtivo = computed(() => this.rotaAtual().startsWith('/painel'));
  readonly chatAtivo = computed(() => {
    const rota = this.rotaAtual();
    return rota === '/' || rota === '' || rota.startsWith('/privacidade');
  });

  readonly identificacao = computed(() =>
    this.painelAtivo() ? 'Painel' : 'Lia · assistente de IA',
  );

  readonly selo = computed(() => {
    if (this.sessao.emAnalise()) {
      return { texto: 'em análise', curto: 'análise', neutro: false };
    }
    const pendentes = this.sessao.perfil() === 'supervisor' ? this.sessao.pendentesAprovacao() : 0;
    if (pendentes) {
      const texto = pendentes === 1 ? '1 novo' : `${pendentes} novos`;
      return { texto, curto: texto, neutro: true };
    }
    return null;
  });
}
