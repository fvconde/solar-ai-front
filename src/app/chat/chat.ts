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
      this.store.itens();
      this.store.estado();
      const apagada = this.store.conversaApagada();
      const elemento = this.palco()?.nativeElement;
      if (apagada) {
        this.bannerApagada()?.nativeElement.focus();
        return;
      }
      if (elemento) {
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
