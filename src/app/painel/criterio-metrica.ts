import { ChangeDetectionStrategy, Component, ElementRef, HostListener, input, OnDestroy, OnInit, signal, viewChild } from '@angular/core';

let proximoId = 0;
const EVENTO_CRITERIO_ABERTO = 'solar:criterio-aberto';

@Component({
  selector: 'app-criterio-metrica',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button #botao type="button" class="criterio" [attr.aria-label]="'Como é calculado: ' + titulo()"
      [attr.aria-expanded]="aberto()" [attr.aria-describedby]="aberto() ? id : null"
      (focus)="abrir()" (blur)="fechar()" (click)="abrir()"
      (mouseenter)="abrir()" (mouseleave)="agendarFechamento()">i</button>
    <div #dica popover="manual" role="tooltip" [id]="id" class="dica"
      (mouseenter)="cancelarFechamento()" (mouseleave)="agendarFechamento()">{{ texto() }}</div>
  `,
  styles: `
    :host { position: absolute; top: 8px; right: 8px; }
    .criterio { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
      padding: 0; border: 1px solid var(--borda-componente); border-radius: 50%;
      background: var(--superficie-elevada); color: var(--texto-secundario);
      font: 600 12px/1 'Libre Franklin', sans-serif; cursor: help; }
    .criterio:focus-visible { outline: 2px solid var(--marca); outline-offset: 3px; }
    .dica { position: fixed; inset: auto; margin: 0; width: 256px; box-sizing: border-box;
      max-width: calc(100vw - 24px); max-height: calc(100dvh - 24px); overflow: auto;
      padding: 9px 12px 10px; border: 0; border-radius: 8px;
      background: var(--texto-primario); color: var(--fundo-conversa);
      box-shadow: 0 4px 14px color-mix(in srgb, var(--texto-primario) 18%, transparent);
      font: 400 12.5px/1.45 'Libre Franklin', sans-serif; text-align: left; }
  `,
})
export class CriterioMetrica implements OnInit, OnDestroy {
  readonly titulo = input.required<string>();
  readonly texto = input.required<string>();
  readonly aberto = signal(false);
  readonly id = `criterio-metrica-${++proximoId}`;
  private readonly botao = viewChild.required<ElementRef<HTMLButtonElement>>('botao');
  private readonly dica = viewChild.required<ElementRef<HTMLDivElement>>('dica');
  private fechamento?: ReturnType<typeof setTimeout>;
  private readonly aoRolar = () => {
    if (!this.aberto()) return;
    if (document.activeElement === this.botao().nativeElement) this.posicionar();
    else this.fechar();
  };
  private readonly aoOutroAbrir = (e: Event) => {
    const ce = e as CustomEvent<{ id: string }>;
    if (ce.detail?.id !== this.id && this.aberto()) {
      this.fechar();
    }
  };

  ngOnInit(): void {
    document.addEventListener('scroll', this.aoRolar, true);
    document.addEventListener(EVENTO_CRITERIO_ABERTO, this.aoOutroAbrir);
  }

  abrir(): void {
    this.cancelarFechamento();
    if (!this.aberto()) {
      document.dispatchEvent(new CustomEvent(EVENTO_CRITERIO_ABERTO, { detail: { id: this.id } }));
    }
    const dica = this.dica().nativeElement;
    dica.showPopover();
    this.posicionar();
    this.aberto.set(true);
  }

  private posicionar(): void {
    const dica = this.dica().nativeElement;
    const origem = this.botao().nativeElement.getBoundingClientRect();
    const caixa = dica.getBoundingClientRect();
    dica.style.left = `${Math.max(12, Math.min(origem.right - caixa.width, window.innerWidth - caixa.width - 12))}px`;
    dica.style.top = `${Math.max(12, Math.min(origem.bottom + 8, window.innerHeight - caixa.height - 12))}px`;
  }

  fechar(): void {
    this.cancelarFechamento();
    this.dica().nativeElement.hidePopover();
    this.aberto.set(false);
  }

  agendarFechamento(): void {
    if (document.activeElement === this.botao().nativeElement) return;
    this.fechamento = setTimeout(() => this.fechar(), 150);
  }

  cancelarFechamento(): void {
    if (this.fechamento !== undefined) clearTimeout(this.fechamento);
    this.fechamento = undefined;
  }

  @HostListener('document:keydown.escape')
  @HostListener('window:resize')
  aoSair(): void {
    if (this.aberto()) this.fechar();
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.aoRolar, true);
    document.removeEventListener(EVENTO_CRITERIO_ABERTO, this.aoOutroAbrir);
    this.cancelarFechamento();
    if (this.aberto()) this.dica().nativeElement.hidePopover();
  }
}
