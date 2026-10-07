import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ConversaApi } from './conversa-api';
import {
  AgendamentoDaConversa,
  ContatoRequest,
  ConversaResponse,
  MensagemDaConversa,
  MensagemResponse,
  ProximaAcao,
  SlotOferecido,
  VERSAO_AVISO_PRIVACIDADE,
} from './contrato';
import {
  HOJE,
  agruparSlotsPorDia,
  dataDoAgendamento,
  diaDe,
  horaAgora,
  horaDe,
  rotuloDeDia,
} from './horario';
import { AcaoEvento, EstadoConversa, ItemTrilha } from './trilha';

function ehHandoff(acao: ProximaAcao | null): boolean {
  return acao === 'agendar_reuniao' || acao === 'direcionar_especialista';
}

const CHAVE_CONVERSA = 'solar.conversaId';
const PREFIXO_MEMO_PERDA = 'solar.agendamentoPerdido.';
const ABERTURA = 'Olá';
const ESPERA_PROLONGADA_MS = 8000;
const INTERVALO_POLLING_MS = 3000;

@Injectable({ providedIn: 'root' })
export class ConversaStore {
  private readonly api = inject(ConversaApi);

  readonly estado = signal<EstadoConversa>('aceite-pendente');
  readonly itens = signal<ItemTrilha[]>([]);
  readonly contatoEnviando = signal(false);
  readonly contatoErro = signal<string | null>(null);
  readonly aceiteEnviando = signal(false);
  readonly aceiteErro = signal<string | null>(null);
  readonly apagando = signal(false);
  readonly conversaApagada = signal(false);
  readonly erroExclusao = signal<'confirmada' | 'incerta' | null>(null);
  readonly consentimentoPendente = signal(false);

  readonly ofertaAgendamento = signal<SlotOferecido[]>([]);
  readonly corretorAgendamento = signal<string | null>(null);
  readonly contatoRegistrado = signal(false);
  readonly agendamentoConfirmado = signal<AgendamentoDaConversa | null>(null);
  readonly agendamentoRecolhido = signal(false);
  readonly agendamentoEnviando = signal(false);
  readonly agendamentoErro = signal<string | null>(null);
  readonly horarioPerdido = signal<SlotOferecido | null>(null);
  readonly agendamentoSincronizacaoPendente = signal(false);

  readonly gruposAgendamento = computed(() =>
    agruparSlotsPorDia(this.ofertaAgendamento()),
  );

  readonly agendaDisponivel = computed(
    () =>
      this.emConversa() &&
      !this.apagando() &&
      !this.consentimentoPendente() &&
      !!this.corretorAgendamento() &&
      this.contatoRegistrado() &&
      !this.agendamentoConfirmado(),
  );

  readonly cartaoAgendaVisivel = computed(
    () =>
      this.agendaDisponivel() &&
      this.ofertaAgendamento().length > 0 &&
      !this.agendamentoRecolhido(),
  );

  readonly faixaAgendaVisivel = computed(
    () =>
      this.agendaDisponivel() &&
      this.ofertaAgendamento().length > 0 &&
      this.agendamentoRecolhido(),
  );

  readonly avisoAgendaVazia = computed(
    () => this.agendaDisponivel() && this.ofertaAgendamento().length === 0,
  );

  readonly agendamentoPodeSelecionar = computed(
    () =>
      this.agendaDisponivel() &&
      !this.apagando() &&
      !this.aguardando() &&
      !this.contatoEnviando() &&
      !this.agendamentoEnviando() &&
      !this.agendamentoSincronizacaoPendente(),
  );

  readonly podeApagarConversa = computed(
    () =>
      !!this.conversaAtual() &&
      this.emConversa() &&
      this.estado() !== 'inicio-conta' &&
      !this.consentimentoPendente(),
  );
  readonly aguardando = computed(
    () => this.estado() === 'preparando' || this.estado() === 'espera-prolongada',
  );
  readonly emConversa = computed(
    () => this.estado() !== 'aceite-pendente' && this.estado() !== 'aceite-recusado',
  );
  readonly composerRemovido = computed(() => this.estado() === 'encerrada');
  readonly envioDisponivel = computed(
    () =>
      !this.apagando() &&
      !this.agendamentoEnviando() &&
      !this.agendamentoSincronizacaoPendente() &&
      (this.estado() === 'conversando' ||
        this.estado() === 'falha' ||
        this.estado() === 'inicio-conta'),
  );
  readonly campoEditavel = computed(
    () => !this.apagando() && this.emConversa() && this.estado() !== 'encerrada',
  );
  readonly motivoEnvio = computed(() => {
    if (this.agendamentoEnviando()) {
      return 'Aguarde a confirmação do horário.';
    }
    if (this.agendamentoSincronizacaoPendente()) {
      return 'Atualize a confirmação do horário antes de enviar.';
    }
    switch (this.estado()) {
      case 'aceite-pendente':
        return 'Marque a autorização acima para começar.';
      case 'aceite-recusado':
        return 'A conversa não foi iniciada.';
      case 'preparando':
      case 'espera-prolongada':
        return 'Você pode escrever; o envio volta quando a Lia responder.';
      default:
        return null;
    }
  });

  readonly conversaAtual = signal('');
  private versaoConsentidaNaConta: string | null = null;

  private get conversaId(): string {
    return this.conversaAtual();
  }

