import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
import { AcaoEvento } from '../conversa/trilha';
import { SessaoStore } from '../sessao/sessao-store';
import { HistoricoConversas } from './historico-conversas';

const CHAVE_CONVITE_DISPENSADO = 'solar.conviteDispensado';

@Component({
  selector: 'app-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
export class Chat implements OnInit {
  protected readonly store = inject(ConversaStore);
  protected readonly sessao = inject(SessaoStore);
  private readonly contaApi = inject(ContaApi);

  private readonly palco = viewChild<ElementRef<HTMLElement>>('palco');
  private readonly bannerApagada = viewChild<ElementRef<HTMLElement>>('bannerApagada');
  private readonly modalConfirmacao = viewChild<ConfirmacaoExclusao>('confirmacao');
  private readonly composer = viewChild<Composer>('composer');

  readonly cliente = computed(() => this.sessao.perfil() === 'cliente');
  readonly conversas = signal<ConversaResumo[]>([]);
  readonly listaAberta = signal(false);
  private readonly conviteDispensadoEm = signal(lerLocal(CHAVE_CONVITE_DISPENSADO));
  private geracaoConversas = 0;
  private ultimoItensRef: unknown = null;
  private ultimoEstado: string | null = null;
  private ultimoPalcoEl: HTMLElement | null = null;
  private ultimaAssinaturaAgenda: string | null = null;

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

  constructor() {
    afterRenderEffect(() => {
      const itens = this.store.itens();
      const estado = this.store.estado();
      const apagada = this.store.conversaApagada();
      const elemento = this.palco()?.nativeElement;

      const oferta = this.store.ofertaAgendamento();
      const recolhido = this.store.agendamentoRecolhido();
      const perdido = this.store.horarioPerdido();
      const erro = this.store.agendamentoErro();
      const confirmado = !!this.store.agendamentoConfirmado();
      const busyOuPendente =
        this.store.agendamentoEnviando() || this.store.agendamentoSincronizacaoPendente();

      const slotsStr = oferta.map((s) => `${s.id}:${s.inicio}:${s.fim}`).join(';');
      const perdidoStr = perdido ? `${perdido.id}:${perdido.inicio}:${perdido.fim}` : '';
      const assinatura = `${slotsStr}|${recolhido}|${perdidoStr}|${erro ?? ''}|${confirmado}|${busyOuPendente}`;

      if (apagada) {
        this.bannerApagada()?.nativeElement.focus();
        return;
      }

      if (!elemento) {
        this.ultimoPalcoEl = null;
        return;
      }

      const itensMudaram = itens !== this.ultimoItensRef;
      const estadoMudou = estado !== this.ultimoEstado;
      const elementoMudou = elemento !== this.ultimoPalcoEl;
      const agendaMudou = assinatura !== this.ultimaAssinaturaAgenda;

      if (itensMudaram || estadoMudou || elementoMudou || agendaMudou) {
        this.ultimoItensRef = itens;
        this.ultimoEstado = estado;
        this.ultimoPalcoEl = elemento;
        this.ultimaAssinaturaAgenda = assinatura;
        elemento.scrollTop = elemento.scrollHeight;
      }
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

  protected atender(acao: AcaoEvento): void {
    this.store.atenderAcao(acao);
  }

  protected enviar(texto: string): void {
    void this.store.enviar(texto);
  }

  protected registrarContato(dados: ContatoRequest): void {
    void this.store.enviarContato(dados);
  }

  protected registrarAgendamento(slotId: number): void {
    void this.store.registrarAgendamento(slotId);
  }

  protected recolherAgendamento(): void {
    this.store.recolherAgendamento();
  }

  protected reabrirAgendamento(): void {
    this.store.reabrirAgendamento();
  }

  protected sincronizarAgendamento(): void {
    void this.store.sincronizarAgendamento();
  }

  protected abrirConversa(id: string): void {
    if (this.store.apagando()) {
      return;
    }
    this.listaAberta.set(false);
    void this.store.abrirConversa(id);
  }

  protected novaConversa(): void {
    if (this.store.apagando()) {
      return;
    }
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

function lerLocal(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
