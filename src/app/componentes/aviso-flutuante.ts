import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';

const DURACAO_AVISO_MS = 5000;

@Injectable({ providedIn: 'root' })
export class Avisos {
  readonly atual = signal<string | null>(null);
  private cronometro: ReturnType<typeof setTimeout> | undefined;

  mostrar(texto: string): void {
    clearTimeout(this.cronometro);
    this.atual.set(texto);
    this.cronometro = setTimeout(() => this.atual.set(null), DURACAO_AVISO_MS);
  }

  fechar(): void {
    clearTimeout(this.cronometro);
    this.atual.set(null);
  }
}

@Component({
  selector: 'app-aviso-flutuante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="regiao" role="status" aria-live="polite">
      @if (avisos.atual(); as texto) {
        <p class="aviso">{{ texto }}</p>
      }
    </div>
  `,
  styles: `
    .regiao {
      position: fixed;
      left: 50%;
      bottom: 96px;
      transform: translateX(-50%);
      z-index: 20;
      pointer-events: none;
    }

    .aviso {
      padding: 9px 18px;
      border-radius: 999px;
      border: 1px solid var(--borda-componente);
      background: var(--texto-primario);
      color: var(--fundo-conversa);
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      .regiao {
        bottom: 88px;
      }

      .aviso {
        white-space: normal;
        text-align: center;
      }
    }
  `,
})
export class AvisoFlutuante {
  protected readonly avisos = inject(Avisos);
}