  private set conversaId(valor: string) {
    this.conversaAtual.set(valor);
  }

  private ultimoEnvio = '';
  private ultimoEnvioVisivel = false;
  private sequencia = 0;
  private totalMensagens = 0;
  private geracao = 0;
  private cronometro: ReturnType<typeof setTimeout> | undefined;
  private cronometroPolling: ReturnType<typeof setInterval> | undefined;
  private revisaoAgenda = 0;
  private tokenPolling: object | null = null;

  async iniciar(): Promise<void> {
    if (this.apagando()) {
      return;
    }
    const salva = this.ler(CHAVE_CONVERSA);
    if (!salva) {
      this.resetarAgenda();
      this.estado.set('aceite-pendente');
      await this.aceitarPelaConta();
      return;
    }

    this.conversaId = salva;
    const g = this.geracao;
    try {
      const conversa = await this.api.obterConversa(salva);
      if (g !== this.geracao) {
        return;
      }
      await this.retomarConversa(conversa);
    } catch (erro) {
      if (g !== this.geracao) {
        return;
      }
      this.itens.set([]);
      this.resetarAgenda();
      if (erro instanceof HttpErrorResponse && erro.status === 404) {
        this.estado.set('aceite-pendente');
        return;
      }
      this.registrarFalhaAoRetomar();
    }
  }

  async aceitar(): Promise<void> {
    if (this.apagando() || this.aceiteEnviando()) {
      return;
    }

    this.conversaApagada.set(false);
    this.aceiteEnviando.set(true);
    this.aceiteErro.set(null);

    if (!this.conversaId) {
      this.conversaId = this.ler(CHAVE_CONVERSA) ?? crypto.randomUUID();
      this.gravar(CHAVE_CONVERSA, this.conversaId);
    }

    const g = this.geracao;
    try {
      await this.api.registrarConsentimento(this.conversaId, {
        versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
      });
      if (g !== this.geracao) {
        return;
      }
      const conversa = await this.api.obterConversa(this.conversaId);
      if (g !== this.geracao) {
        return;
      }
      await this.retomarConversa(conversa);
    } catch {
      if (g !== this.geracao) {
        return;
      }
      this.estado.set('aceite-pendente');
      this.aceiteErro.set('Não foi possível registrar sua autorização. Tente novamente.');
    } finally {
      if (g === this.geracao) {
        this.aceiteEnviando.set(false);
      }
    }
  }

  recusar(): void {
    if (this.apagando()) {
      return;
    }
    this.pararPolling();
    this.totalMensagens = 0;
    this.aceiteErro.set(null);
    this.resetarAgenda();
    this.estado.set('aceite-recusado');
    this.itens.set([]);
  }

  reverEscolha(): void {
    if (this.apagando()) {
      return;
    }
    this.aceiteErro.set(null);
    this.estado.set('aceite-pendente');
  }

  recolherAgendamento(): void {
    if (
      this.agendamentoEnviando() ||
      this.agendamentoSincronizacaoPendente() ||
      !this.agendaDisponivel() ||
      this.ofertaAgendamento().length === 0
    ) {
      return;
    }
    this.agendamentoRecolhido.set(true);
  }

  reabrirAgendamento(): void {
    if (
      this.agendamentoEnviando() ||
      this.agendamentoSincronizacaoPendente() ||
      !this.agendaDisponivel() ||
      this.ofertaAgendamento().length === 0
    ) {
      return;
    }
    this.agendamentoRecolhido.set(false);
  }

  async definirConsentimentoDaConta(versao: string | null): Promise<void> {
    this.versaoConsentidaNaConta = versao;
    if (!this.conversaId) {
      if (this.estado() === 'aceite-pendente') {
        await this.aceitarPelaConta();
      } else if (this.estado() === 'inicio-conta' && versao !== VERSAO_AVISO_PRIVACIDADE) {
        this.estado.set('aceite-pendente');
      }
    }
  }

  conversaGuardada(): string | null {
    return this.ler(CHAVE_CONVERSA);
  }

  async abrirConversa(id: string): Promise<void> {
    if (this.apagando() || id === this.conversaId) {
      return;
    }
    const idAnterior = this.conversaId;
    if (idAnterior) {
      this.limparMemoPerda(idAnterior);
    }
    this.conversaApagada.set(false);
    this.pararPolling();
    this.pararCronometro();
    this.geracao++;
    this.consentimentoPendente.set(false);
    this.contatoEnviando.set(false);
    this.contatoErro.set(null);
    this.resetarAgenda();
    this.gravar(CHAVE_CONVERSA, id);
    this.conversaId = '';
    this.totalMensagens = 0;
    this.sequencia = 0;
    this.itens.set([]);
    await this.iniciar();
  }

  async novaConversa(): Promise<void> {
    if (this.apagando()) {
      return;
    }
    const idAnterior = this.conversaId;
    if (idAnterior) {
      this.limparMemoPerda(idAnterior);
    }
    this.conversaApagada.set(false);
    this.pararPolling();
    this.pararCronometro();
    this.geracao++;
    this.consentimentoPendente.set(false);
    this.contatoEnviando.set(false);
    this.contatoErro.set(null);
    this.resetarAgenda();
    this.apagar(CHAVE_CONVERSA);
    this.conversaId = '';
    this.totalMensagens = 0;
    this.sequencia = 0;
    this.itens.set([]);
    this.estado.set('aceite-pendente');
    await this.aceitarPelaConta();
  }

