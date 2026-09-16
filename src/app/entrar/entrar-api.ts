import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CorretorSessao,
  IdentificacaoResposta,
  RecuperacaoResposta,
  SessaoResposta,
} from './entrar-contrato';

@Injectable({ providedIn: 'root' })
export class EntrarApi {
  private readonly http = inject(HttpClient);

  identificar(email: string): Observable<IdentificacaoResposta> {
    return this.http.post<IdentificacaoResposta>(
      '/api/painel/identificacao',
      { email },
      { withCredentials: true }
    );
  }

  criarSessao(email: string, senha: string): Observable<SessaoResposta> {
    return this.http.post<SessaoResposta>(
      '/api/painel/sessoes',
      { email, senha },
      { withCredentials: true }
    );
  }

  obterSessao(): Observable<SessaoResposta> {
    return this.http.get<SessaoResposta>('/api/painel/sessao', { withCredentials: true });
  }

  pedirRecuperacao(email: string): Observable<void> {
    return this.http.post<void>(
      '/api/painel/senha/recuperacoes',
      { email },
      { withCredentials: true }
    );
  }

  validarRecuperacao(token: string): Observable<RecuperacaoResposta> {
    return this.http.get<RecuperacaoResposta>(
      `/api/painel/senha/recuperacoes/${encodeURIComponent(token)}`,
      { withCredentials: true }
    );
  }

  salvarSenha(token: string, novaSenha: string): Observable<SessaoResposta> {
    return this.http.post<SessaoResposta>(
      '/api/painel/senha',
      { token, novaSenha },
      { withCredentials: true }
    );
  }
}

export type { CorretorSessao };
