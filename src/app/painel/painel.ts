import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CardImovel } from '../componentes/card-imovel';
import { MensagemLia } from '../componentes/mensagem-lia';
import { MensagemPessoa } from '../componentes/mensagem-pessoa';
import { SessaoStore } from '../sessao/sessao-store';
import { AvisoAprovacao } from './aviso-aprovacao';
import { FilaAprovacao } from './fila-aprovacao';
import { PainelApi } from './painel-api';
import { LeadDetalheResponse, LeadPainelItem } from './painel-contrato';
import { PainelEmAnalise } from './painel-em-analise';

@Component({
  selector: 'app-painel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    AvisoAprovacao,
    CardImovel,
    FilaAprovacao,
    MensagemLia,
    MensagemPessoa,
    PainelEmAnalise,
  ],
  templateUrl: './painel.html',
  styleUrls: ['./painel.scss', './painel-detalhe.scss'],
})
export class Painel implements OnInit, OnDestroy {
  private readonly api = inject(PainelApi);
  private readonly sessao = inject(SessaoStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private subParams?: Subscription;

  readonly leads = signal<LeadPainelItem[]>([]);
  readonly totalLeads = signal<number>(0);
  readonly carregandoLeads = signal<boolean>(false);
  readonly erroLeads = signal<string | null>(null);
  readonly acessoRestrito = signal<boolean>(false);

  readonly filtroAtivo = signal<string>('meus_leads');
  readonly intencaoAtiva = signal<string>('');

  readonly leadSelecionadoId = signal<string | null>(null);
  readonly leadDetalhe = signal<LeadDetalheResponse | null>(null);
  readonly carregandoDetalhe = signal<boolean>(false);
  readonly erroDetalhe = signal<string | null>(null);
  readonly gerandoResumo = signal<boolean>(false);

  readonly modalQualificacaoAberto = signal<boolean>(false);

  readonly usuarioNome = computed(() => this.sessao.usuario()?.nome ?? '');
  readonly perfil = computed(() => this.sessao.perfil());
  readonly emAnalise = computed(() => this.sessao.emAnalise());
  readonly corretorAprovado = computed(
    () => this.sessao.perfil() === 'corretor' && this.sessao.statusCorretor() === 'aprovado',
  );
  readonly filtrosPermitidos = computed(() => this.sessao.filtrosPermitidos());

  readonly filtroFixo = computed(() => this.filtrosPermitidos().length === 1);
  readonly temSeletor = computed(() => this.filtrosPermitidos().length > 1);

  readonly perfilRotulo = computed(() => {
    const p = this.sessao.perfil();
    if (p === 'supervisor') {
      return this.sessao.vinculoAtivo()
        ? 'Supervisor · carteira própria'
        : 'Supervisor · sem carteira';
    }
    return 'Corretor';
  });

  readonly rotulosFiltro: Record<string, string> = {
    meus_leads: 'Meus leads',
    minha_fila: 'Minha fila',
    sem_corretor: 'Sem corretor elegível',
    visao_geral: 'Visão geral',
  };

  readonly textoFilaVazia = computed(() => {
    const f = this.filtroAtivo();
    if (f === 'meus_leads') {
      return 'Você não tem leads atribuídos agora. Quando a Lia encaminhar um lead para você, ele aparece aqui.';
    }
    if (f === 'minha_fila') {
      return 'Você não tem leads atribuídos agora.';
    }
    if (f === 'sem_corretor') {
      return 'Nenhum lead sem corretor elegível agora.';
    }
    return 'Nenhum lead corresponde aos filtros atuais.';
  });

  readonly resumoAusente = computed(() => {
    const r = this.leadDetalhe()?.resumo;
    if (!r) return true;
    return !r.perfil && !r.orcamento && !r.imoveis && !r.objecoes && !r.proximoPasso;
  });

  readonly totalPontosQualificacao = computed(() => {
    const fatores = this.leadDetalhe()?.qualificacao?.fatores ?? [];
    return fatores.reduce((soma, f) => soma + (f.preenchido ? f.pontos : 0), 0);
  });

  ngOnInit(): void {
    if (this.emAnalise()) {
      return;
    }

    this.subParams = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.leadSelecionadoId.set(id);
        this.carregarDetalheLead(id);
      } else {
        this.leadSelecionadoId.set(null);
        this.leadDetalhe.set(null);
      }
    });

    const queryFiltro = this.route.snapshot.queryParamMap.get('filtro');
    const inicial =
      queryFiltro || this.sessao.filtroInicial() || this.filtrosPermitidos()[0] || 'meus_leads';
    this.filtroAtivo.set(inicial);

    this.carregarLeads();
  }

  ngOnDestroy(): void {
    this.subParams?.unsubscribe();
  }

  selecionarFiltro(filtro: string): void {
    this.filtroAtivo.set(filtro);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filtro: filtro === this.sessao.filtroInicial() ? null : filtro },
      queryParamsHandling: 'merge',
    });
    this.carregarLeads();
  }

  carregarLeads(): void {
    if (this.filtrosPermitidos().length === 0 && this.sessao.perfil() !== null) {
      this.acessoRestrito.set(true);
      return;
    }

    this.carregandoLeads.set(true);
    this.erroLeads.set(null);

    this.api.listarLeads(this.filtroAtivo() || null, this.intencaoAtiva() || null).subscribe({
      next: (resp) => {
        this.leads.set(resp.itens ?? []);
        this.totalLeads.set(resp.total ?? resp.itens?.length ?? 0);
        this.carregandoLeads.set(false);
        this.acessoRestrito.set(false);
      },
      error: (err) => {
        this.carregandoLeads.set(false);
        this.leads.set([]);

        if (err?.status === 401) {
          this.sessao.limpar();
          this.router.navigate(['/entrar']);
          return;
        }

        if (err?.status === 403) {
          this.acessoRestrito.set(true);
          return;
        }

        this.erroLeads.set('Não foi possível carregar a fila de leads. Tente novamente.');
      },
    });
  }

  selecionarLead(lead: LeadPainelItem): void {
    this.leadSelecionadoId.set(lead.id);
    this.carregarDetalheLead(lead.id);
    this.router.navigate(['/painel/leads', lead.id], {
      queryParams: { filtro: this.filtroAtivo() || undefined },
    });
  }

  voltarParaFila(): void {
    this.leadSelecionadoId.set(null);
    this.leadDetalhe.set(null);
    this.router.navigate(['/painel'], {
      queryParams: { filtro: this.filtroAtivo() || undefined },
    });
  }

  voltarParaMeusLeads(): void {
    this.acessoRestrito.set(false);
    this.filtroAtivo.set('meus_leads');
    this.router.navigate(['/painel'], { queryParams: { filtro: null } });
    this.carregarLeads();
  }

  carregarDetalheLead(id: string): void {
    this.carregandoDetalhe.set(true);
    this.erroDetalhe.set(null);

    this.api.obterDetalheLead(id).subscribe({
      next: (detalhe) => {
        this.leadDetalhe.set(detalhe);
        this.carregandoDetalhe.set(false);
      },
      error: (err) => {
        this.carregandoDetalhe.set(false);
        this.leadDetalhe.set(null);

        if (err?.status === 401) {
          this.sessao.limpar();
          this.router.navigate(['/entrar']);
          return;
        }

        if (err?.status === 404) {
          this.erroDetalhe.set('Lead não encontrado.');
          return;
        }

        this.erroDetalhe.set('Não foi possível carregar o detalhe do lead.');
      },
    });
  }

  gerarResumoDeNovo(): void {
    const encId = this.leadDetalhe()?.encaminhamento?.id;
    if (!encId) return;

    const forcar = this.leadDetalhe()?.resumo !== null && this.leadDetalhe()?.resumo !== undefined;
    this.gerandoResumo.set(true);

    this.api.gerarResumo(encId, forcar).subscribe({
      next: (novoResumo) => {
        this.gerandoResumo.set(false);
        if (this.leadDetalhe()) {
          this.leadDetalhe.update((detalhe) =>
            detalhe ? { ...detalhe, resumo: novoResumo } : null,
          );
        }
      },
      error: () => {
        this.gerandoResumo.set(false);
      },
    });
  }

  abrirModalQualificacao(): void {
    this.modalQualificacaoAberto.set(true);
  }

  fecharModalQualificacao(): void {
    this.modalQualificacaoAberto.set(false);
  }

  formatarNomeLead(nomeExibicao: string | null, referencia: string): string {
    return nomeExibicao?.trim() ? nomeExibicao : `Lead sem nome · ${referencia}`;
  }

  formatarTempoRelativo(dataIso: string, comCriado = true): string {
    if (!dataIso) return '';
    const prefixo = comCriado ? 'Criado há ' : 'atribuído há ';
    try {
      const agora = Date.now();
      const data = new Date(dataIso).getTime();
      if (isNaN(data)) return dataIso;
      const diffMs = Math.max(0, agora - data);
      const minutos = Math.floor(diffMs / 60000);
      if (minutos < 1) {
        return comCriado ? 'Criado agora' : 'atribuído agora';
      }
      if (minutos < 60) {
        return `${prefixo}${minutos} min`;
      }
      const horas = Math.floor(minutos / 60);
      if (horas < 24) {
        return `${prefixo}${horas} h`;
      }
      const dias = Math.floor(horas / 24);
      return `${prefixo}${dias} d`;
    } catch {
      return dataIso;
    }
  }

  formatarDataHora(dataIso: string): string {
    if (!dataIso) return '';
    try {
      const d = new Date(dataIso);
      if (isNaN(d.getTime())) return dataIso;
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const hora = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}, ${hora}:${min}`;
    } catch {
      return dataIso;
    }
  }

  formatarHora(dataIso: string): string {
    if (!dataIso) return '';
    try {
      const d = new Date(dataIso);
      if (isNaN(d.getTime())) return dataIso;
      const hora = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${hora}:${min}`;
    } catch {
      return dataIso;
    }
  }

  linhaEncaminhamento(detalhe: LeadDetalheResponse): string {
    const enc = detalhe.encaminhamento;
    if (!enc || !enc.corretor) {
      return '';
    }
    const tempo = this.formatarTempoRelativo(enc.atribuidoEm, false);
    return `${enc.corretor.nome} · ${tempo}`;
  }
}
