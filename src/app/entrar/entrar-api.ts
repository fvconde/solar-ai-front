import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SessaoResponse } from '../sessao/sessao-contrato';
import { RecuperacaoResposta } from './entrar-contrato';

@Injectable({ providedIn: 'root' })
export class EntrarApi {
  private readonly http = inject(HttpClient);

  criarSessao(email: string, senha: string, conversaId: string | null): Observable<SessaoResponse> {
    const corpo = conversaId ? { email, senha, conversaId } : { email, senha };
    return this.http.post<SessaoResponse>('/api/sessoes', corpo, { withCredentials: true });
  }

  pedirRecuperacao(email: string): Observable<void> {
    return this.http.post<void>('/api/senha/recuperacoes', { email }, { withCredentials: true });
  }

  validarRecuperacao(token: string): Observable<RecuperacaoResposta> {
    return this.http.get<RecuperacaoResposta>(
      `/api/senha/recuperacoes/${encodeURIComponent(token)}`,
      { withCredentials: true },
    );
  }

  salvarSenha(token: string, novaSenha: string): Observable<SessaoResponse> {
    return this.http.post<SessaoResponse>(
      '/api/senha',
      { token, novaSenha },
      { withCredentials: true },
    );
  }
}