  async enviar(texto: string): Promise<void> {
    const limpo = texto.trim();
    if (!limpo || !this.envioDisponivel() || this.apagando()) {
      return;
    }

    this.conversaApagada.set(false);
    this.pararPolling();

    if (this.estado() === 'falha') {
      this.removerEventoFinal();
    }

    if (this.estado() === 'inicio-conta' || this.consentimentoPendente()) {
      if (!this.conversaId) {
        this.conversaId = crypto.randomUUID();
        this.gravar(CHAVE_CONVERSA, this.conversaId);
      }
      if (this.itens().length === 0) {
        this.acrescentar({ tipo: 'divisor', id: this.proximoId(), rotulo: HOJE });
      }
      this.acrescentar({
        tipo: 'pessoa',
        id: this.proximoId(),
        texto: limpo,
        hora: horaAgora(),
      });
      this.ultimoEnvio = limpo;
      this.ultimoEnvioVisivel = true;
      await this.executarTurnoComConsentimentoPendente();
      return;
    }

    this.acrescentar({
      tipo: 'pessoa',
      id: this.proximoId(),
      texto: limpo,
      hora: horaAgora(),
    });
    this.ultimoEnvio = limpo;
    this.ultimoEnvioVisivel = true;
    await this.turno();
  }

  /**
   * Grava o contato pelo endpoint proprio, e nao pela conversa: o valor vai do
   * formulario direto ao Postgres, sem passar pelo turno e sem chegar ao modelo.
   */
  async enviarContato(dados: ContatoRequest): Promise<void> {
    if (this.apagando() || this.contatoEnviando()) {
      return;
    }

    this.invalidarLeiturasDaAgenda();
    this.contatoEnviando.set(true);
    this.contatoErro.set(null);

    const g = this.geracao;
    try {
      const resposta = await this.api.registrarContato(this.conversaId, dados);
      if (g !== this.geracao) {
        return;
      }
      this.contatoRegistrado.set(true);
      this.ofertaAgendamento.set(resposta.oferta ?? []);
      this.removerContato();
      this.acrescentar({
        tipo: 'evento',
        id: this.proximoId(),
        variante: 'sucesso',
        rotulo: 'Contato registrado',
        texto: 'Pronto. O corretor da Solar usa esse contato para retomar com você.',
        acao: null,
      });
    } catch {
      if (g !== this.geracao) {
        return;
      }
      this.contatoErro.set('Não foi possível registrar seu contato. Tente novamente.');
    } finally {
      if (g === this.geracao) {
        this.contatoEnviando.set(false);
      }
    }
  }

  async registrarAgendamento(slotId: number): Promise<void> {
    if (
      this.apagando() ||
      !this.conversaId ||
      !this.agendamentoPodeSelecionar() ||
      typeof slotId !== 'number' ||
      !Number.isInteger(slotId) ||
      slotId <= 0
    ) {
      return;
    }

    const slotTentado = this.ofertaAgendamento().find((s) => s.id === slotId);
    if (!slotTentado) {
      return;
    }

    this.invalidarLeiturasDaAgenda();
    this.agendamentoEnviando.set(true);
    this.agendamentoErro.set(null);

    const g = this.geracao;
    const id = this.conversaId;

    try {
      const confirmacao = await this.api.registrarAgendamento(id, slotId);
      if (g !== this.geracao || id !== this.conversaId) {
        return;
      }
      this.agendamentoConfirmado.set(confirmacao);
      this.ofertaAgendamento.set([]);
      this.horarioPerdido.set(null);
      this.limparMemoPerda(id);

      await this.reconciliarHistorico(id, g, confirmacao);
    } catch (erro) {
      if (g !== this.geracao || id !== this.conversaId) {
        return;
      }

      if (this.eh409HorarioIndisponivel(erro)) {
        const resposta409 = erro.error as { oferta?: SlotOferecido[] };
        this.ofertaAgendamento.set(resposta409.oferta ?? []);
        this.horarioPerdido.set(slotTentado);
        this.salvarMemoPerda(id, slotTentado);
        this.agendamentoRecolhido.set(false);
        this.agendamentoErro.set(null);
        this.agendamentoConfirmado.set(null);
        this.agendamentoSincronizacaoPendente.set(false);
        return;
      }

      await this.reconciliarHistorico(id, g, null);
    } finally {
      if (g === this.geracao && id === this.conversaId) {
        this.agendamentoEnviando.set(false);
      }
    }
  }

  async sincronizarAgendamento(): Promise<void> {
    if (this.apagando() || !this.conversaId || this.agendamentoEnviando()) {
      return;
    }
    this.invalidarLeiturasDaAgenda();
    this.agendamentoEnviando.set(true);
    const g = this.geracao;
    const id = this.conversaId;
    const confirmacaoPrevia = this.agendamentoConfirmado();
    try {
      await this.reconciliarHistorico(id, g, confirmacaoPrevia);
    } finally {
      if (g === this.geracao && id === this.conversaId) {
        this.agendamentoEnviando.set(false);
      }
    }
  }

