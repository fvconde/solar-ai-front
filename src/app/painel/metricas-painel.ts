import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { SessaoStore } from '../sessao/sessao-store';
import { CriterioMetrica } from './criterio-metrica';
import { formatadorMetricas } from './formatador-metricas';
import { MetricasPainelResponse } from './metricas-contrato';
import { PainelApi } from './painel-api';

@Component({
  selector: 'app-metricas-painel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CriterioMetrica],
  templateUrl: './metricas-painel.html',
  styleUrl: './metricas-painel.scss',
})
export class MetricasPainel implements OnInit, OnDestroy {
  private readonly api = inject(PainelApi);
  private readonly sessao = inject(SessaoStore);
  private requisicao?: Subscription;
  private readonly chave = `solar.metricas.${this.sessao.usuario()?.id ?? 'sessao'}`;
  readonly abrirPendentes = output<void>();
  readonly f = formatadorMetricas;
  readonly dados = signal<MetricasPainelResponse | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal(false);
  readonly expandido = signal(false);
  readonly supervisor = computed(() => this.sessao.perfil() === 'supervisor');
  readonly tituloIniciadas = computed(() => this.supervisor() ? 'Conversas iniciadas' : 'Conversas atribuídas a você');
  readonly intencoes = computed(() => {
    const i = this.dados()?.leadsPorIntencao;
    return [
      { rotulo: 'Comprar', valor: i?.compra ?? 0, cor: 'var(--marca)' },
      { rotulo: 'Alugar', valor: i?.aluguel ?? 0, cor: 'var(--metrica-alugar)' },
      { rotulo: 'Investir', valor: i?.investimento ?? 0, cor: 'var(--texto-primario)' },
      { rotulo: 'Sem intenção definida', valor: i?.semIntencao ?? 0, cor: 'var(--metrica-sem-intencao)' },
    ];
  });
  readonly totalIntencoes = computed(() => this.intencoes().reduce((s, i) => s + i.valor, 0));
  readonly temperaturas = computed(() => {
    const s = this.dados()?.extras.score;
    return [
      { rotulo: 'Frio · 0–39', valor: s?.frio ?? 0, cor: 'var(--metrica-frio)' },
      { rotulo: 'Morno · 40–69', valor: s?.morno ?? 0, cor: 'var(--metrica-morno)' },
      { rotulo: 'Quente · 70–100', valor: s?.quente ?? 0, cor: 'var(--marca)' },
    ];
  });
  readonly totalScore = computed(() => this.temperaturas().reduce((s, t) => s + t.valor, 0));
  readonly donut = computed(() => {
    const total = this.totalScore();
    if (!total) return 'var(--inativo-borda)';
    const [frio, morno] = this.temperaturas();
    const a = frio.valor * 100 / total;
    const b = a + morno.valor * 100 / total;
    return `conic-gradient(var(--metrica-frio) 0% ${a}%, var(--metrica-morno) ${a}% ${b}%, var(--marca) ${b}% 100%)`;
  });
  readonly equipe = computed(() => this.dados()?.equipe?.atribuidasPorCorretor ?? []);
  readonly totalAtribuidas = computed(() => this.equipe().reduce((s, a) => s + a.conversas, 0));
  readonly maxAtribuidas = computed(() => Math.max(0, ...this.equipe().map(a => a.conversas)));
  readonly maxImoveis = computed(() => Math.max(0, ...this.dados()?.extras.imoveis.map(i => i.conversas) ?? []));
  readonly maxRegioes = computed(() => Math.max(0, ...this.dados()?.extras.regioes.top.map(r => r.leads) ?? []));
  readonly vazio = computed(() => this.dados()?.extras.privacidade.leads === 0 && this.dados()?.conversasIniciadas === 0);

  ngOnInit(): void {
    try { this.expandido.set(localStorage.getItem(this.chave) === '1'); } catch {}
    this.carregar();
  }

