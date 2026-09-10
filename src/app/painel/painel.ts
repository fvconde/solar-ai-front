import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PainelApi } from './painel-api';
import { CorretorIdentificacao, LeadPainelItem } from './painel-contrato';

@Component({
  selector: 'app-painel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
})
export class Painel {
  private readonly api = inject(PainelApi);

  readonly chaveAcesso = signal<string>('');
  readonly corretores = signal<CorretorIdentificacao[]>([]);
  readonly corretorAtivo = signal<CorretorIdentificacao | null>(null);
  readonly carregandoCorretores = signal<boolean>(false);
  readonly erroAutenticacao = signal<string | null>(null);

  readonly leads = signal<LeadPainelItem[]>([]);
  readonly carregandoLeads = signal<boolean>(false);
  readonly erroLeads = signal<string | null>(null);

  readonly filtroIntencao = signal<string>('');
  readonly filtroMeusLeads = signal<boolean>(false);

  readonly intencoesDisponiveis = [
    { rotulo: 'Todas as intenções', valor: '' },
    { rotulo: 'Compra', valor: 'compra' },
    { rotulo: 'Aluguel', valor: 'aluguel' },
    { rotulo: 'Investimento', valor: 'investimento' },
  ];

  autenticarChave(): void {
    const chave = this.chaveAcesso().trim();
    if (!chave) {
      this.erroAutenticacao.set('Informe a chave de acesso da equipe / privacidade.');
      return;
    }

    this.carregandoCorretores.set(true);
    this.erroAutenticacao.set(null);

    this.api.listarCorretores(chave).subscribe({
      next: (lista) => {
        this.corretores.set(lista);
        this.carregandoCorretores.set(false);
      },
      error: (err) => {
        this.carregandoCorretores.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.erroAutenticacao.set('Chave de acesso inválida ou não autorizada.');
        } else if (err?.status === 503) {
          this.erroAutenticacao.set('Chave de segurança não configurada no servidor (falha fechada).');
        } else {
          this.erroAutenticacao.set('Não foi possível validar o acesso ao painel.');
        }
      },
    });
  }

  identificarCorretor(corretor: CorretorIdentificacao): void {
    this.corretorAtivo.set(corretor);
    this.carregarLeads();
  }

  deslogarCorretor(): void {
    this.corretorAtivo.set(null);
    this.leads.set([]);
    this.erroLeads.set(null);
  }

  alternarFiltroMeusLeads(): void {
    this.filtroMeusLeads.update((v) => !v);
    this.carregarLeads();
  }

  mudarFiltroIntencao(intencao: string): void {
    this.filtroIntencao.set(intencao);
    this.carregarLeads();
  }

  carregarLeads(): void {
    const corretor = this.corretorAtivo();
    const chave = this.chaveAcesso().trim();
    if (!corretor || !chave) {
      this.leads.set([]);
      return;
    }

    this.carregandoLeads.set(true);
    this.erroLeads.set(null);

    this.api
      .listarLeads(
        chave,
        corretor.id,
        this.filtroIntencao() || null,
        this.filtroMeusLeads()
      )
      .subscribe({
        next: (resp) => {
          this.leads.set(resp.leads);
          this.carregandoLeads.set(false);
        },
        error: (err) => {
          this.carregandoLeads.set(false);
          this.erroLeads.set(
            err?.status === 401 || err?.status === 403
              ? 'Acesso não autorizado. Identifique-se novamente.'
              : 'Não foi possível carregar a fila de leads.'
          );
        },
      });
  }

  formatarData(dataIso: string): string {
    if (!dataIso) return '-';
    try {
      const data = new Date(dataIso);
      return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dataIso;
    }
  }

  classeScore(score: number | null): string {
    if (score === null || score === undefined) return 'score-indefinido';
    if (score >= 80) return 'score-alto';
    if (score >= 50) return 'score-medio';
    return 'score-baixo';
  }
}