  async tentarNovamente(): Promise<void> {
    if (this.apagando() || !this.ultimoEnvio) {
      return;
    }
    this.removerEventoFinal();

    if (this.consentimentoPendente()) {
      await this.executarTurnoComConsentimentoPendente();
      return;
    }

    await this.turno();
  }

  private async executarTurnoComConsentimentoPendente(): Promise<void> {
    this.invalidarLeiturasDaAgenda();
    this.consentimentoPendente.set(true);
    this.estado.set('preparando');
    this.armarCronometro();
    const g = this.geracao;

    try {
      await this.api.registrarConsentimento(this.conversaId, {
        versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
      });
      if (g !== this.geracao) {
        return;
      }
      this.consentimentoPendente.set(false);
    } catch {
      if (g !== this.geracao) {
        return;
      }
      this.pararCronometro();
      this.registrarFalha();
      return;
    }

    try {
      const resposta = await this.api.enviarMensagem(this.conversaId, this.ultimoEnvio);
      if (g !== this.geracao) {
        return;
      }
      this.pararCronometro();
      this.aplicar(resposta);
    } catch {
      if (g !== this.geracao) {
        return;
      }
      this.pararCronometro();
      this.registrarFalha();
    }
  }

  async apagarConversa(): Promise<boolean> {
    if (this.apagando() || this.consentimentoPendente() || !this.podeApagarConversa()) {
      return false;
    }
    const id = this.conversaId;
    if (!id) {
      return false;
    }

    this.apagando.set(true);
    this.erroExclusao.set(null);
    const g = this.geracao;

    try {
      await this.api.apagarConversa(id);
      if (g !== this.geracao) {
        return false;
      }
      this.processarSucessoExclusao();
      return true;
    } catch (erro) {
      if (g !== this.geracao) {
        return false;
      }
      if (erro instanceof HttpErrorResponse && erro.status === 404) {
        this.processarSucessoExclusao();
        return true;
      }
      if (
        erro instanceof HttpErrorResponse &&
        (erro.status === 403 || erro.status === 409 || erro.status === 429)
      ) {
        this.erroExclusao.set('confirmada');
        return false;
      }

      try {
        await this.api.obterConversa(id);
        if (g !== this.geracao) {
          return false;
        }
        this.erroExclusao.set('confirmada');
        return false;
      } catch {
        if (g !== this.geracao) {
          return false;
        }
        this.erroExclusao.set('incerta');
        return false;
      }
    } finally {
      this.apagando.set(false);
    }
  }

  private processarSucessoExclusao(): void {
    const idAnterior = this.conversaId;
    if (idAnterior) {
      this.limparMemoPerda(idAnterior);
    }
    this.pararCronometro();
    this.pararPolling();
    this.geracao++;
    this.apagar(CHAVE_CONVERSA);
    this.conversaId = '';
    this.itens.set([]);
    this.ultimoEnvio = '';
    this.ultimoEnvioVisivel = false;
    this.sequencia = 0;
    this.totalMensagens = 0;
    this.contatoErro.set(null);
    this.contatoEnviando.set(false);
    this.aceiteErro.set(null);
    this.aceiteEnviando.set(false);
    this.erroExclusao.set(null);
    this.consentimentoPendente.set(false);
    this.resetarAgenda();
    this.conversaApagada.set(true);

    if (this.versaoConsentidaNaConta === VERSAO_AVISO_PRIVACIDADE) {
      this.estado.set('inicio-conta');
    } else {
      this.estado.set('aceite-pendente');
    }
  }

  atenderAcao(acao: AcaoEvento): void {
    switch (acao.tipo) {
      case 'rever-escolha':
        this.reverEscolha();
        return;
      case 'tentar-novamente':
        void this.tentarNovamente();
        return;
      case 'nova-conversa':
        void this.novaConversa();
        return;
      case 'retomar':
        this.itens.set([]);
        void this.iniciar();
        return;
    }
  }

  private async aceitarPelaConta(): Promise<void> {
    if (this.versaoConsentidaNaConta === VERSAO_AVISO_PRIVACIDADE) {
      await this.aceitar();
    }
  }

  private async abrir(): Promise<void> {
    this.itens.set([{ tipo: 'divisor', id: this.proximoId(), rotulo: HOJE }]);
    this.ultimoEnvio = ABERTURA;
    this.ultimoEnvioVisivel = false;
    await this.turno();
  }

  private async retomarConversa(conversa: ConversaResponse): Promise<void> {
    if (!conversa.consentimentoEm || conversa.versaoAvisoPrivacidade !== VERSAO_AVISO_PRIVACIDADE) {
      this.pararPolling();
      this.itens.set([]);
      this.resetarAgenda();
      this.estado.set('aceite-pendente');
      return;
    }

    this.agendamentoRecolhido.set(false);
    this.atualizarAgenda(conversa);

    if (conversa.mensagens.length === 0) {
      await this.abrir();
      return;
    }

    this.sequencia = 0;
    this.totalMensagens = conversa.mensagens.length;
    this.itens.set(
      this.reconstruir(
        conversa.mensagens,
        conversa.contatoPendente,
        conversa.perfilLead?.intencao ?? null,
      ),
    );
    this.estado.set(this.estadoDe(conversa.mensagens));
    if (this.estado() === 'conversando') {
      this.iniciarPolling();
    }
  }

