import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

@Component({
  selector: 'app-aviso-consentimento',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="aviso">
      <div class="painel">
        <div class="cabeca">
          <span class="marca-estado"></span>
          <span class="rotulo">Antes de começar</span>
        </div>
        <p>
          A Solar e seu provedor de inteligência artificial processarão as mensagens que você enviar
          para compreender sua busca, recomendar imóveis e, quando necessário, encaminhar a conversa
          para atendimento humano.
        </p>
        <p>
          Suas mensagens não são usadas pelo provedor para treinar ou melhorar modelos de
          inteligência artificial. Consulte a <a href="#politica-de-privacidade">Política de Privacidade</a>.
        </p>
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
        <button type="button" class="primario" [disabled]="!marcado()" (click)="aceitar.emit()">
          Concordo e continuar
        </button>
        <button type="button" class="secundario" (click)="recusar.emit()">Não concordo</button>
      </div>
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
  readonly aceitar = output<void>();
  readonly recusar = output<void>();

  protected readonly marcado = signal(false);

  protected alternar(evento: Event): void {
    this.marcado.set((evento.target as HTMLInputElement).checked);
  }
}
