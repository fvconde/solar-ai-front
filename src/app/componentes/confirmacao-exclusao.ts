import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-confirmacao-exclusao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="dialog-confirmacao"
      (click)="aoClicarDialog($event)"
      (cancel)="aoCancelarDialog($event)"
      (keydown)="aoTeclarDialog($event)"
    >
      @if (aberto()) {
        <div
          #painel
          class="painel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="apagar-titulo"
          aria-describedby="apagar-texto"
          [attr.aria-busy]="apagando()"
        >
          <h2 id="apagar-titulo" class="titulo">Apagar esta conversa?</h2>
          <p id="apagar-texto" class="texto">
            Esta conversa e suas mensagens serão apagadas definitivamente. Não é possível desfazer.
          </p>

          @if (erroTentativa(); as tipoErro) {
            <div role="alert" class="alerta-erro">
              <span aria-hidden="true" class="marca-erro"></span>
              <p class="texto-erro">
                @if (tipoErro === 'confirmada') {
                  <b class="negrito-erro">Não foi possível apagar.</b>
                  A conversa continua como estava. Confira sua conexão e tente de novo.
                } @else {
                  Não foi possível confirmar se a conversa foi apagada. Confira sua conexão e tente de novo.
                }
              </p>
            </div>
          }

          <div class="acoes">
            <button
              #botaoCancelar
              type="button"
              class="botao-cancelar"
              [disabled]="apagando()"
              (click)="cancelar()"
            >
              Cancelar
            </button>

            @if (apagando()) {
              <button
                #botaoCarregando
                type="button"
                class="botao-destrutivo carregando"
                aria-disabled="true"
                (click)="bloquearSegundoClique($event)"
              >
                <span class="spinner" aria-hidden="true"></span>
                Apagando…
              </button>
            } @else {
              <button
                #botaoAcao
                type="button"
                class="botao-destrutivo"
                (click)="confirmar()"
              >
                {{ erroTentativa() ? 'Tentar de novo' : 'Apagar conversa' }}
              </button>
            }
          </div>

          @if (apagando()) {
            <p role="status" class="sr-only">Apagando a conversa…</p>
          }
        </div>
      }
    </dialog>
  `,
  styles: `
    :host {
      display: contents;
    }

    .dialog-confirmacao {
      border: none;
      padding: 0;
      background: transparent;
      max-width: 100vw;
      max-height: 100vh;
      overflow: visible;

      &::backdrop {
        background: rgb(28 26 23 / 0.48);
      }
    }

    .painel {
      width: 440px;
      max-width: calc(100vw - 48px);
      box-sizing: border-box;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--superficie-elevada);
      border: 1px solid color-mix(in srgb, var(--erro) 45%, var(--borda-componente));
      border-radius: 16px;
      box-shadow: 0 24px 64px rgb(28 26 23 / 0.22);
      color: var(--texto-primario);
    }

    .titulo {
      margin: 0;
      font-family: 'Libre Franklin', system-ui, sans-serif;
      font-size: 20px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--erro);
    }

    .texto {
      margin: 0;
      font-family: 'Libre Franklin', system-ui, sans-serif;
      font-size: 15.5px;
      line-height: 1.55;
      color: var(--texto-primario);
    }

    .alerta-erro {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-top: 4px;
      padding: 12px 14px;
      background: color-mix(in srgb, var(--erro) 7%, var(--superficie-elevada));
      border: 1px solid color-mix(in srgb, var(--erro) 35%, var(--borda-componente));
      border-radius: 10px;
    }

    .marca-erro {
      flex: none;
      width: 8px;
      height: 8px;
      margin-top: 7px;
      border-radius: var(--raio-marca-estado, 2px);
      background: var(--erro);
    }

    .texto-erro {
      margin: 0;
      font-family: 'Libre Franklin', system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: var(--texto-primario);
    }

    .negrito-erro {
      color: var(--erro);
      font-weight: 600;
    }

    .acoes {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 6px;
    }

    .botao-cancelar,
    .botao-destrutivo {
      min-height: 44px;
      padding: 0 20px;
      border-radius: 999px;
      font: 600 14px 'Instrument Sans', system-ui, sans-serif;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      &:focus-visible {
        outline: 2px solid var(--foco);
        outline-offset: 2px;
      }
    }

    .botao-cancelar {
      background: transparent;
      border: 1px solid var(--marca);
      color: var(--marca);
      cursor: pointer;

      &:disabled {
        border-color: var(--inativo-borda);
        color: var(--inativo-texto);
        cursor: not-allowed;
      }
    }

    .botao-destrutivo {
      background: var(--erro);
      border: 1px solid var(--erro);
      color: var(--superficie-elevada);
      cursor: pointer;

      &:hover:not(:disabled):not(.carregando) {
        background: color-mix(in srgb, var(--erro) 86%, var(--texto-primario));
        border-color: color-mix(in srgb, var(--erro) 86%, var(--texto-primario));
      }

      &.carregando {
        min-width: 158px;
        gap: 10px;
        cursor: progress;
      }
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      box-sizing: border-box;
      border: 2px solid color-mix(in srgb, var(--superficie-elevada) 40%, transparent);
      border-top-color: var(--superficie-elevada);
      border-radius: 50%;
      animation: girar 0.8s linear infinite;
    }

    @keyframes girar {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation: none;
      }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      .dialog-confirmacao {
        margin-top: auto;
        margin-bottom: 0;
        width: 100%;
        max-width: 100%;
      }

      .painel {
        width: 100%;
        max-width: 100%;
        padding: 22px 20px 24px;
        border-radius: 16px 16px 0 0;
        border: none;
        border-top: 1px solid color-mix(in srgb, var(--erro) 45%, var(--borda-componente));
        box-shadow: 0 -12px 40px rgb(28 26 23 / 0.2);
      }

      .acoes {
        flex-direction: column-reverse;
        gap: 10px;
        margin-top: 10px;
      }

      .botao-cancelar,
      .botao-destrutivo {
        min-height: 48px;
        font-size: 15px;
        width: 100%;
      }
    }
  `,
})
export class ConfirmacaoExclusao {
  readonly apagando = input<boolean>(false);
  readonly erro = input<'confirmada' | 'incerta' | null>(null);

  readonly confirmarExclusao = output<void>();
  readonly cancelou = output<void>();

  readonly aberto = signal(false);
  readonly erroTentativa = signal<'confirmada' | 'incerta' | null>(null);

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly painel = viewChild<ElementRef<HTMLElement>>('painel');
  private readonly botaoCancelar = viewChild<ElementRef<HTMLButtonElement>>('botaoCancelar');
  private readonly botaoAcao = viewChild<ElementRef<HTMLButtonElement>>('botaoAcao');
  private readonly botaoCarregando = viewChild<ElementRef<HTMLButtonElement>>('botaoCarregando');

  private elementoGatilho: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const erroAtual = this.erro();
      const estaAberto = untracked(() => this.aberto());
      if (erroAtual && estaAberto) {
        untracked(() => {
          this.erroTentativa.set(erroAtual);
          setTimeout(() => {
            this.botaoAcao()?.nativeElement.focus();
          });
        });
      } else if (!erroAtual) {
        untracked(() => {
          this.erroTentativa.set(null);
        });
      }
    });

    effect(() => {
      const apagandoAtual = this.apagando();
      const estaAberto = untracked(() => this.aberto());
      if (apagandoAtual && estaAberto) {
        untracked(() => {
          setTimeout(() => {
            const destrutivo =
              this.botaoCarregando()?.nativeElement ??
              this.painel()?.nativeElement.querySelector<HTMLButtonElement>('.botao-destrutivo');
            destrutivo?.focus();
          });
        });
      }
    });
  }

  abrir(gatilho?: HTMLElement): void {
    this.elementoGatilho = gatilho ?? (document.activeElement as HTMLElement | null);
    this.erroTentativa.set(null);
    this.aberto.set(true);
    const dialog = this.dialogRef()?.nativeElement;
    if (dialog) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          try {
            dialog.showModal();
          } catch {
            dialog.setAttribute('open', '');
          }
        } else {
          dialog.setAttribute('open', '');
        }
      }
    }
    setTimeout(() => {
      this.botaoCancelar()?.nativeElement.focus();
    });
  }

  fechar(): void {
    this.erroTentativa.set(null);
    this.aberto.set(false);
    const dialog = this.dialogRef()?.nativeElement;
    if (dialog && dialog.open) {
      if (typeof dialog.close === 'function') {
        try {
          dialog.close();
        } catch {
          dialog.removeAttribute('open');
        }
      } else {
        dialog.removeAttribute('open');
      }
    }
    if (this.elementoGatilho && typeof this.elementoGatilho.focus === 'function') {
      this.elementoGatilho.focus();
    }
  }

  protected cancelar(): void {
    if (this.apagando()) {
      return;
    }
    this.erroTentativa.set(null);
    this.fechar();
    this.cancelou.emit();
  }

  protected confirmar(): void {
    if (this.apagando()) {
      return;
    }
    this.confirmarExclusao.emit();
  }

  protected bloquearSegundoClique(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
  }

  protected aoCancelarDialog(evento: Event): void {
    evento.preventDefault();
    if (this.apagando()) {
      return;
    }
    this.cancelar();
  }

  protected aoClicarDialog(evento: MouseEvent): void {
    if (this.apagando()) {
      return;
    }
    const dialogEl = this.dialogRef()?.nativeElement;
    if (evento.target !== dialogEl) {
      return;
    }
    const painelEl = this.painel()?.nativeElement;
    if (!painelEl) {
      return;
    }
    const rect = painelEl.getBoundingClientRect();
    const clicouFora =
      evento.clientX < rect.left ||
      evento.clientX > rect.right ||
      evento.clientY < rect.top ||
      evento.clientY > rect.bottom;
    if (clicouFora) {
      this.cancelar();
    }
  }

  protected aoTeclarDialog(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab' || !this.aberto()) {
      return;
    }

    evento.preventDefault();

    if (this.apagando()) {
      const destrutivo =
        this.botaoCarregando()?.nativeElement ??
        this.painel()?.nativeElement.querySelector<HTMLButtonElement>('.botao-destrutivo');
      if (destrutivo && document.activeElement !== destrutivo) {
        destrutivo.focus();
      }
      return;
    }

    const cancelar = this.botaoCancelar()?.nativeElement;
    const acao = this.botaoAcao()?.nativeElement;
    if (!cancelar || !acao) {
      return;
    }

    const focoAtual = document.activeElement;
    if (evento.shiftKey) {
      if (focoAtual === acao) {
        cancelar.focus();
      } else {
        acao.focus();
      }
    } else {
      if (focoAtual === cancelar) {
        acao.focus();
      } else {
        cancelar.focus();
      }
    }
  }
}
