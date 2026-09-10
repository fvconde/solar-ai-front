import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CorretorIdentificacao, FilaLeadsResponse } from './painel-contrato';

@Injectable({ providedIn: 'root' })
export class PainelApi {
  private readonly http = inject(HttpClient);

  listarCorretores(): Observable<CorretorIdentificacao[]> {
    return this.http.get<CorretorIdentificacao[]>('/painel/corretores');
  }

  listarLeads(
    corretorId: string,
    intencao?: string | null,
    meusLeads?: boolean | null
  ): Observable<FilaLeadsResponse> {
    const headers = new HttpHeaders({
      'X-Corretor-Id': corretorId,
    });

    let params = new HttpParams();
    if (intencao) {
      params = params.set('intencao', intencao);
    }
    if (meusLeads !== null && meusLeads !== undefined) {
      params = params.set('meusLeads', meusLeads.toString());
    }

    return this.http.get<FilaLeadsResponse>('/painel/leads', {
      headers,
      params,
    });
  }
}
