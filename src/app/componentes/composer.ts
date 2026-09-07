import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LIMITE_MENSAGEM } from '../conversa/contrato';

@Component({
  selector: 'app-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="barra">
      @if (motivo()) {
        <p class="motivo">{{ motivo() }}</p>
      }
      <div class="linha">
        <textarea
          #campo
          rows="1"
          [value]="texto()"
          [disabled]="!campoEditavel()"
          [attr.maxlength]="limite"
          placeholder="Escreva sua mensagem"
          aria-label="Escreva sua mensagem"
          (input)="aoDigitar($event)"
          (keydown.enter)="aoEnter($event)"
        ></textarea>
        <button
          type="button"
          class="enviar"
          [disabled]="!podeEnviar()"
          (click)="disparar()"
        >
          Enviar
        </button>
      </div>
    </div>
  `,
  styles: `
    .barra {
      padding: 18px 24px 22px;
      background: var(--superficie-barra);
      border-top: 1px solid var(--borda-estrutura);
    }

    .motivo {
      margin-bottom: 8px;
      font-size: 13px;
      line-height: 1.45;
      color: var(--texto-secundario);
    }

    .linha {
      display: flex;
      gap: 12px;
      align-items: flex-end;
      max-width: var(--coluna);
      margin: 0 auto;
    }

    textarea {
      flex: 1;
      min-height: 52px;
      max-height: 148px;
      padding: 14px 20px;
      border: 1px solid var(--borda-componente);
      border-radius: var(--raio-campo);
      background: var(--superficie-elevada);
      color: var(--texto-primario);
      font-family: inherit;
      font-size: 17px;
      line-height: 1.45;
      resize: none;
      overflow-y: auto;
    }

    textarea::placeholder {
      color: var(--texto-placeholder);
    }

    textarea:disabled {
      background: var(--inativo-fundo);
      border-color: var(--inativo-borda);
      color: var(--inativo-texto);
    }

    .enviar {
      flex: none;
      height: 52px;
      padding: 0 26px;
      border-radius: var(--raio-campo);
      border: 1px solid var(--marca);
      background: var(--marca);
      color: var(--marca-contraste);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }

    .enviar:disabled {
      background: var(--inativo-fundo);
      border-color: var(--inativo-borda);
      color: var(--inativo-texto);
      cursor: not-allowed;
    }

    @media (max-width: 640px) {
      textarea {
        min-height: 48px;
        font-size: 16px;
      }
      .enviar {
        height: 48px;
      }
    }
  `,
})
export class Composer {
  readonly envioDisponivel = input.required<boolean>();
  readonly campoEditavel = input.required<boolean>();
  readonly motivo = input<string | null>(null);
  readonly enviar = output<string>();

  protected readonly limite = LIMITE_MENSAGEM;
  protected readonly texto = signal('');

  private readonly campo = viewChild.required<ElementRef<HTMLTextAreaElement>>('campo');

  protected podeEnviar(): boolean {
    return this.envioDisponivel() && this.texto().trim().length > 0;
  }

  protected aoDigitar(evento: Event): void {
    const area = evento.target as HTMLTextAreaElement;
    this.texto.set(area.value);
    this.ajustarAltura(area);
  }

  protected aoEnter(evento: Event): void {
    const teclado = evento as KeyboardEvent;
    if (teclado.shiftKey || teclado.isComposing) {
      return;
    }
    evento.preventDefault();
    this.disparar();
  }

  protected disparar(): void {
    if (!this.podeEnviar()) {
      return;
    }
    this.enviar.emit(this.texto().trim());
    this.texto.set('');
    const area = this.campo().nativeElement;
    area.value = '';
    area.style.height = 'auto';
    area.focus();
  }

  private ajustarAltura(area: HTMLTextAreaElement): void {
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  }
}