  carregar(): void {
    this.requisicao?.unsubscribe();
    this.carregando.set(true);
    this.erro.set(false);
    this.requisicao = this.api.obterMetricas().subscribe({
      next: dados => { this.dados.set(dados); this.carregando.set(false); },
      error: () => { this.erro.set(true); this.carregando.set(false); },
    });
  }

  alternar(): void {
    this.expandido.update(v => !v);
    try { localStorage.setItem(this.chave, this.expandido() ? '1' : '0'); } catch {}
  }

  criterio(tipo: string): string {
    const recorte = this.supervisor()
      ? 'Recorte atual da Visão geral: leads visíveis pela última distribuição de cada lead. '
      : 'Recorte atual de Meus leads: última distribuição de cada lead; só conversas atualmente atribuídas a você e reservas da sua agenda. ';
    const periodo = this.f.plural(this.dados()?.periodo.dias ?? 30, 'dia', 'dias');
    const textos: Record<string, string> = {
      iniciadas: `Cada conversa conta uma vez se sua primeira mensagem do lead ocorreu nos últimos ${periodo}, até a atualização. O “Olá” automático não conta. Redistribuição muda o responsável atual, não a data de início.`,
      confirmadas: `Conversas distintas iniciadas nos últimos ${periodo} com ao menos uma confirmação de horário, sem duplicar mensagens. Confirmar não comprova comparecimento. As reservas dos próximos 7 dias são slots reservados de agora até +7 dias, incluindo os limites; não se limitam às conversas iniciadas no período.`,
      intencao: 'Cada lead distinto conta uma vez pela intenção atual: compra, aluguel, investimento ou sem intenção definida (nula ou indefinida). Inclui todo o recorte, independentemente dos últimos 30 dias.',
      equipe: 'Estado atual por conversa e encaminhamento, sem janela de dias, sem histórico e sem totalizar leads. A redistribuição muda o corretor responsável. Aguardando: encaminhamento ainda sem corretor. Pendentes de aprovação: perfil corretor, vínculo ativo e status em análise, como na aba Novos corretores.',
      score: 'Cada lead distinto do recorte conta uma vez, sem janela de dias. Frio: 0–39; morno: 40–69; quente: 70–100. Nulo fica sem avaliação e fora do denominador dos percentuais. As faixas não mudam a qualificação nem o encaminhamento.',
      regioes: 'Cada lead distinto do recorte conta uma vez, sem janela de dias. Regiões são agrupadas sem diferença de caixa ou acentos. As cinco primeiras são ordenadas por contagem e nome; a sobra aparece em outras regiões. A cobertura usa todos os leads do recorte.',
      imoveis: 'Somente os imóveis sugeridos registrados nas mensagens: id e bairro do snapshot. Cada conversa distinta conta uma vez por imóvel, sem duplicar repetições de mensagens e sem janela de dias. Mostra recomendações da Lia, não interesse do lead.',
      horarios: 'Slots reservados a partir da atualização, incluindo o início; corretor vê somente sua agenda. A lista mostra apenas início e iniciais do corretor, sem lead, e pode incluir reservas além dos próximos 7 dias.',
      privacidade: `Consentimento registrado por lead distinto de todo o recorte, sem janela de dias. Retenção configurada: ${this.f.plural(this.dados()?.extras.privacidade.prazoRetencaoMeses ?? 0, 'mês', 'meses')}. Último contato é a última mensagem do lead em todas as suas conversas; mensagens automáticas não renovam o prazo. Sem mensagem do lead, usa a menor data entre a primeira conversa e a criação do lead; sem conversa, a criação do lead. O expurgo inclui o limite do prazo. Vencem nos próximos 30 dias inclui os limites a partir de agora; próximo vencimento considera prazos ainda não vencidos.`,
    };
    return recorte + textos[tipo];
  }

  ngOnDestroy(): void { this.requisicao?.unsubscribe(); }
}