  private async turno(): Promise<void> {
    this.invalidarLeiturasDaAgenda();
    this.estado.set('preparando');
    this.armarCronometro();
    const g = this.geracao;
    try {
      const resposta = await this.api.enviarMensagem(this.conversaId, this.ultimoEnvio);
      if (g !== this.geracao) {
        return;
      }
      this.pararCronometro();
      this.aplicar(resposta);
    } catch {
      if (g !== this.geracao) {
        return;
      }
      this.pararCronometro();
      this.registrarFalha();
    }
  }

  private aplicar(resposta: MensagemResponse): void {
    if (resposta.corretor && resposta.corretor.trim()) {
      this.corretorAgendamento.set(resposta.corretor.trim());
    }

    if (resposta.contatoPendente) {
      this.contatoRegistrado.set(false);
    } else if (this.corretorAgendamento()) {
      this.contatoRegistrado.set(true);
    }

    if (resposta.agendamento?.estado === 'confirmado' && resposta.agendamento.horario) {
      this.agendamentoConfirmado.set(resposta.agendamento);
      this.ofertaAgendamento.set([]);
      this.horarioPerdido.set(null);
      if (this.conversaId) {
        this.limparMemoPerda(this.conversaId);
      }
    }

    const eventoAgendamento = this.eventoDoAgendamento(resposta.agendamento);
    const ehConfirmacao =
      resposta.agendamento?.estado === 'confirmado' && !!resposta.agendamento.horario;

    if (ehConfirmacao && eventoAgendamento) {
      this.acrescentar({ tipo: 'evento', id: this.proximoId(), ...eventoAgendamento });
    }

    this.acrescentar({
      tipo: 'lia',
      id: this.proximoId(),
      texto: resposta.resposta,
      hora: horaAgora(),
      imoveis: resposta.imoveisSugeridos ?? [],
      intencao: resposta.intencao,
      revelar: true,
    });

    if (!ehConfirmacao) {
      const evento = eventoAgendamento ?? this.desfecho(resposta.proximaAcao, resposta.corretor);
      if (evento) {
        this.acrescentar({ tipo: 'evento', id: this.proximoId(), ...evento });
      }
    }

    if (ehHandoff(resposta.proximaAcao) && resposta.contatoPendente) {
      this.acrescentar({ tipo: 'contato', id: this.proximoId() });
    }

    this.totalMensagens += 2;
    const proximoEstado = resposta.proximaAcao === 'encerrar' ? 'encerrada' : 'conversando';
    this.estado.set(proximoEstado);
    if (proximoEstado === 'conversando') {
      this.iniciarPolling();
    } else {
      this.pararPolling();
    }
  }

  iniciarPolling(): void {
    this.pararPolling();
    if (
      !this.conversaId ||
      this.estado() !== 'conversando' ||
      this.apagando() ||
      this.aguardando() ||
      this.contatoEnviando() ||
      this.agendamentoEnviando() ||
      this.agendamentoSincronizacaoPendente()
    ) {
      return;
    }

    this.cronometroPolling = setInterval(() => {
      void this.verificarNovasMensagens();
    }, INTERVALO_POLLING_MS);
  }

  pararPolling(): void {
    if (this.cronometroPolling) {
      clearInterval(this.cronometroPolling);
      this.cronometroPolling = undefined;
    }
  }

  async verificarNovasMensagens(): Promise<void> {
    if (
      this.apagando() ||
      !this.conversaId ||
      this.estado() !== 'conversando' ||
      this.aguardando() ||
      this.contatoEnviando() ||
      this.agendamentoEnviando() ||
      this.agendamentoSincronizacaoPendente() ||
      this.tokenPolling !== null
    ) {
      return;
    }

    const token = {};
    this.tokenPolling = token;
    const g = this.geracao;
    const r = this.revisaoAgenda;
    const id = this.conversaId;

    try {
      const conversa = await this.api.obterConversa(id);
      if (
        g !== this.geracao ||
        r !== this.revisaoAgenda ||
        id !== this.conversaId ||
        this.tokenPolling !== token ||
        this.apagando() ||
        this.estado() !== 'conversando' ||
        this.aguardando() ||
        this.contatoEnviando() ||
        this.agendamentoEnviando() ||
        this.agendamentoSincronizacaoPendente()
      ) {
        return;
      }

      this.atualizarAgenda(conversa);

      if (conversa.mensagens.length > this.totalMensagens) {
        const novas = conversa.mensagens.slice(this.totalMensagens);
        const temLead = novas.some((m) => m.papel === 'lead');

        if (temLead) {
          this.sequencia = 0;
          this.totalMensagens = conversa.mensagens.length;
          this.itens.set(
            this.reconstruir(
              conversa.mensagens,
              conversa.contatoPendente,
              conversa.perfilLead?.intencao ?? null,
            ),
          );
          this.estado.set(this.estadoDe(conversa.mensagens));
          if (this.estado() === 'encerrada') {
            this.pararPolling();
          }
        } else {
          this.totalMensagens = conversa.mensagens.length;
          for (const msg of novas) {
            if (msg.papel === 'agente') {
              const eventoAgendamento = this.eventoDoAgendamento(msg.agendamento);
              const ehConfirmacao =
                msg.agendamento?.estado === 'confirmado' && !!msg.agendamento.horario;

              if (ehConfirmacao && eventoAgendamento) {
                this.acrescentar({ tipo: 'evento', id: this.proximoId(), ...eventoAgendamento });
              }

              this.acrescentar({
                tipo: 'lia',
                id: this.proximoId(),
                texto: msg.texto,
                hora: horaDe(msg.em),
                imoveis: msg.imoveisSugeridos ?? [],
                intencao: conversa.perfilLead?.intencao ?? null,
                revelar: true,
              });

              if (!ehConfirmacao) {
                const evento =
                  eventoAgendamento ??
                  (msg.proximaAcao && this.desfecho(msg.proximaAcao, msg.corretor));
                if (evento) {
                  this.acrescentar({ tipo: 'evento', id: this.proximoId(), ...evento });
                }
              }

              if (ehHandoff(msg.proximaAcao) && conversa.contatoPendente) {
                this.acrescentar({ tipo: 'contato', id: this.proximoId() });
              }

              if (msg.proximaAcao === 'encerrar') {
                this.estado.set('encerrada');
                this.pararPolling();
              }
            }
          }
        }
      }
    } catch {
    } finally {
      if (this.tokenPolling === token) {
        this.tokenPolling = null;
      }
    }
  }

