import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessaoStore } from '../sessao/sessao-store';

@Component({
  selector: 'app-cabecalho',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header>
      @if (painelComSessao()) {
        <div class="lado-esquerdo">
          <a routerLink="/" class="marca-link"><span class="marca">SOLAR</span></a>
          <span class="identificacao">Painel</span>
        </div>
        <div class="lado-direito">
          <nav class="navegacao">
            <a routerLink="/" class="link-nav">Chat</a>
          </nav>
          <div class="bloco-usuario">
            <span class="nome-usuario">{{ usuarioNome() }}</span>
            <span class="perfil-usuario">{{ perfilRotulo() }}</span>
          </div>
        </div>
      } @else {
        <div class="lado-esquerdo">
          <a routerLink="/" class="marca-link"><span class="marca">SOLAR</span></a>
          <span class="identificacao">Lia · assistente de IA</span>
        </div>
        <nav class="navegacao">
          <a routerLink="/" class="link-nav" [class.ativo]="chatAtivo()">Chat</a>
          <a routerLink="/painel" class="link-nav" [class.ativo]="painelAtivo()"
            >Painel do Corretor</a
          >
        </nav>
      }
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

    .lado-direito {
      display: flex;
      align-items: baseline;
      gap: 24px;
    }

    .bloco-usuario {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }

    .nome-usuario {
      font-size: 15px;
      font-weight: 500;
      color: var(--texto-primario);
    }

    .perfil-usuario {
      font-size: 12.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--texto-secundario);
    }

    .navegacao {
      display: flex;
      align-items: baseline;
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
      .lado-direito {
        width: 100%;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }
    }
  `,
})
export class Cabecalho {
  private readonly router = inject(Router);
  private readonly sessao = inject(SessaoStore);

  private readonly urlAtual = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly rotaAtual = computed(() => this.urlAtual().split('?')[0]);

  readonly painelAtivo = computed(() => {
    const rota = this.rotaAtual();
    return rota.startsWith('/painel') || rota.startsWith('/entrar');
  });

  readonly chatAtivo = computed(() => !this.painelAtivo());

  readonly sessaoAtiva = computed(() => this.sessao.corretor() !== null);
  readonly painelComSessao = computed(() => this.painelAtivo() && this.sessaoAtiva());
  readonly usuarioNome = computed(() => this.sessao.corretor()?.nome ?? '');
  readonly perfilRotulo = computed(() => {
    const p = this.sessao.perfil();
    if (p === 'supervisor') {
      return this.sessao.vinculoAtivo()
        ? 'Supervisor · carteira própria'
        : 'Supervisor · sem carteira';
    }
    return 'Corretor';
  });
}
