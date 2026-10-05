import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { AvancoMetricasPainel } from './metricas-contrato';
import { formatadorMetricas } from './formatador-metricas';

function calcularEscala(maiorValor: number): {
  max: number;
  passo: number;
  ticks: { rotulo: string; pos: string }[];
} {
  if (maiorValor <= 0) {
    return { max: 0, passo: 0, ticks: [{ rotulo: '0', pos: '0%' }] };
  }
  const passos = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const passo = passos.find((s) => Math.ceil(maiorValor / s) <= 4) ?? passos[passos.length - 1];
  const max = Math.ceil(maiorValor / passo) * passo;
  const ticks: { rotulo: string; pos: string }[] = [];
  for (let t = 0; t <= max; t += passo) {
    ticks.push({
      rotulo: String(t),
      pos: max > 0 ? `${(t * 100) / max}%` : '0%',
    });
  }
  return { max, passo, ticks };
}

@Component({
  selector: 'app-metricas-avanco',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metricas-avanco.html',
  styleUrls: ['./metricas-avanco.scss'],
})
export class MetricasAvanco implements OnInit, OnDestroy {
  private static proximoId = 0;
  private readonly cdr = inject(ChangeDetectorRef);

  readonly etapas = input.required<AvancoMetricasPainel[]>();
  readonly compacto = input<boolean>(false);

  readonly indiceAtivo = signal<number | null>(null);
  readonly setaLeftPx = signal<number>(128);
  readonly setaAbaixo = signal<boolean>(false);

  readonly idBase = `metricas-avanco-${++MetricasAvanco.proximoId}`;
  readonly idCaixa = computed(() => `${this.idBase}-dica`);

  private readonly caixaRef = viewChild<ElementRef<HTMLDivElement>>('caixa');
  private readonly botoesRef = viewChildren<ElementRef<HTMLButtonElement>>('botaoBarra');
  private readonly barrasRef = viewChildren<ElementRef<HTMLSpanElement>>('barraAlvo');

  readonly formatador = formatadorMetricas;

  readonly base = computed(() => this.etapas()[0]?.conversas ?? 0);
  readonly maiorValor = computed(() => {
    const vals = this.etapas().map((e) => e.conversas);
    return vals.length > 0 ? Math.max(...vals) : 0;
  });
  readonly escala = computed(() => calcularEscala(this.maiorValor()));
  readonly itemAtivo = computed(() => {
    const idx = this.indiceAtivo();
    return idx !== null && idx >= 0 && idx < this.etapas().length ? this.etapas()[idx] : null;
  });
  readonly ariaAvanco = computed(() => formatadorMetricas.ariaAvanco(this.etapas()));
  readonly fraseResumo = computed(() => {
    const lista = this.etapas();
    if (lista.length === 0) return formatadorMetricas.resumoHorarios(0, 0);
    const primeira = lista[0];
    const ultima = lista[lista.length - 1];
    return formatadorMetricas.resumoHorarios(ultima.conversas, primeira.conversas, primeira.etapa);
  });

  private fechamento?: ReturnType<typeof setTimeout>;
  private caixaAberta = false;

  private readonly aoRolarOuRedimensionar = () => {
    if (this.indiceAtivo() === null) return;
    const botoes = this.botoesRef();
    const idx = this.indiceAtivo()!;
    const botaoAtivo = botoes[idx]?.nativeElement;
    if (document.activeElement === botaoAtivo) {
      this.posicionar();
    } else {
      this.fechar();
    }
  };