  private desfecho(
    acao: ProximaAcao,
    corretor: string | null,
  ): Omit<Extract<ItemTrilha, { tipo: 'evento' }>, 'tipo' | 'id'> | null {
    switch (acao) {
      case 'agendar_reuniao':
        return {
          variante: 'sucesso',
          rotulo: 'Encaminhado',
          texto: corretor
            ? `Sua conversa foi encaminhada para ${corretor}, da Solar. O atendimento continua a partir do que você já contou.`
            : 'Sua conversa foi encaminhada para a Solar. Um corretor assume a partir do que você já contou.',
          acao: null,
        };
      case 'direcionar_especialista':
        return {
          variante: 'neutro',
          rotulo: 'Próxima etapa',
          texto: corretor
            ? `${corretor}, da Solar, assume a próxima etapa com você.`
            : 'Preparando a próxima etapa com um corretor.',
          acao: null,
        };
      case 'encerrar':
        return {
          variante: 'neutro',
          rotulo: 'Conversa encerrada',
          texto: 'Esta conversa foi encerrada e a Lia não enviará novas mensagens.',
          acao: { rotulo: 'Iniciar nova conversa', tipo: 'nova-conversa' },
        };
      default:
        return null;
    }
  }

  private eventoDoAgendamento(
    agendamento: AgendamentoDaConversa | null,
  ): Omit<Extract<ItemTrilha, { tipo: 'evento' }>, 'tipo' | 'id'> | null {
    if (!agendamento) {
      return null;
    }

    if (agendamento.estado === 'confirmado' && agendamento.horario) {
      return {
        variante: 'sucesso',
        rotulo: 'Reunião confirmada',
        texto: dataDoAgendamento(agendamento.horario.inicio, agendamento.horario.fim),
        acao: null,
      };
    }

    const alternativas = agendamento.alternativas.map((slot) => this.rotuloDoHorario(slot));

    return {
      variante: 'atencao',
      rotulo: 'Horário indisponível',
      texto: alternativas.length
        ? `Esse horário acabou de ser reservado. Ainda estão livres: ${alternativas.join('; ')}.`
        : 'Esse horário acabou de ser reservado. O corretor confirma uma alternativa pelo seu contato.',
      acao: null,
    };
  }

