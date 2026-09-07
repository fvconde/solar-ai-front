import { Injectable, computed, inject, signal } from '@angular/core';
import { ConversaApi } from './conversa-api';
import { MensagemHistorico, MensagemResponse, ProximaAcao } from './contrato';
import { horaAgora, horaDe } from './horario';
import { AcaoEvento, EstadoConversa, ItemTrilha } from './trilha';

const CHAVE_CONSENTIMENTO = 'solar.consentimento';
const CHAVE_CONVERSA = 'solar.conversaId';
const ABERTURA = 'Olá';
const ESPERA_PROLONGADA_MS = 8000;

@Injectable({ providedIn: 'root' })
export class ConversaStore {
  private readonly api = inject(ConversaApi);

  readonly estado = signal<EstadoConversa>('aceite-pendente');
  readonly itens = signal<ItemTrilha[]>([]);

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
        this.itens.set(this.reconstruir(conversa.mensagens));
        this.estado.set('conversando');
        return;
      } catch {
        this.itens.set([]);
      }
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
    }
  }

  private async abrir(): Promise<void> {
    this.conversaId = crypto.randomUUID();
    this.gravar(CHAVE_CONVERSA, this.conversaId);
    this.itens.set([
      { tipo: 'divisor', id: this.proximoId(), rotulo: 'Hoje' },
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
    });

    const desfecho = this.desfecho(resposta.proximaAcao);
    if (desfecho) {
      this.acrescentar({ tipo: 'evento', id: this.proximoId(), ...desfecho });
    }
    this.estado.set(resposta.proximaAcao === 'encerrar' ? 'encerrada' : 'conversando');
  }

  private desfecho(acao: ProximaAcao): Omit<
    Extract<ItemTrilha, { tipo: 'evento' }>,
    'tipo' | 'id'
  > | null {
    switch (acao) {
      case 'agendar_reuniao':
        return {
          variante: 'sucesso',
          rotulo: 'Encaminhado',
          texto:
            'Sua conversa foi encaminhada para um corretor da Solar. Ele continua a partir do que você já contou.',
          acao: null,
        };
      case 'direcionar_especialista':
        return {
          variante: 'neutro',
          rotulo: 'Próxima etapa',
          texto: 'Preparando a próxima etapa com um corretor.',
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

  private reconstruir(mensagens: MensagemHistorico[]): ItemTrilha[] {
    const itens: ItemTrilha[] = [{ tipo: 'divisor', id: this.proximoId(), rotulo: 'Hoje' }];
    for (const mensagem of mensagens) {
      if (mensagem.papel === 'lead') {
        if (itens.length === 1 && mensagem.texto === ABERTURA) {
          continue;
        }
        itens.push({
          tipo: 'pessoa',
          id: this.proximoId(),
          texto: mensagem.texto,
          hora: horaDe(mensagem.em),
        });
      } else {
        itens.push({
          tipo: 'lia',
          id: this.proximoId(),
          texto: mensagem.texto,
          hora: horaDe(mensagem.em),
          imoveis: [],
        });
      }
    }
    return itens;
  }

  private acrescentar(item: ItemTrilha): void {
    this.itens.update((atual) => [...atual, item]);
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
