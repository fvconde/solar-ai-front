import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SessaoResponse } from './sessao-contrato';

@Injectable({ providedIn: 'root' })
export class SessaoApi {
  private readonly http = inject(HttpClient);

  obter(): Observable<SessaoResponse> {
    return this.http.get<SessaoResponse>('/api/sessao', { withCredentials: true });
  }

  encerrar(): Observable<void> {
    return this.http.delete<void>('/api/sessao', { withCredentials: true });
  }
}
