import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  FilaLeadsResponse,
  LeadDetalheResponse,
  ResumoLia,
  SessaoPainelResposta,
} from './painel-contrato';

@Injectable({ providedIn: 'root' })
export class PainelApi {
  private readonly http = inject(HttpClient);

  obterSessao(): Observable<SessaoPainelResposta> {
    return this.http.get<SessaoPainelResposta>('/api/painel/sessao', {
      withCredentials: true,
    });
  }

  listarLeads(filtro?: string | null, intencao?: string | null): Observable<FilaLeadsResponse> {
    let params = new HttpParams();
    if (filtro) {
      params = params.set('filtro', filtro);
    }
    if (intencao) {
      params = params.set('intencao', intencao);
    }

    return this.http.get<FilaLeadsResponse>('/api/painel/leads', {
      params,
      withCredentials: true,
    });
  }

  obterDetalheLead(id: string): Observable<LeadDetalheResponse> {
    return this.http.get<LeadDetalheResponse>(`/api/painel/leads/${encodeURIComponent(id)}`, {
      withCredentials: true,
    });
  }

  gerarResumo(encaminhamentoId: number, forcar: boolean): Observable<ResumoLia> {
    let params = new HttpParams();
    if (forcar) {
      params = params.set('forcar', 'true');
    }

    return this.http.post<ResumoLia>(
      `/encaminhamentos/${encaminhamentoId}/resumo`,
      {},
      {
        params,
        withCredentials: true,
      },
    );
  }
}
