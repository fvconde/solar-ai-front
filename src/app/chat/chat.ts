import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvisoConsentimento } from '../componentes/aviso-consentimento';
import { CartaoAgendamento } from '../componentes/cartao-agendamento';
import { Composer } from '../componentes/composer';
import { ConfirmacaoExclusao } from '../componentes/confirmacao-exclusao';
import { DivisorData } from '../componentes/divisor-data';
import { EventoSistema } from '../componentes/evento-sistema';
import { FormularioContato } from '../componentes/formulario-contato';
import { Indicador } from '../componentes/indicador';
import { MensagemLia } from '../componentes/mensagem-lia';
import { MensagemPessoa } from '../componentes/mensagem-pessoa';
import { ContaApi } from '../conta/conta-api';
import { ConversaResumo } from '../conta/conta-contrato';
import { ContatoRequest } from '../conversa/contrato';
import { ConversaStore } from '../conversa/conversa-store';
import { AcaoEvento, ItemTrilha } from '../conversa/trilha';
import { SessaoStore } from '../sessao/sessao-store';
import { HistoricoConversas } from './historico-conversas';

const CHAVE_CONVITE_DISPENSADO = 'solar.conviteDispensado';
const TOLERANCIA_FIM_PX = 80;

export interface MarcadorCartaoVisual {
  readonly tipo: 'marcador-cartao';
  readonly id: string;
}

export type ItemApresentacao = ItemTrilha | MarcadorCartaoVisual;

