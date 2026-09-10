import { Injectable, computed, inject, signal } from '@angular/core';
import { ConversaApi } from './conversa-api';
import {
  AgendamentoDaConversa,
  ContatoRequest,
  MensagemDaConversa,
  MensagemResponse,
  ProximaAcao,
  SlotOferecido,
} from './contrato';
import { HOJE, diaDe, horaAgora, horaDe, rotuloDeDia } from './horario';
import { AcaoEvento, EstadoConversa, ItemTrilha } from './trilha';

function ehHandoff(acao: ProximaAcao | null): boolean {
  return acao === 'agendar_reuniao' || acao === 'direcionar_especialista';
}

const CHAVE_CONSENTIMENTO = 'solar.consentimento';
const CHAVE_CONVERSA = 'solar.conversaId';
const ABERTURA = 'Olá';
const ESPERA_PROLONGADA_MS = 8000;

@Injectable({ providedIn: 'root' })
export class ConversaStore {
  private readonly api = inject(ConversaApi);

  readonly estado = signal<EstadoConversa>('aceite-pendente');
  readonly itens = signal<ItemTrilha[]>([]);
  readonly contatoEnviando = signal(false);
  readonly contatoErro = signal<string | null>(null);

  readonly aguardando = computed(
    () => this.estado() === 'preparando' || this.estado() === 'espera-prolongada',
  );
  readonly emConversa = computed(
    () => this.estado() !== 'aceite-pendente' && this.estado() !== 'aceite-recusado',
  );
  readonly composerRemovido = computed(() => this.estado() === 'encerrada');
  readonly envioDisponivel = computed(
    () => this.estado() === 'conversando' || this.estado() === 'falha',
  );
  readonly campoEditavel = computed(() => this.emConversa() && this.estado() !== 'encerrada');
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

  private conversaId = '';
  private ultimoEnvio = '';
  private ultimoEnvioVisivel = false;
  private sequencia = 0;
  private cronometro: ReturnType<typeof setTimeout> | undefined;

  async iniciar(): Promise<void> {
    if (this.ler(CHAVE_CONSENTIMENTO) !== 'aceito') {
      this.estado.set('aceite-pendente');
      return;
    }

    const salva = this.ler(CHAVE_CONVERSA);
    if (salva) {
      this.conversaId = salva;
      try {
        const conversa = await this.api.obterConversa(salva);
        this.itens.set(this.reconstruir(conversa.mensagens, conversa.contatoPendente));
        this.estado.set(this.estadoDe(conversa.mensagens));
      } catch {
        // A conversa salva existe e nao vamos perde-la por uma falha de rede:
        // abrir() aqui geraria um guid novo e sobrescreveria o do localStorage,
        // apagando o historico para sempre sem avisar ninguem.
        this.itens.set([]);
        this.registrarFalhaAoRetomar();
      }
      return;
    }

    await this.abrir();
  }

  aceitar(): void {
    this.gravar(CHAVE_CONSENTIMENTO, 'aceito');
    void this.abrir();
  }

  recusar(): void {
    this.estado.set('aceite-recusado');
    this.itens.set([]);
  }

  reverEscolha(): void {
    this.estado.set('aceite-pendente');
  }

  async novaConversa(): Promise<void> {
    this.apagar(CHAVE_CONVERSA);
    this.itens.set([]);
    await this.abrir();
  }

  async enviar(texto: string): Promise<void> {
    const limpo = texto.trim();
    if (!limpo || !this.envioDisponivel()) {
      return;
    }

    if (this.estado() === 'falha') {
      this.removerEventoFinal();
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
    if (this.contatoEnviando()) {
      return;
    }

    this.contatoEnviando.set(true);
    this.contatoErro.set(null);

    try {
      await this.api.registrarContato(this.conversaId, dados);
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
      this.contatoErro.set('Não foi possível registrar seu contato. Tente novamente.');
    } finally {
      this.contatoEnviando.set(false);
    }
  }

  async tentarNovamente(): Promise<void> {
    if (!this.ultimoEnvio) {
      return;
    }
    this.removerEventoFinal();
    await this.turno();
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

  private async abrir(): Promise<void> {
    this.conversaId = crypto.randomUUID();
    this.gravar(CHAVE_CONVERSA, this.conversaId);
    this.itens.set([
      { tipo: 'divisor', id: this.proximoId(), rotulo: HOJE },
    ]);
    this.ultimoEnvio = ABERTURA;
    this.ultimoEnvioVisivel = false;
    await this.turno();
  }

  private async turno(): Promise<void> {
    this.estado.set('preparando');
    this.armarCronometro();
    try {
      const resposta = await this.api.enviarMensagem(this.conversaId, this.ultimoEnvio);
      this.pararCronometro();
      this.aplicar(resposta);
    } catch {
      this.pararCronometro();
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
    });

    const eventoAgendamento = this.eventoDoAgendamento(resposta.agendamento);
    const evento = eventoAgendamento ?? this.desfecho(resposta.proximaAcao, resposta.corretor);
    if (evento) {
      this.acrescentar({ tipo: 'evento', id: this.proximoId(), ...evento });
    }

    if (ehHandoff(resposta.proximaAcao) && resposta.contatoPendente) {
      this.acrescentar({ tipo: 'contato', id: this.proximoId() });
    }

    this.estado.set(resposta.proximaAcao === 'encerrar' ? 'encerrada' : 'conversando');
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
   * ao vivo teria mostrado. Imoveis nao voltam -- a API nao os persiste.
   */
  private reconstruir(mensagens: MensagemDaConversa[], contatoPendente: boolean): ItemTrilha[] {
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
        imoveis: [],
        intencao: null,
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
    this.cronometro = setTimeout(() => {
      if (this.estado() === 'preparando') {
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
