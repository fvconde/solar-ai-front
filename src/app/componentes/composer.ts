import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LIMITE_MENSAGEM } from '../conversa/contrato';

@Component({
  selector: 'app-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="barra" [class.recolhida]="recolhido()">
      @if (!recolhido()) {
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
            placeholder="Mensagem"
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
      }
      <nav aria-label="Seus dados" class="rodape-dados">
        <a class="link-dados" routerLink="/privacidade">Como a Solar usa seus dados</a>
        @if (podeApagar()) {
          <span class="separador-dados" aria-hidden="true">·</span>
          <button
            class="link-dados botao-apagar"
            type="button"
            aria-haspopup="dialog"
            (click)="aoClicarApagar($event)"
          >
            Apagar conversa
          </button>
        }
      </nav>
    </div>
  `,
  styles: `
    .barra {
      padding: 18px 24px 6px;
      background: var(--superficie-barra);
      border-top: 1px solid var(--borda-estrutura);
    }

    .barra.recolhida {
      padding-top: 10px;
      padding-bottom: 10px;
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
      max-height: calc(2.9em + 30px);
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

    .rodape-dados {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 4px;
      max-width: var(--coluna);
      margin: 4px auto 0;
      font-size: 13px;
      line-height: 1.4;
      color: var(--texto-secundario);
    }

    .link-dados {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0 6px;
      color: var(--texto-secundario);
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }

    .link-dados:hover {
      color: var(--texto-primario);
    }

    .separador-dados {
      color: var(--texto-secundario);
    }

    .botao-apagar {
      border: 0;
      background: none;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }

    @media (max-width: 640px) {
      .barra {
        padding: 14px 16px 4px;
      }

      textarea {
        min-height: 48px;
        font-size: 16px;
      }

      .enviar {
        height: 48px;
      }

      .rodape-dados {
        gap: 2px;
      }

      .link-dados {
        min-height: 44px;
      }
    }
  `,
})
export class Composer {
  readonly envioDisponivel = input.required<boolean>();
  readonly campoEditavel = input.required<boolean>();
  readonly motivo = input<string | null>(null);
  readonly podeApagar = input<boolean>(false);
  readonly recolhido = input<boolean>(false);
  readonly enviar = output<string>();
  readonly apagar = output<HTMLElement>();

  protected readonly limite = LIMITE_MENSAGEM;
  protected readonly texto = signal('');

  private readonly campo = viewChild<ElementRef<HTMLTextAreaElement>>('campo');

  limpar(): void {
    this.texto.set('');
    const area = this.campo()?.nativeElement;
    if (area) {
      area.value = '';
      area.style.height = 'auto';
    }
  }

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

  protected aoClicarApagar(evento: MouseEvent): void {
    this.apagar.emit(evento.currentTarget as HTMLElement);
  }

  protected disparar(): void {
    if (!this.podeEnviar()) {
      return;
    }
    this.enviar.emit(this.texto().trim());
    this.texto.set('');
    const area = this.campo()?.nativeElement;
    if (area) {
      area.value = '';
      area.style.height = 'auto';
      area.focus();
    }
  }

  private ajustarAltura(area: HTMLTextAreaElement): void {
    area.style.height = 'auto';
    const estilos = getComputedStyle(area);
    const bordasVerticais =
      Number.parseFloat(estilos.borderTopWidth) + Number.parseFloat(estilos.borderBottomWidth);
    const alturaNecessaria = area.scrollHeight + bordasVerticais;
    const alturaMaxima = Number.parseFloat(estilos.maxHeight);

    area.style.height = `${Math.min(alturaNecessaria, alturaMaxima)}px`;
  }
}
