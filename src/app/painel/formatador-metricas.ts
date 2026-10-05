import { AvancoMetricasPainel, EtapaAvancoPainel } from './metricas-contrato';

export const formatadorMetricas = {
  numero(valor: number): string {
    return Number.isFinite(valor) ? String(Math.trunc(valor)) : '—';
  },
  plural(valor: number, singular: string, plural: string): string {
    return `${this.numero(valor)} ${valor === 1 ? singular : plural}`;
  },
  percentual(valor: number, total: number): string {
    return total > 0 && Number.isFinite(valor / total)
      ? `${Math.round((valor * 100) / total)}%`
      : '—';
  },
  largura(valor: number, total: number): string {
    return total > 0 && Number.isFinite(valor / total)
      ? `${Math.min(100, Math.max(0, (valor * 100) / total))}%`
      : '0%';
  },
  data(valor: string | null, formato: 'horario' | 'agenda' | 'mes' | 'diaMes' = 'agenda'): string {
    if (!valor || !Number.isFinite(Date.parse(valor))) return '—';
    if (formato === 'diaMes') {
      const d = new Date(valor);
      const dia = String(d.getUTCDate()).padStart(2, '0');
      const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${dia}/${mes}`;
    }
    const opcoes: Intl.DateTimeFormatOptions = formato === 'mes'
      ? { month: 'short', year: 'numeric' }
      : formato === 'horario'
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(valor));
  },
  tempo(minutos: number | null): string {
    if (minutos === null || !Number.isFinite(minutos) || minutos < 0) return '—';
    const totalMin = Math.round(minutos);
    if (totalMin < 60) return `${totalMin} min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h} h ${String(m).padStart(2, '0')} min`;
  },
  deConversas(valor: number, base: number): string {
    if (base <= 0) return 'Nenhuma conversa ainda';
    return `${this.numero(valor)} de ${this.plural(base, 'conversa', 'conversas')}`;
  },
  historico(data: string | null): string {
    const dm = this.data(data, 'diaMes');
    return `Histórico de avanço disponível desde ${dm}. Conversas anteriores não entram no gráfico nem em Dados essenciais e Horários confirmados.`;
  },
  tituloEtapa(etapa: EtapaAvancoPainel | string): string {
    switch (etapa) {
      case 'iniciadas':
        return 'Conversas iniciadas';
      case 'intencao':
        return 'Intenção identificada';
      case 'essenciais':
        return 'Dados essenciais preenchidos';
      case 'encaminhamento':
        return 'Encaminhamento solicitado';
      case 'corretor':
        return 'Corretor atribuído';
      case 'horario':
        return 'Horário confirmado';
      case 'atribuidas':
        return 'Conversas atribuídas a você';
      default:
        return String(etapa);
    }
  },
  explicacaoEtapa(etapa: EtapaAvancoPainel | string): string {
    switch (etapa) {
      case 'iniciadas':
        return 'Primeira mensagem do usuário, sem contar o "Olá" automático';
      case 'intencao':
        return 'Compra, aluguel ou investimento';
      case 'essenciais':
        return 'Intenção, região e faixa de preço (compra ou aluguel); intenção, ticket e expectativa de retorno (investimento)';
      case 'encaminhamento':
        return 'Pedido de atendimento humano registrado';
      case 'corretor':
        return 'Um corretor foi designado, mesmo que depois redistribuído';
      case 'horario':
        return 'Reserva confirmada na agenda';
      case 'atribuidas':
        return 'Conversas atualmente atribuídas a você, iniciadas no período e com registro de etapas';
      default:
        return '';
    }
  },
  faltamEtapa(valor: number, base: number): string {
    const faltam = Math.max(0, base - valor);
    return `${faltam} ${faltam === 1 ? 'conversa ainda não atingiu' : 'conversas ainda não atingiram'} esta etapa`;
  },
  notaEncaminhamento(quantidade: number): string {
    if (!quantidade || quantidade <= 0) return '';
    return `Inclui ${this.plural(quantidade, 'conversa', 'conversas')} sem os dados essenciais.`;
  },
  percentualEtapa(
    valor: number,
    base: number,
    primeiraEtapa: boolean | string = false,
    etapaReferencia?: string
  ): string {
    if (primeiraEtapa === true) {
      return 'Grupo de referência do período';
    }
    const p = this.percentual(valor, base);
    const ehAtribuidas = primeiraEtapa === 'atribuidas' || etapaReferencia === 'atribuidas';
    const sufixo = ehAtribuidas ? 'das conversas atribuídas' : 'das conversas iniciadas';
    return `${p} ${sufixo}`;
  },
  ariaEtapa(
    item: AvancoMetricasPainel,
    base: number,
    primeiraEtapa: boolean | string = false,
    etapaReferencia?: string
  ): string {
    const ehPrimeira = typeof primeiraEtapa === 'boolean'
      ? primeiraEtapa
      : item.etapa === primeiraEtapa;
    const ref = typeof primeiraEtapa === 'string' && primeiraEtapa !== item.etapa
      ? primeiraEtapa
      : etapaReferencia;

    const titulo = this.tituloEtapa(item.etapa);
    const contagem = this.plural(item.conversas, 'conversa', 'conversas');
    const nota = this.notaEncaminhamento(item.semEssenciais ?? 0);
    const explicacao = this.explicacaoEtapa(item.etapa);

    let prefixo: string;
    if (ehPrimeira) {
      const pct = this.percentual(item.conversas, base);
      prefixo = `${titulo}: ${contagem}, ${pct}, Grupo de referência do período`;
    } else {
      const pctStr = this.percentualEtapa(item.conversas, base, false, ref);
      const faltamStr = this.faltamEtapa(item.conversas, base);
      prefixo = `${titulo}: ${contagem}, ${pctStr}, ${faltamStr}`;
    }

    if (nota) prefixo += `. ${nota}`;
    if (explicacao) prefixo += `. ${explicacao}`;
    return prefixo;
  },
  ariaAvanco(itens: AvancoMetricasPainel[]): string {
    if (!itens || itens.length === 0) return 'Avanço das conversas no chat:';
    const partes = itens.map(
      (item) => `${this.tituloEtapa(item.etapa)} ${this.plural(item.conversas, 'conversa', 'conversas')}`
    );
    return `Avanço das conversas no chat: ${partes.join(', ')}`;
  },
  resumoHorarios(valor: number, base: number, etapaRef: string = 'iniciadas'): string {
    if (base <= 0) return 'Sem conversas no período';
    const p = this.percentual(valor, base);
    const grupo = etapaRef === 'atribuidas'
      ? (base === 1 ? 'da conversa atribuída a você' : 'das conversas atribuídas a você')
      : (base === 1 ? 'da conversa' : 'das conversas');
    const verbo = valor === 1 || base === 1 ? 'teve' : 'tiveram';
    return `${p} ${grupo} ${verbo} horário confirmado`;
  },
  respostaFollowUp(janelaDias: number): string {
    return `Responderam em até ${this.plural(janelaDias, 'dia', 'dias')}.`;
  },
  observacaoFollowUp(quantidade: number): string {
    if (!quantidade || quantidade <= 0) return 'Nenhum follow-up em observação';
    return `${this.plural(quantidade, 'follow-up', 'follow-ups')} em observação`;
  },
  serieTempo(
    valores: (number | null)[],
    formato: 'acessivel' | 'visivel' = 'acessivel'
  ): string {
    if (formato === 'visivel') {
      return this.fraseVisivelSerieTempo(valores);
    }
    if (!valores || valores.length === 0) return 'Sem dados de tempo';
    const dias = valores.map((v) => (v === null ? 'sem dados' : this.tempo(v))).join(', ');
    return `Mediana diária dos últimos 7 dias: ${dias}`;
  },
  fraseVisivelSerieTempo(valores: (number | null)[]): string {
    if (!valores || valores.length === 0) {
      return 'A linha aparece com o primeiro encaminhamento.';
    }
    const validos = valores.filter((v): v is number => v !== null && Number.isFinite(v));
    if (validos.length === 0) {
      return 'A linha aparece com o primeiro encaminhamento.';
    }
    const primeiro = this.tempo(validos[0]);
    const ultimo = this.tempo(validos[validos.length - 1]);
    const temSemDados = valores.some((v) => v === null);
    const notaSemPonto = temSemDados ? '; dias sem dados ficam sem ponto' : '';
    return `Mediana diária, últimos 7 dias: de ${primeiro} para ${ultimo}${notaSemPonto}.`;
  },
};
