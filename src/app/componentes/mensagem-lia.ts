import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { ImovelSugerido } from '../conversa/contrato';
import { CardImovel } from './card-imovel';

const VEU_MS_POR_CARACTERE = 13;
const VEU_MINIMO_MS = 900;
const VEU_MAXIMO_MS = 2800;
const CARTAO_APOS_VEU_MS = 420;
const CARTAO_ENTRE_MS = 240;

@Component({
  selector: 'app-mensagem-lia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardImovel],
  template: `
    <div class="turno">
      <div class="autoria">
        <span class="rotulo">Lia</span>
        <span class="hora">{{ hora() }}</span>
      </div>
      <p
        class="fala"
        [class.sob-veu]="sobVeu()"
        [style.animation-duration]="duracaoVeu() + 'ms'"
        (animationend)="encerrarVeu()"
      >
        {{ texto() }}
      </p>
      @if (imoveis().length) {
        <div class="pilha">
          @for (imovel of imoveis().slice(0, 3); track imovel.id; let i = $index) {
            <app-card-imovel
              class="cartao"
              [class.entrando]="revelar()"
              [style.animation-delay]="atrasoDoCartao(i) + 'ms'"
              [imovel]="imovel"
              [intencao]="intencao()"
            />
          }
        </div>
      }
    </div>
  `,
  styles: `
    .turno {
      display: flex;
      flex-direction: column;
      max-width: 640px;
    }

    .autoria {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rotulo {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--marca);
    }

    .hora {
      font-size: 13px;
      color: var(--texto-secundario);
      font-variant-numeric: tabular-nums;
    }

    .fala {
      margin-top: 8px;
      line-height: 1.6;
      color: var(--texto-primario);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .fala.sob-veu {
      -webkit-mask-image: linear-gradient(
        180deg,
        #000 0%,
        #000 24%,
        rgb(0 0 0 / 0.35) 38%,
        rgb(0 0 0 / 0) 54%
      );
      mask-image: linear-gradient(
        180deg,
        #000 0%,
        #000 24%,
        rgb(0 0 0 / 0.35) 38%,
        rgb(0 0 0 / 0) 54%
      );
      -webkit-mask-size: 100% 420%;
      mask-size: 100% 420%;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      animation-name: liaVeu;
      animation-timing-function: ease-out;
      animation-fill-mode: both;
    }

    @keyframes liaVeu {
      from {
        -webkit-mask-position: 0% 100%;
        mask-position: 0% 100%;
      }
      to {
        -webkit-mask-position: 0% 0%;
        mask-position: 0% 0%;
      }
    }

    .pilha {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 8px;
    }

    .cartao.entrando {
      animation-name: liaCartao;
      animation-duration: 260ms;
      animation-timing-function: ease-out;
      animation-fill-mode: both;
    }

    @keyframes liaCartao {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fala.sob-veu {
        -webkit-mask-image: none;
        mask-image: none;
        animation: none;
      }

      .cartao.entrando {
        animation: none;
      }
    }

    @media (max-width: 640px) {
      .rotulo {
        font-size: 11.5px;
      }
      .hora {
        font-size: 12.5px;
      }
    }
  `,
})
export class MensagemLia {
  readonly texto = input.required<string>();
  readonly hora = input.required<string>();
  readonly imoveis = input<ImovelSugerido[]>([]);
  readonly intencao = input<string | null>(null);
  readonly revelar = input(false);

  protected readonly duracaoVeu = computed(() =>
    Math.min(VEU_MAXIMO_MS, Math.max(VEU_MINIMO_MS, this.texto().length * VEU_MS_POR_CARACTERE)),
  );

  protected readonly sobVeu = linkedSignal(() => this.revelar());

  protected encerrarVeu(): void {
    this.sobVeu.set(false);
  }

  protected atrasoDoCartao(indice: number): number {
    return this.duracaoVeu() + CARTAO_APOS_VEU_MS + indice * CARTAO_ENTRE_MS;
  }
}
