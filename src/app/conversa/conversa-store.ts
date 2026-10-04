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
import { HOJE, diaDe, horaAgora, horaDe, rotuloDeDia } from './horario';
import { AcaoEvento, EstadoConversa, ItemTrilha } from './trilha';

function ehHandoff(acao: ProximaAcao | null): boolean {
  return acao === 'agendar_reuniao' || acao === 'direcionar_especialista';
}

const CHAVE_CONVERSA = 'solar.conversaId';
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

  readonly podeApagarConversa = computed(
    () => !!this.conversaAtual() && this.emConversa() && this.estado() !== 'inicio-conta',
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
      (this.estado() === 'conversando' ||
        this.estado() === 'falha' ||
        this.estado() === 'inicio-conta'),
  );
  readonly campoEditavel = computed(
    () => !this.apagando() && this.emConversa() && this.estado() !== 'encerrada',
  );
  readonly motivoEnvio = computed(() => {
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
  private consentimentoPendente = false;
  private cronometro: ReturnType<typeof setTimeout> | undefined;
  private cronometroPolling: ReturnType<typeof setInterval> | undefined;

  async iniciar(): Promise<void> {
    if (this.apagando()) {
      return;
    }
    const salva = this.ler(CHAVE_CONVERSA);
    if (!salva) {
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
    this.conversaApagada.set(false);
    this.pararPolling();
    this.pararCronometro();
    this.geracao++;
    this.consentimentoPendente = false;
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
    this.conversaApagada.set(false);
    this.pararPolling();
    this.pararCronometro();
    this.geracao++;
    this.consentimentoPendente = false;
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

    if (this.estado() === 'inicio-conta') {
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
      this.consentimentoPendente = true;
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
        this.consentimentoPendente = false;
      } catch {
        this.pararCronometro();
        if (g !== this.geracao) {
          return;
        }
        this.registrarFalha();
        return;
      }

      try {
        const resposta = await this.api.enviarMensagem(this.conversaId, this.ultimoEnvio);
        this.pararCronometro();
        if (g !== this.geracao) {
          return;
        }
        this.aplicar(resposta);
      } catch {
        this.pararCronometro();
        if (g !== this.geracao) {
          return;
        }
        this.registrarFalha();
      }
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

    this.contatoEnviando.set(true);
    this.contatoErro.set(null);

    const g = this.geracao;
    try {
      await this.api.registrarContato(this.conversaId, dados);
      if (g !== this.geracao) {
        return;
      }
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

  async tentarNovamente(): Promise<void> {
    if (this.apagando() || !this.ultimoEnvio) {
      return;
    }
    this.removerEventoFinal();
    const g = this.geracao;

    if (this.consentimentoPendente) {
      this.estado.set('preparando');
      this.armarCronometro();
      try {
        await this.api.registrarConsentimento(this.conversaId, {
          versaoAvisoPrivacidade: VERSAO_AVISO_PRIVACIDADE,
        });
        if (g !== this.geracao) {
          return;
        }
        this.consentimentoPendente = false;
      } catch {
        this.pararCronometro();
        if (g !== this.geracao) {
          return;
        }
        this.registrarFalha();
        return;
      }

      try {
        const resposta = await this.api.enviarMensagem(this.conversaId, this.ultimoEnvio);
        this.pararCronometro();
        if (g !== this.geracao) {
          return;
        }
        this.aplicar(resposta);
      } catch {
        this.pararCronometro();
        if (g !== this.geracao) {
          return;
        }
        this.registrarFalha();
      }
      return;
    }

    await this.turno();
  }

  async apagarConversa(): Promise<boolean> {
    if (this.apagando() || !this.podeApagarConversa()) {
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
    this.consentimentoPendente = false;
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
      this.estado.set('aceite-pendente');
      return;
    }

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
    this.estado.set('preparando');
    this.armarCronometro();
    const g = this.geracao;
    try {
      const resposta = await this.api.enviarMensagem(this.conversaId, this.ultimoEnvio);
      this.pararCronometro();
      if (g !== this.geracao) {
        return;
      }
      this.aplicar(resposta);
    } catch {
      this.pararCronometro();
      if (g !== this.geracao) {
        return;
      }
      this.registrarFalha();
    }
  }

  private aplicar(resposta: MensagemResponse): void {
    this.acrescentar({
      tipo: 'lia',
      id: this.proximoId(),
      texto: resposta.resposta,
      hora: horaAgora(),
      imoveis: resposta.imoveisSugeridos ?? [],
      intencao: resposta.intencao,
      revelar: true,
    });

    const eventoAgendamento = this.eventoDoAgendamento(resposta.agendamento);
    const evento = eventoAgendamento ?? this.desfecho(resposta.proximaAcao, resposta.corretor);
    if (evento) {
      this.acrescentar({ tipo: 'evento', id: this.proximoId(), ...evento });
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
    if (!this.conversaId || this.estado() !== 'conversando') {
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
      this.aguardando()
    ) {
      return;
    }

    const g = this.geracao;
    try {
      const conversa = await this.api.obterConversa(this.conversaId);
      if (g !== this.geracao) {
        return;
      }
      if (conversa.mensagens.length > this.totalMensagens) {
        const novas = conversa.mensagens.slice(this.totalMensagens);
        this.totalMensagens = conversa.mensagens.length;

        for (const msg of novas) {
          if (msg.papel === 'agente') {
            this.acrescentar({
              tipo: 'lia',
              id: this.proximoId(),
              texto: msg.texto,
              hora: horaDe(msg.em),
              imoveis: msg.imoveisSugeridos ?? [],
              intencao: conversa.perfilLead?.intencao ?? null,
              revelar: true,
            });

            const eventoAgendamento = this.eventoDoAgendamento(msg.agendamento);
            const evento =
              eventoAgendamento ??
              (msg.proximaAcao && this.desfecho(msg.proximaAcao, msg.corretor));
            if (evento) {
              this.acrescentar({ tipo: 'evento', id: this.proximoId(), ...evento });
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
    } catch {}
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
        rotulo: 'Horário confirmado',
        texto: `Reunião marcada para ${this.rotuloDoHorario(agendamento.horario)}.`,
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

      itens.push({
        tipo: 'lia',
        id: this.proximoId(),
        texto: mensagem.texto,
        hora: horaDe(mensagem.em),
        imoveis: mensagem.imoveisSugeridos ?? [],
        intencao,
        revelar: false,
      });

      const eventoAgendamento = this.eventoDoAgendamento(mensagem.agendamento);
      const evento =
        eventoAgendamento ??
        (mensagem.proximaAcao && this.desfecho(mensagem.proximaAcao, mensagem.corretor));
      if (evento) {
        itens.push({ tipo: 'evento', id: this.proximoId(), ...evento });
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
}