  ngOnInit(): void {
    document.addEventListener('scroll', this.aoRolarOuRedimensionar, true);
    window.addEventListener('resize', this.aoRolarOuRedimensionar);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.aoRolarOuRedimensionar, true);
    window.removeEventListener('resize', this.aoRolarOuRedimensionar);
    this.cancelarFechamento();
    this.fechar();
  }

  ariaEtapa(item: AvancoMetricasPainel, index: number): string {
    return formatadorMetricas.ariaEtapa(item, this.base(), index === 0, this.etapas()[0]?.etapa);
  }

  corBarra(valor: number, index: number): string {
    if (valor <= 0) return 'var(--inativo-fundo)';
    return index === 0 ? 'var(--neutro)' : 'var(--marca)';
  }

  alturaBarra(valor: number): string {
    if (valor <= 0) return '2px';
    const max = this.escala().max;
    if (max <= 0) return '2px';
    return `${Math.max(2, Math.round((96 * valor) / max))}px`;
  }

  alturaCompacta(valor: number): string {
    if (valor <= 0) return '2px';
    const maior = this.maiorValor();
    if (maior <= 0) return '2px';
    return `${Math.max(2, Math.round((40 * valor) / maior))}px`;
  }

  percentualAbaixo(valor: number, index: number): string {
    return formatadorMetricas.percentual(valor, this.base());
  }

  abrir(index: number): void {
    this.cancelarFechamento();
    this.indiceAtivo.set(index);
    this.cdr.detectChanges();
    const caixa = this.caixaRef()?.nativeElement;
    if (caixa) {
      if (!this.caixaAberta && typeof caixa.showPopover === 'function') {
        try {
          caixa.showPopover();
        } catch {}
      }
      this.caixaAberta = true;
      this.posicionar();
    }
  }

  fechar(): void {
    this.cancelarFechamento();
    if (this.caixaAberta) {
      const caixa = this.caixaRef()?.nativeElement;
      if (caixa && typeof caixa.hidePopover === 'function') {
        try {
          caixa.hidePopover();
        } catch {}
      }
      this.caixaAberta = false;
    }
    this.indiceAtivo.set(null);
  }

  agendarFechamento(): void {
    const idx = this.indiceAtivo();
    if (idx !== null) {
      const botoes = this.botoesRef();
      const botaoAtivo = botoes[idx]?.nativeElement;
      if (document.activeElement === botaoAtivo) return;
    }
    this.fechamento = setTimeout(() => this.fechar(), 150);
  }

  cancelarFechamento(): void {
    if (this.fechamento !== undefined) clearTimeout(this.fechamento);
    this.fechamento = undefined;
  }

  private posicionar(): void {
    const idx = this.indiceAtivo();
    if (idx === null) return;
    const caixa = this.caixaRef()?.nativeElement;
    if (!caixa) return;
    const barras = this.barrasRef();
    const elBarra = barras[idx]?.nativeElement;
    if (!elBarra) return;

    const origem = elBarra.getBoundingClientRect();
    const rectCaixa = caixa.getBoundingClientRect();
    const total = this.etapas().length;

    let left: number;
    if (idx === 0) {
      left = origem.left;
    } else if (idx === total - 1) {
      left = origem.right - rectCaixa.width;
    } else {
      left = origem.left + origem.width / 2 - rectCaixa.width / 2;
    }

    left = Math.max(12, Math.min(left, window.innerWidth - rectCaixa.width - 12));

    let top = origem.top - rectCaixa.height - 26;
    let abaixo = false;

    if (top < 12) {
      top = origem.bottom + 8;
      abaixo = true;
    }

    top = Math.max(12, Math.min(top, window.innerHeight - rectCaixa.height - 12));

    caixa.style.left = `${Math.round(left)}px`;
    caixa.style.top = `${Math.round(top)}px`;

    const centroAlvo = origem.left + origem.width / 2;
    let setaLeft = centroAlvo - left;
    setaLeft = Math.max(12, Math.min(setaLeft, rectCaixa.width - 12));
    this.setaLeftPx.set(Math.round(setaLeft));
    this.setaAbaixo.set(abaixo);
  }

  @HostListener('document:keydown.escape')
  aoEscape(): void {
    if (this.indiceAtivo() !== null) {
      this.fechar();
    }
  }
}
