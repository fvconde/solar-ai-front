import { DOCUMENT } from '@angular/common';
import {
  afterEveryRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  Injectable,
  signal,
} from '@angular/core';

const DURACAO_AVISO_MS = 5000;
const ESPACO_COMPOSER_PX = 12;

@Injectable({ providedIn: 'root' })
export class Avisos {
  readonly atual = signal<string | null>(null);
  readonly alinhamento = signal<'centro' | 'composer'>('centro');
  private cronometro: ReturnType<typeof setTimeout> | undefined;

  mostrar(texto: string, alinhamento: 'centro' | 'composer' = 'centro'): void {
    clearTimeout(this.cronometro);
    this.alinhamento.set(alinhamento);
    this.atual.set(texto);
    this.cronometro = setTimeout(() => {
      this.atual.set(null);
      this.alinhamento.set('centro');
    }, DURACAO_AVISO_MS);
  }

  fechar(): void {
    clearTimeout(this.cronometro);
    this.atual.set(null);
    this.alinhamento.set('centro');
  }
}

@Component({
  selector: 'app-aviso-flutuante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="regiao"
      [class.ancorada]="avisos.alinhamento() === 'composer' && coordenadas() !== null"
      [style.left.px]="avisos.alinhamento() === 'composer' ? coordenadas()?.left ?? null : null"
      [style.bottom.px]="avisos.alinhamento() === 'composer' ? coordenadas()?.bottom ?? null : null"
      role="status"
      aria-live="polite"
    >
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

    .regiao.ancorada .aviso {
      max-width: calc(100vw - 32px);
      margin: 0;
      white-space: normal;
      text-align: center;
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
  protected readonly coordenadas = signal<{ left: number; bottom: number } | null>(null);
  private readonly documento = inject(DOCUMENT);

  constructor() {
    afterEveryRender(() => this.atualizarPosicao());
  }

  @HostListener('window:resize')
  protected atualizarPosicao(): void {
    if (this.avisos.alinhamento() !== 'composer') {
      return;
    }

    const campo = this.documento.querySelector<HTMLElement>(
      'app-chat app-composer textarea[aria-label="Escreva sua mensagem"]',
    );
    if (!campo) {
      if (this.coordenadas() !== null) {
        this.coordenadas.set(null);
      }
      return;
    }

    const retangulo = campo.getBoundingClientRect();
    const alturaViewport = this.documento.defaultView?.innerHeight ?? 0;
    const novasCoordenadas = {
      left: retangulo.left + retangulo.width / 2,
      bottom: Math.max(0, alturaViewport - retangulo.top + ESPACO_COMPOSER_PX),
    };
    const atuais = this.coordenadas();
    if (
      atuais === null ||
      Math.abs(atuais.left - novasCoordenadas.left) > 0.5 ||
      Math.abs(atuais.bottom - novasCoordenadas.bottom) > 0.5
    ) {
      this.coordenadas.set(novasCoordenadas);
    }
  }
}
