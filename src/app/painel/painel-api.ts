import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FilaLeadsResponse } from './painel-contrato';

@Injectable({ providedIn: 'root' })
export class PainelApi {
  private readonly http = inject(HttpClient);

  listarLeads(intencao?: string | null, meusLeads?: boolean | null): Observable<FilaLeadsResponse> {
    let params = new HttpParams();
    if (intencao) {
      params = params.set('intencao', intencao);
    }
    if (meusLeads !== null && meusLeads !== undefined) {
      params = params.set('meusLeads', meusLeads.toString());
    }

    return this.http.get<FilaLeadsResponse>('/painel/leads', {
      params,
      withCredentials: true,
    });
  }
}
