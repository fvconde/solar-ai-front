import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Saida } from '../sessao/saida';
import { SessaoStore } from '../sessao/sessao-store';

@Component({
  selector: 'app-menu-perfil',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: {
    '(document:click)': 'fecharSeFora($event)',
    '(document:keydown.escape)': 'fecharComEsc()',
  },
  template: `
    <button
      #gatilho
      class="gatilho"
      type="button"
      aria-haspopup="menu"
      aria-controls="menu-perfil"
      [attr.aria-expanded]="aberto()"
      [attr.aria-label]="'Menu da conta de ' + sessao.usuario()?.nome"
      (click)="alternar()"
      (keydown.arrowDown)="abrirPeloTeclado($event)"
    >
      <span class="nome-usuario">{{ sessao.primeiroNome() }}</span>
      <span class="avatar" [class.foco]="aberto()">{{ sessao.iniciais() }}</span>
    </button>

    @if (aberto()) {
      <div
        #menu
        id="menu-perfil"
        class="menu"
        role="menu"
        [attr.aria-label]="sessao.usuario()?.nome"
        (keydown)="navegar($event)"
      >
        <div class="cabecalho-menu">
          <b>{{ sessao.usuario()?.nome }}</b>
          <span>{{ descricao() }}</span>
        </div>
        <a class="item" role="menuitem" tabindex="-1" routerLink="/conta" (click)="fechar()"
          >Minha conta</a
        >
        <a class="item" role="menuitem" tabindex="-1" routerLink="/privacidade" (click)="fechar()"
          >Privacidade e dados</a
        >
        <button class="item sair" role="menuitem" tabindex="-1" type="button" (click)="sair()">
          Sair
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      padding-left: 20px;
      border-left: 1px solid var(--borda-estrutura);
    }

    .gatilho {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0;
      background: none;
      border: none;
      cursor: pointer;
    }

    .nome-usuario {
      font-size: 14px;
      font-weight: 500;
      color: var(--texto-primario);
      white-space: nowrap;
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      flex: none;
      border-radius: 50%;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--marca);
      background: color-mix(in srgb, var(--marca) 14%, var(--superficie-elevada));

      &.foco {
        outline: 2px solid var(--marca);
        outline-offset: 2px;
      }
    }

    .menu {
      position: absolute;
      right: 0;
      top: calc(100% + 12px);
      z-index: 30;
      width: 240px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      background: var(--superficie-elevada);
      border: 1px solid var(--borda-componente);
      border-radius: 10px;
    }

    .cabecalho-menu {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px 10px;
      margin-bottom: 4px;
      border-bottom: 1px solid var(--borda-estrutura);

      b {
        font-size: 14px;
        font-weight: 600;
        color: var(--texto-primario);
      }

      span {
        font-size: 12.5px;
        color: var(--texto-secundario);
        overflow-wrap: anywhere;
      }
    }

    .item {
      display: block;
      width: 100%;
      padding: 9px 12px;
      border: none;
      border-radius: 6px;
      background: none;
      text-align: left;
      font-size: 14px;
      color: var(--texto-primario);
      cursor: pointer;

      &:hover,
      &:focus-visible {
        background: var(--inativo-fundo);
        outline: none;
      }

      &.sair {
        color: var(--erro);
      }
    }

    @media (max-width: 640px) {
      :host {
        padding-left: 0;
        border-left: none;
      }

      .nome-usuario {
        display: none;
      }
    }
  `,
})
export class MenuPerfil {
  protected readonly sessao = inject(SessaoStore);
  private readonly saida = inject(Saida);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly gatilho = viewChild.required<ElementRef<HTMLButtonElement>>('gatilho');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  readonly aberto = signal(false);

  readonly descricao = computed(() => {
    switch (this.sessao.perfil()) {
      case 'cliente':
        return this.sessao.usuario()?.email ?? '';
      case 'supervisor':
        return 'Supervisor';
      default:
        return this.sessao.emAnalise() ? 'Corretor · em análise' : 'Corretor · aprovado';
    }
  });

  alternar(): void {
    if (this.aberto()) {
      this.fechar();
      return;
    }
    this.aberto.set(true);
    setTimeout(() => this.focarItem(0));
  }

  abrirPeloTeclado(evento: Event): void {
    evento.preventDefault();
    this.aberto.set(true);
    setTimeout(() => this.focarItem(0));
  }

  fechar(): void {
    this.aberto.set(false);
  }

  fecharComEsc(): void {
    if (this.aberto()) {
      this.fechar();
      this.gatilho().nativeElement.focus();
    }
  }

  fecharSeFora(evento: MouseEvent): void {
    if (this.aberto() && !this.host.nativeElement.contains(evento.target as Node)) {
      this.fechar();
    }
  }

  navegar(evento: KeyboardEvent): void {
    const itens = this.itens();
    const atual = itens.indexOf(document.activeElement as HTMLElement);
    const alvo: Record<string, number> = {
      ArrowDown: (atual + 1) % itens.length,
      ArrowUp: (atual - 1 + itens.length) % itens.length,
      Home: 0,
      End: itens.length - 1,
    };

    if (evento.key in alvo) {
      evento.preventDefault();
      this.focarItem(alvo[evento.key]);
    } else if (evento.key === 'Tab') {
      this.fechar();
    }
  }

  sair(): void {
    this.fechar();
    this.saida.sair();
  }

  private itens(): HTMLElement[] {
    return Array.from(
      this.menu()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  }

  private focarItem(indice: number): void {
    this.itens()[indice]?.focus();
  }
}