  private rotuloDoHorario(slot: SlotOferecido): string {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(slot.inicio));
  }

  private registrarFalhaAoRetomar(): void {
    this.acrescentar({
      tipo: 'evento',
      id: this.proximoId(),
      variante: 'erro',
      rotulo: 'Falha ao retomar a conversa',
      texto:
        'Não foi possível carregar sua conversa anterior. Ela continua salva — tente novamente em instantes.',
      acao: { rotulo: 'Tentar novamente', tipo: 'retomar' },
    });
    this.estado.set('falha');
  }

  private registrarFalha(): void {
    this.acrescentar({
      tipo: 'evento',
      id: this.proximoId(),
      variante: 'erro',
      rotulo: 'Falha ao obter resposta',
      texto: this.ultimoEnvioVisivel
        ? 'Não foi possível obter a resposta da Lia. Sua mensagem foi mantida.'
        : 'Não foi possível iniciar a conversa. Nenhuma mensagem foi enviada.',
      acao: { rotulo: 'Tentar novamente', tipo: 'tentar-novamente' },
    });
    this.estado.set('falha');
  }

  /**
   * Redesenha a trilha inteira a partir do que o banco guardou: divisores por
   * dia de calendario, as falas, e os mesmos eventos de desfecho que a sessao
   * ao vivo teria mostrado.
   */
  private reconstruir(
    mensagens: MensagemDaConversa[],
    contatoPendente: boolean,
    intencao: string | null = null,
  ): ItemTrilha[] {
    const itens: ItemTrilha[] = [];
    let dia = '';

    for (const [indice, mensagem] of mensagens.entries()) {
      if (indice === 0 && mensagem.papel === 'lead' && mensagem.texto === ABERTURA) {
        continue;
      }

      const diaDaMensagem = diaDe(mensagem.em);
      if (diaDaMensagem !== dia) {
        dia = diaDaMensagem;
        itens.push({
          tipo: 'divisor',
          id: this.proximoId(),
          rotulo: rotuloDeDia(mensagem.em),
        });
      }

      if (mensagem.papel === 'lead') {
        itens.push({
          tipo: 'pessoa',
          id: this.proximoId(),
          texto: mensagem.texto,
          hora: horaDe(mensagem.em),
        });
        continue;
      }

      const eventoAgendamento = this.eventoDoAgendamento(mensagem.agendamento);
      const ehConfirmacao =
        mensagem.agendamento?.estado === 'confirmado' && !!mensagem.agendamento.horario;

      if (ehConfirmacao && eventoAgendamento) {
        itens.push({ tipo: 'evento', id: this.proximoId(), ...eventoAgendamento });
      }

      itens.push({
        tipo: 'lia',
        id: this.proximoId(),
        texto: mensagem.texto,
        hora: horaDe(mensagem.em),
        imoveis: mensagem.imoveisSugeridos ?? [],
        intencao,
        revelar: false,
      });

      if (!ehConfirmacao) {
        const evento =
          eventoAgendamento ??
          (mensagem.proximaAcao && this.desfecho(mensagem.proximaAcao, mensagem.corretor));
        if (evento) {
          itens.push({ tipo: 'evento', id: this.proximoId(), ...evento });
        }
      }
    }

    if (itens.length === 0) {
      itens.push({ tipo: 'divisor', id: this.proximoId(), rotulo: HOJE });
    }

    if (contatoPendente && mensagens.some((mensagem) => ehHandoff(mensagem.proximaAcao))) {
      itens.push({ tipo: 'contato', id: this.proximoId() });
    }

    return itens;
  }

  /** Conversa encerrada continua encerrada depois de um reload. */
  private estadoDe(mensagens: MensagemDaConversa[]): EstadoConversa {
    for (let i = mensagens.length - 1; i >= 0; i--) {
      const mensagem = mensagens[i];
      if (mensagem.papel !== 'agente' || !mensagem.proximaAcao) {
        continue;
      }
      return mensagem.proximaAcao === 'encerrar' ? 'encerrada' : 'conversando';
    }
    return 'conversando';
  }

  private acrescentar(item: ItemTrilha): void {
    this.itens.update((atual) => [...atual, item]);
  }

  private removerContato(): void {
    this.itens.update((atual) => atual.filter((item) => item.tipo !== 'contato'));
  }

  private removerEventoFinal(): void {
    this.itens.update((atual) => {
      const ultimo = atual[atual.length - 1];
      return ultimo && ultimo.tipo === 'evento' ? atual.slice(0, -1) : atual;
    });
  }

  private armarCronometro(): void {
    this.pararCronometro();
    const g = this.geracao;
    this.cronometro = setTimeout(() => {
      if (g === this.geracao && this.estado() === 'preparando') {
        this.estado.set('espera-prolongada');
      }
    }, ESPERA_PROLONGADA_MS);
  }

  private pararCronometro(): void {
    if (this.cronometro) {
      clearTimeout(this.cronometro);
      this.cronometro = undefined;
    }
  }

  private proximoId(): string {
    this.sequencia += 1;
    return `i${this.sequencia}`;
  }

  private ler(chave: string): string | null {
    try {
      return localStorage.getItem(chave);
    } catch {
      return null;
    }
  }

  private gravar(chave: string, valor: string): void {
    try {
      localStorage.setItem(chave, valor);
    } catch {
      return;
    }
  }

  private apagar(chave: string): void {
    try {
      localStorage.removeItem(chave);
    } catch {
      return;
    }
  }

  private atualizarAgenda(conversa: ConversaResponse): void {
    if (!conversa.consentimentoEm || conversa.versaoAvisoPrivacidade !== VERSAO_AVISO_PRIVACIDADE) {
      this.resetarAgenda();
      return;
    }

    let corretor: string | null = null;
    for (let i = conversa.mensagens.length - 1; i >= 0; i--) {
      const c = conversa.mensagens[i].corretor;
      if (c && c.trim()) {
        corretor = c.trim();
        break;
      }
    }
    this.corretorAgendamento.set(corretor);

    const contatoRegistrado = !!corretor && !conversa.contatoPendente;
    this.contatoRegistrado.set(contatoRegistrado);

    let confirmacao: AgendamentoDaConversa | null = null;
    for (let i = conversa.mensagens.length - 1; i >= 0; i--) {
      const ag = conversa.mensagens[i].agendamento;
      if (ag && ag.estado === 'confirmado' && ag.horario) {
        confirmacao = ag;
        break;
      }
    }
    this.agendamentoConfirmado.set(confirmacao);

    if (confirmacao || !corretor || !contatoRegistrado) {
      this.ofertaAgendamento.set([]);
      this.horarioPerdido.set(null);
      if (this.conversaId) {
        this.limparMemoPerda(this.conversaId);
      }
    } else {
      const novaOferta = conversa.oferta ?? [];
      this.ofertaAgendamento.set(novaOferta);
      const perdido =
        this.horarioPerdido() ?? (this.conversaId ? this.lerMemoPerda(this.conversaId) : null);
      if (perdido) {
        if (novaOferta.some((s) => s.id === perdido.id)) {
          this.horarioPerdido.set(null);
          if (this.conversaId) {
            this.limparMemoPerda(this.conversaId);
          }
        } else {
          this.horarioPerdido.set(perdido);
        }
      }
    }
  }

  private resetarAgenda(): void {
    this.invalidarLeiturasDaAgenda();
    this.ofertaAgendamento.set([]);
    this.corretorAgendamento.set(null);
    this.contatoRegistrado.set(false);
    this.agendamentoConfirmado.set(null);
    this.agendamentoRecolhido.set(false);
    this.agendamentoEnviando.set(false);
    this.agendamentoErro.set(null);
    this.horarioPerdido.set(null);
    this.agendamentoSincronizacaoPendente.set(false);
    if (this.conversaId) {
      this.limparMemoPerda(this.conversaId);
    }
  }

  private invalidarLeiturasDaAgenda(): void {
    this.revisaoAgenda++;
    this.tokenPolling = null;
  }

  private async reconciliarHistorico(
    id: string,
    g: number,
    confirmacaoPrevia: AgendamentoDaConversa | null = null,
  ): Promise<void> {
    try {
      const conversa = await this.api.obterConversa(id);
      if (g !== this.geracao || id !== this.conversaId) {
        return;
      }

      if (!conversa.consentimentoEm || conversa.versaoAvisoPrivacidade !== VERSAO_AVISO_PRIVACIDADE) {
        this.resetarAgenda();
        this.estado.set('aceite-pendente');
        return;
      }

      this.atualizarAgenda(conversa);

      if (confirmacaoPrevia) {
        const confirmacaoNoGet = this.agendamentoConfirmado();
        if (!confirmacaoNoGet || conversa.mensagens.length === 0) {
          this.agendamentoConfirmado.set(confirmacaoPrevia);
          this.ofertaAgendamento.set([]);
          this.agendamentoSincronizacaoPendente.set(true);
          this.agendamentoErro.set(
            'A reunião foi confirmada. Não foi possível carregar o histórico. Atualize a confirmação.',
          );
          return;
        }
      }

      if (this.agendamentoConfirmado()) {
        this.agendamentoSincronizacaoPendente.set(false);
        this.agendamentoErro.set(null);
      } else if (!confirmacaoPrevia) {
        this.agendamentoSincronizacaoPendente.set(false);
        this.agendamentoErro.set(
          'Não foi possível confirmar esse horário. Confira os horários atualizados.',
        );
      }

      this.sequencia = 0;
      this.totalMensagens = conversa.mensagens.length;
      if (conversa.mensagens.length > 0) {
        this.itens.set(
          this.reconstruir(
            conversa.mensagens,
            conversa.contatoPendente,
            conversa.perfilLead?.intencao ?? null,
          ),
        );
      }
      this.estado.set(this.estadoDe(conversa.mensagens));
      if (this.estado() === 'conversando') {
        this.iniciarPolling();
      } else {
        this.pararPolling();
      }
    } catch {
      if (g !== this.geracao || id !== this.conversaId) {
        return;
      }
      if (confirmacaoPrevia) {
        this.agendamentoConfirmado.set(confirmacaoPrevia);
        this.ofertaAgendamento.set([]);
        this.agendamentoSincronizacaoPendente.set(true);
        this.agendamentoErro.set(
          'A reunião foi confirmada. Não foi possível carregar o histórico. Atualize a confirmação.',
        );
      } else {
        this.agendamentoSincronizacaoPendente.set(true);
        this.agendamentoErro.set(
          'Não foi possível verificar o horário. Atualize os horários antes de tentar de novo.',
        );
      }
    }
  }

  private eh409HorarioIndisponivel(erro: unknown): erro is HttpErrorResponse {
    if (!(erro instanceof HttpErrorResponse) || erro.status !== 409) {
      return false;
    }
    let corpo = erro.error;
    if (typeof corpo === 'string') {
      try {
        corpo = JSON.parse(corpo);
      } catch {
        return false;
      }
    }
    return (
      typeof corpo === 'object' &&
      corpo !== null &&
      (corpo as { codigo?: unknown }).codigo === 'horario_indisponivel' &&
      Array.isArray((corpo as { oferta?: unknown }).oferta)
    );
  }

  private chaveMemoPerda(id: string): string {
    return `${PREFIXO_MEMO_PERDA}${id}`;
  }

  private salvarMemoPerda(conversaId: string, slot: SlotOferecido): void {
    if (!conversaId) {
      return;
    }
    try {
      sessionStorage.setItem(
        this.chaveMemoPerda(conversaId),
        JSON.stringify({ id: slot.id, inicio: slot.inicio, fim: slot.fim }),
      );
    } catch {}
  }

  private lerMemoPerda(conversaId: string): SlotOferecido | null {
    if (!conversaId) {
      return null;
    }
    try {
      const bruto = sessionStorage.getItem(this.chaveMemoPerda(conversaId));
      if (!bruto) {
        return null;
      }
      const parseado = JSON.parse(bruto);
      if (
        parseado &&
        typeof parseado === 'object' &&
        typeof parseado.id === 'number' &&
        Number.isInteger(parseado.id) &&
        parseado.id > 0 &&
        typeof parseado.inicio === 'string' &&
        typeof parseado.fim === 'string'
      ) {
        return {
          id: parseado.id,
          inicio: parseado.inicio,
          fim: parseado.fim,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private limparMemoPerda(conversaId: string): void {
    if (!conversaId) {
      return;
    }
    try {
      sessionStorage.removeItem(this.chaveMemoPerda(conversaId));
    } catch {}
  }
}
