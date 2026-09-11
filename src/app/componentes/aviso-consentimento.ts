import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-aviso-consentimento',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="aviso">
      <div class="painel">
        <div class="cabeca">
          <span class="marca-estado"></span>
          <span class="rotulo">Antes de começar</span>
        </div>
        <p>
          Antes de começarmos: a Solar processa o que você me contar com um provedor de inteligência
          artificial — no free tier, esse provedor usa o conteúdo para treino — e, quando necessário,
          a Solar compartilha a conversa com um corretor humano.
        </p>
        <p>Consulte o <a routerLink="/privacidade">Aviso de Privacidade completo</a>.</p>
        <p>Não envie documentos, dados bancários ou informações sensíveis.</p>
      </div>

      <label class="consentir">
        <input type="checkbox" [checked]="marcado()" (change)="alternar($event)" />
        <span class="texto">
          Concordo com o processamento das minhas mensagens conforme descrito acima.
          <span class="nota">Necessário para iniciar a conversa.</span>
        </span>
      </label>

      <div class="acoes">
        <button
          type="button"
          class="primario"
          [disabled]="!marcado() || enviando()"
          (click)="aceitar.emit()"
        >
          {{ enviando() ? 'Registrando...' : 'Concordo e continuar' }}
        </button>
        <button type="button" class="secundario" [disabled]="enviando()" (click)="recusar.emit()">
          Não concordo
        </button>
      </div>
      @if (erro()) {
        <p class="erro" role="alert">{{ erro() }}</p>
      }
    </section>
  `,
  styles: `
    .aviso {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .painel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 24px 28px;
      background: var(--superficie-barra);
      border: 1px solid var(--borda-estrutura);
      border-radius: var(--raio-card);
    }

    .cabeca {
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .marca-estado {
      width: 8px;
      height: 8px;
      border-radius: var(--raio-marca-estado);
      background: var(--atencao);
    }

    .rotulo {
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--texto-secundario);
    }

    .painel p {
      font-size: 16px;
      line-height: 1.65;
      color: var(--texto-primario);
    }

    .consentir {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      cursor: pointer;
    }

    .consentir input {
      flex: none;
      width: 22px;
      height: 22px;
      margin: 2px 0 0;
      accent-color: var(--marca);
      cursor: pointer;
    }

    .texto {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 16px;
      line-height: 1.5;
      color: var(--texto-primario);
    }

    .nota {
      font-size: 13px;
      line-height: 1.45;
      color: var(--texto-secundario);
    }

    .acoes {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .acoes button {
      min-height: 52px;
      border-radius: var(--raio-campo);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }

    .primario {
      padding: 0 28px;
      background: var(--marca);
      border: 1px solid var(--marca);
      color: var(--marca-contraste);
    }

    .primario:disabled {
      background: var(--inativo-fundo);
      border-color: var(--inativo-borda);
      color: var(--inativo-texto);
      cursor: not-allowed;
    }

    .secundario {
      padding: 0 24px;
      background: var(--superficie-elevada);
      border: 1px solid var(--borda-componente);
      color: var(--texto-primario);
    }

    .erro {
      color: var(--erro);
      font-size: 14px;
      line-height: 1.45;
    }

    @media (max-width: 640px) {
      .painel {
        padding: 16px;
      }
      .painel p {
        font-size: 15px;
        line-height: 1.6;
      }
      .acoes button {
        min-height: 48px;
        flex: 1;
      }
    }
  `,
})
export class AvisoConsentimento {
  readonly enviando = input(false);
  readonly erro = input<string | null>(null);
  readonly aceitar = output<void>();
  readonly recusar = output<void>();

  protected readonly marcado = signal(false);

  protected alternar(evento: Event): void {
    this.marcado.set((evento.target as HTMLInputElement).checked);
  }
}