@Component({
  selector: 'app-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    AvisoConsentimento,
    DivisorData,
    MensagemLia,
    MensagemPessoa,
    EventoSistema,
    FormularioContato,
    Indicador,
    Composer,
    HistoricoConversas,
    RouterLink,
    ConfirmacaoExclusao,
    CartaoAgendamento,
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnInit, OnDestroy {
  protected readonly store = inject(ConversaStore);
  protected readonly sessao = inject(SessaoStore);
  private readonly contaApi = inject(ContaApi);

  private readonly palco = viewChild<ElementRef<HTMLElement>>('palco');
  private readonly coluna = viewChild<ElementRef<HTMLElement>>('coluna');
  private readonly bannerApagada = viewChild<ElementRef<HTMLElement>>('bannerApagada');
  private readonly modalConfirmacao = viewChild<ConfirmacaoExclusao>('confirmacao');
  private readonly composer = viewChild<Composer>('composer');

  readonly cliente = computed(() => this.sessao.perfil() === 'cliente');
  readonly conversas = signal<ConversaResumo[]>([]);
  readonly listaAberta = signal(false);
  private readonly conviteDispensadoEm = signal(lerLocal(CHAVE_CONVITE_DISPENSADO));
  private geracaoConversas = 0;
  private ultimaAssinaturaPalco: string | null = null;
  private ultimoEstado: string | null = null;
  private ultimoPalcoEl: HTMLElement | null = null;
  private ultimaConversa: string | null = null;
  private ultimaAcaoPropria = false;
  private ultimaAltura = 0;
  private ultimoCliente = 0;

  private ancoraItemId: string | null = null;
  private ancoraConversaId: string | null = null;
  private ancoraPosicionada = false;
  private aguardandoRespostaEnvio = false;
  private extraAtual = 0;
  private paddingOriginal = 0;
  private ultimoScrollEsperado: number | null = null;

  private colunaElObservado: HTMLElement | null = null;
  private resizeObserverColuna: ResizeObserver | null = null;
  private rafResizeObserver: number | null = null;
  private palcoElOuvintes: HTMLElement | null = null;

  private readonly onWheel = () => {
    this.tratarInteracaoManual();
  };

  private readonly onTouchMove = () => {
    this.tratarInteracaoManual();
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const teclas = ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'];
    if (!teclas.includes(event.key)) {
      return;
    }
    const alvo = event.target as HTMLElement | null;
    if (alvo && (alvo.tagName === 'TEXTAREA' || alvo.tagName === 'INPUT')) {
      return;
    }
    this.tratarInteracaoManual();
  };

  private readonly onPointerDown = (event: MouseEvent | PointerEvent) => {
    const palcoEl = this.palco()?.nativeElement;
    if (!palcoEl) {
      return;
    }
    const rect = palcoEl.getBoundingClientRect();
    if (event.clientX >= rect.left + palcoEl.clientWidth && event.clientX <= rect.right) {
      this.tratarInteracaoManual();
    }
  };

  private readonly onScroll = () => {
    const palcoEl = this.palco()?.nativeElement;
    if (!palcoEl) {
      return;
    }
    if (this.ultimoScrollEsperado !== null) {
      const diff = Math.abs(palcoEl.scrollTop - this.ultimoScrollEsperado);
      if (diff <= 2) {
        return;
      }
    }
    this.tratarInteracaoManual();
  };

  readonly mostrarConvite = computed(() => {
    if (this.sessao.ativa() || !this.store.emConversa()) {
      return false;
    }
    const itens = this.store.itens();
    const primeiraPessoa = itens.findIndex((item) => item.tipo === 'pessoa');
    const houveResposta =
      primeiraPessoa >= 0 && itens.slice(primeiraPessoa).some((item) => item.tipo === 'lia');
    return houveResposta && this.conviteDispensadoEm() !== this.store.conversaAtual();
  });

  readonly temMarcadorCartao = computed(() => {
    return this.itensApresentacao().some((item) => item.tipo === 'marcador-cartao');
  });

  readonly itensApresentacao = computed<ItemApresentacao[]>(() => {
    const itens = this.store.itens();
    const confirmado = this.store.agendamentoEstaConfirmado();
    const agendaDisponivel = this.store.agendaDisponivel();

    if (!confirmado || !agendaDisponivel) {
      return itens;
    }

    const idxEncaminhado = itens.findIndex(
      (item) => item.tipo === 'evento' && item.rotulo === 'Encaminhado',
    );
    if (idxEncaminhado === -1) {
      return itens;
    }

    const idConversa = this.store.conversaAtual() || 'conversa';
    const reciboOriginal = itens.find(
      (item) => item.tipo === 'evento' && item.rotulo === 'Contato enviado',
    );

    const semRecibo = itens.filter(
      (item) => !(item.tipo === 'evento' && item.rotulo === 'Contato enviado'),
    );
    const novoIdxEncaminhado = semRecibo.findIndex(
      (item) => item.tipo === 'evento' && item.rotulo === 'Encaminhado',
    );
    if (novoIdxEncaminhado === -1) {
      return itens;
    }

    const resultado: ItemApresentacao[] = [];
    for (let i = 0; i <= novoIdxEncaminhado; i++) {
      resultado.push(semRecibo[i]);
    }

    if (reciboOriginal) {
      resultado.push({
        ...reciboOriginal,
        id: `recibo:${idConversa}`,
      });
    }

    for (let i = novoIdxEncaminhado + 1; i < semRecibo.length; i++) {
      resultado.push(semRecibo[i]);
    }

    return resultado;
  });

  private readonly assinaturaPalco = computed(() => {
    const confirmado = this.store.agendamentoConfirmado()?.horario;
    const perdido = this.store.horarioPerdido();
    return JSON.stringify([
      this.itensApresentacao().map(assinaturaItem),
      this.store.ofertaAgendamento().map((slot) => [slot.id, slot.inicio, slot.fim]),
      confirmado ? [confirmado.id, confirmado.inicio, confirmado.fim] : null,
      perdido ? [perdido.id, perdido.inicio, perdido.fim] : null,
      this.store.corretorAgendamento(),
      this.store.agendamentoRecolhido(),
      this.store.agendamentoErro(),
      this.store.contatoErro(),
      this.store.agendamentoEnviando(),
      this.store.contatoEnviando(),
      this.store.agendamentoSincronizacaoPendente(),
    ]);
  });

  constructor() {
    afterRenderEffect(() => {
      const assinatura = this.assinaturaPalco();
      const estado = this.store.estado();
      const conversa = this.store.conversaAtual();
      const apagada = this.store.conversaApagada();
      const acaoPropria = this.store.agendamentoEnviando() || this.store.contatoEnviando();
      const elemento = this.palco()?.nativeElement;
      const colunaEl = this.coluna()?.nativeElement;

      if (apagada) {
        this.abandonarAncora();
        this.aguardandoRespostaEnvio = false;
        this.bannerApagada()?.nativeElement.focus();
        return;
      }

      if (!elemento || !colunaEl) {
        if (this.ultimoPalcoEl || this.extraAtual > 0 || this.ancoraItemId !== null) {
          this.removerOuvintesPalco();
          this.desconectarResizeObserver();
          this.abandonarAncora();
          this.aguardandoRespostaEnvio = false;
          this.ultimoPalcoEl = null;
        }
        return;
      }

      if (this.ultimoPalcoEl && elemento !== this.ultimoPalcoEl) {
        this.removerOuvintesPalco();
        this.desconectarResizeObserver();
        this.abandonarAncora();
        this.aguardandoRespostaEnvio = false;
      }

      this.configurarOuvintesPalco(elemento);
      this.configurarResizeObserver(colunaEl);

      const conversaMudou = conversa !== this.ultimaConversa;
      if (conversaMudou && this.ancoraConversaId !== conversa) {
        this.abandonarAncora();
        this.aguardandoRespostaEnvio = false;
      }

      let temAncora = this.ancoraItemId !== null && this.ancoraConversaId === conversa;
      if (temAncora) {
        const existe = this.store.itens().some((it) => it.id === this.ancoraItemId);
        if (!existe) {
          this.abandonarAncora();
          temAncora = false;
        }
      }

      if (temAncora) {
        const hostAncora = this.obterElementoAncora(colunaEl, this.ancoraItemId!);
        if (hostAncora) {
          const rectPalco = elemento.getBoundingClientRect();
          const rectHost = hostAncora.getBoundingClientRect();
          const hostTop = rectHost.top - rectPalco.top + elemento.scrollTop - elemento.clientTop;

          const rectColuna = colunaEl.getBoundingClientRect();
          const bordaInferiorColuna =
            rectColuna.bottom - rectPalco.top + elemento.scrollTop - elemento.clientTop;
          const fimNatural = bordaInferiorColuna - this.extraAtual;
          const extraNecessario = Math.max(0, hostTop + elemento.clientHeight - fimNatural);

          this.aplicarExtra(colunaEl, extraNecessario);

          if (!this.ancoraPosicionada) {
            const alvo = Math.max(0, Math.round(hostTop));
            this.ultimoScrollEsperado = alvo;
            elemento.scrollTop = alvo;
            this.ancoraPosicionada = true;
          }
        }
      } else {
        const abertura = elemento !== this.ultimoPalcoEl || conversaMudou;
        const acaoPropriaAtivada = acaoPropria && !this.ultimaAcaoPropria;
        const mudou = assinatura !== this.ultimaAssinaturaPalco || estado !== this.ultimoEstado;
        const pertoDoFim =
          this.ultimaAltura - elemento.scrollTop - this.ultimoCliente <= TOLERANCIA_FIM_PX;

        const deveRolarParaFim =
          abertura || acaoPropriaAtivada || (mudou && pertoDoFim && !this.aguardandoRespostaEnvio);

        if (deveRolarParaFim) {
          elemento.scrollTop = elemento.scrollHeight;
          this.ultimoScrollEsperado = elemento.scrollTop;
        }
      }

      if (this.aguardandoRespostaEnvio && !this.store.aguardando() && estado !== 'preparando') {
        this.aguardandoRespostaEnvio = false;
      }

      this.ultimaAssinaturaPalco = assinatura;
      this.ultimoEstado = estado;
      this.ultimoPalcoEl = elemento;
      this.ultimaConversa = conversa;
      this.ultimaAcaoPropria = acaoPropria;
      this.ultimaAltura = elemento.scrollHeight;
      this.ultimoCliente = elemento.clientHeight;
    });

    effect(() => {
      if (!this.cliente()) {
        this.conversas.set([]);
        this.listaAberta.set(false);
        return;
      }
      untracked(() => {
        this.contaApi.obter().subscribe({
          next: (conta) =>
            void this.store.definirConsentimentoDaConta(conta.consentimento?.versao ?? null),
          error: () => undefined,
        });
        this.carregarConversas();
      });
    });

    effect(() => {
      const atual = this.store.conversaAtual();
      const conversando = this.store.estado() === 'conversando';
      if (!this.cliente() || !atual || !conversando) {
        return;
      }
      if (!untracked(this.conversas).some((conversa) => conversa.id === atual)) {
        untracked(() => this.carregarConversas());
      }
    });
  }

  ngOnInit(): void {
    void this.store.iniciar();
  }

  ngOnDestroy(): void {
    this.removerOuvintesPalco();
    this.desconectarResizeObserver();
    this.abandonarAncora();
  }

  protected atender(acao: AcaoEvento): void {
    this.store.atenderAcao(acao);
  }

  protected enviar(texto: string): void {
    const itensAntes = this.store.itens();
    void this.store.enviar(texto);
    const itensDepois = this.store.itens();
    const idsPessoaAntes = new Set(
      itensAntes.filter((it) => it.tipo === 'pessoa').map((it) => it.id),
    );
    const novasPessoas = itensDepois.filter(
      (it) => it.tipo === 'pessoa' && !idsPessoaAntes.has(it.id),
    );
    const novaPessoa = novasPessoas[novasPessoas.length - 1];
    if (novaPessoa) {
      this.ancoraItemId = novaPessoa.id;
      this.ancoraConversaId = this.store.conversaAtual();
      this.ancoraPosicionada = false;
      this.aguardandoRespostaEnvio = true;
    }
  }

  protected registrarContato(dados: ContatoRequest): void {
    this.abandonarAncora();
    this.aguardandoRespostaEnvio = false;
    void this.store.enviarContato(dados);
  }

  protected registrarAgendamento(slotId: number): void {
    this.abandonarAncora();
    this.aguardandoRespostaEnvio = false;
    void this.store.registrarAgendamento(slotId);
  }

  protected recolherAgendamento(): void {
    this.store.recolherAgendamento();
  }

  protected reabrirAgendamento(): void {
    this.store.reabrirAgendamento();
  }

  protected sincronizarAgendamento(): void {
    this.abandonarAncora();
    this.aguardandoRespostaEnvio = false;
    void this.store.sincronizarAgendamento();
  }

  protected abrirConversa(id: string): void {
    if (this.store.apagando()) {
      return;
    }
    this.abandonarAncora();
    this.aguardandoRespostaEnvio = false;
    this.listaAberta.set(false);
    void this.store.abrirConversa(id);
  }

  protected novaConversa(): void {
    if (this.store.apagando()) {
      return;
    }
    this.abandonarAncora();
    this.aguardandoRespostaEnvio = false;
    this.listaAberta.set(false);
    void this.store.novaConversa();
  }

  protected dispensarConvite(): void {
    const atual = this.store.conversaAtual();
    this.conviteDispensadoEm.set(atual);
    try {
      localStorage.setItem(CHAVE_CONVITE_DISPENSADO, atual);
    } catch {
      return;
    }
  }

  protected abrirConfirmacao(gatilho?: HTMLElement): void {
    this.modalConfirmacao()?.abrir(gatilho);
  }

  protected async confirmarExclusao(): Promise<void> {
    this.abandonarAncora();
    this.aguardandoRespostaEnvio = false;
    const idApagado = this.store.conversaAtual();
    const sucesso = await this.store.apagarConversa();
    if (sucesso) {
      this.geracaoConversas++;
      this.modalConfirmacao()?.fechar();
      this.composer()?.limpar();
      if (idApagado) {
        this.conversas.update((lista) => lista.filter((c) => c.id !== idApagado));
        if (this.conviteDispensadoEm() === idApagado || lerLocal(CHAVE_CONVITE_DISPENSADO) === idApagado) {
          this.conviteDispensadoEm.set(null);
          try {
            localStorage.removeItem(CHAVE_CONVITE_DISPENSADO);
          } catch {}
        }
      }
      setTimeout(() => {
        this.bannerApagada()?.nativeElement.focus();
      }, 0);
    }
  }

  private configurarOuvintesPalco(palcoEl: HTMLElement): void {
    if (this.palcoElOuvintes === palcoEl) {
      return;
    }
    this.removerOuvintesPalco();
    this.palcoElOuvintes = palcoEl;
    palcoEl.addEventListener('wheel', this.onWheel, { passive: true });
    palcoEl.addEventListener('touchmove', this.onTouchMove, { passive: true });
    palcoEl.addEventListener('keydown', this.onKeyDown);
    palcoEl.addEventListener('scroll', this.onScroll, { passive: true });
    palcoEl.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    palcoEl.addEventListener('mousedown', this.onPointerDown, { passive: true });
  }

  private removerOuvintesPalco(): void {
    if (this.palcoElOuvintes) {
      this.palcoElOuvintes.removeEventListener('wheel', this.onWheel);
      this.palcoElOuvintes.removeEventListener('touchmove', this.onTouchMove);
      this.palcoElOuvintes.removeEventListener('keydown', this.onKeyDown);
      this.palcoElOuvintes.removeEventListener('scroll', this.onScroll);
      this.palcoElOuvintes.removeEventListener('pointerdown', this.onPointerDown);
      this.palcoElOuvintes.removeEventListener('mousedown', this.onPointerDown);
      this.palcoElOuvintes = null;
    }
  }

  private configurarResizeObserver(colunaEl: HTMLElement): void {
    if (this.colunaElObservado === colunaEl) {
      return;
    }
    this.desconectarResizeObserver();
    this.colunaElObservado = colunaEl;
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserverColuna = new ResizeObserver(() => {
      if (this.rafResizeObserver !== null) {
        cancelAnimationFrame(this.rafResizeObserver);
      }
      this.rafResizeObserver = requestAnimationFrame(() => {
        this.rafResizeObserver = null;
        this.recalcularExtra();
      });
    });
    this.resizeObserverColuna.observe(colunaEl);
  }

  private desconectarResizeObserver(): void {
    if (this.rafResizeObserver !== null) {
      cancelAnimationFrame(this.rafResizeObserver);
      this.rafResizeObserver = null;
    }
    if (this.resizeObserverColuna) {
      this.resizeObserverColuna.disconnect();
      this.resizeObserverColuna = null;
    }
    this.colunaElObservado = null;
  }

  private obterElementoAncora(colunaEl: HTMLElement, id: string): HTMLElement | null {
    try {
      const el = colunaEl.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`);
      if (el) {
        return el;
      }
    } catch {}
    return (
      Array.from(colunaEl.querySelectorAll<HTMLElement>('[data-item-id]')).find(
        (el) => el.getAttribute('data-item-id') === id,
      ) ?? null
    );
  }

  private aplicarExtra(colunaEl: HTMLElement, extra: number): void {
    const extraArredondado = Math.max(0, Math.round(extra));
    if (Math.abs(extraArredondado - this.extraAtual) <= 1) {
      return;
    }
    if (extraArredondado > 0) {
      if (this.extraAtual === 0) {
        this.paddingOriginal = parseFloat(window.getComputedStyle(colunaEl).paddingBottom) || 0;
      }
      colunaEl.style.paddingBottom = `${this.paddingOriginal + extraArredondado}px`;
      this.extraAtual = extraArredondado;
    } else {
      colunaEl.style.paddingBottom = '';
      this.extraAtual = 0;
    }
  }

  private removerExtra(): void {
    if (this.extraAtual > 0) {
      const colunaEl = this.coluna()?.nativeElement;
      if (colunaEl) {
        colunaEl.style.paddingBottom = '';
      }
      this.extraAtual = 0;
    }
  }

  private abandonarAncora(): void {
    this.ancoraItemId = null;
    this.ancoraConversaId = null;
    this.ancoraPosicionada = false;
    this.removerExtra();
  }

  private tratarInteracaoManual(): void {
    if (this.ancoraItemId !== null || this.extraAtual > 0) {
      this.abandonarAncora();
      const palcoEl = this.palco()?.nativeElement;
      if (palcoEl) {
        this.ultimoScrollEsperado = palcoEl.scrollTop;
      }
    }
  }

  private recalcularExtra(): void {
    if (!this.ancoraItemId || !this.ancoraPosicionada) {
      return;
    }
    const elemento = this.palco()?.nativeElement;
    const colunaEl = this.coluna()?.nativeElement;
    if (!elemento || !colunaEl) {
      return;
    }
    const hostAncora = this.obterElementoAncora(colunaEl, this.ancoraItemId);
    if (!hostAncora) {
      this.abandonarAncora();
      return;
    }
    const rectPalco = elemento.getBoundingClientRect();
    const rectHost = hostAncora.getBoundingClientRect();
    const hostTop = rectHost.top - rectPalco.top + elemento.scrollTop - elemento.clientTop;

    const rectColuna = colunaEl.getBoundingClientRect();
    const bordaInferiorColuna =
      rectColuna.bottom - rectPalco.top + elemento.scrollTop - elemento.clientTop;
    const fimNatural = bordaInferiorColuna - this.extraAtual;
    const extraNecessario = Math.max(0, hostTop + elemento.clientHeight - fimNatural);

    this.aplicarExtra(colunaEl, extraNecessario);
  }

  private carregarConversas(): void {
    const g = ++this.geracaoConversas;
    this.contaApi.listarConversas().subscribe({
      next: (conversas) => {
        if (g !== this.geracaoConversas) {
          return;
        }
        this.conversas.set(conversas);
      },
      error: () => {
        if (g !== this.geracaoConversas) {
          return;
        }
        this.conversas.set([]);
      },
    });
  }
}

function assinaturaItem(item: ItemApresentacao): unknown[] {
  switch (item.tipo) {
    case 'divisor':
      return [item.tipo, item.rotulo];
    case 'pessoa':
      return [item.tipo, item.texto, item.hora];
    case 'lia':
      return [item.tipo, item.texto, item.hora, item.intencao, item.imoveis];
    case 'evento':
      return [
        item.tipo,
        item.variante,
        item.rotulo,
        item.texto,
        item.acao?.rotulo ?? null,
        item.acao?.tipo ?? null,
      ];
    default:
      return [item.tipo];
  }
}

function lerLocal(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
