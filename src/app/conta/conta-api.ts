import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SessaoResponse } from '../sessao/sessao-contrato';
import {
  CadastroClienteRequest,
  CadastroCorretorRequest,
  ContaResponse,
  ConversaResumo,
  EdicaoContaRequest,
} from './conta-contrato';

@Injectable({ providedIn: 'root' })
export class ContaApi {
  private readonly http = inject(HttpClient);

  cadastrarCliente(corpo: CadastroClienteRequest): Observable<SessaoResponse> {
    return this.http.post<SessaoResponse>('/api/contas', corpo, { withCredentials: true });
  }

  cadastrarCorretor(corpo: CadastroCorretorRequest): Observable<SessaoResponse> {
    return this.http.post<SessaoResponse>('/api/corretores', corpo, { withCredentials: true });
  }

  obter(): Observable<ContaResponse> {
    return this.http.get<ContaResponse>('/api/conta', { withCredentials: true });
  }

  editar(corpo: EdicaoContaRequest): Observable<ContaResponse> {
    return this.http.patch<ContaResponse>('/api/conta', corpo, { withCredentials: true });
  }

  alterarSenha(senhaAtual: string, novaSenha: string): Observable<void> {
    return this.http.post<void>(
      '/api/conta/senha',
      { senhaAtual, novaSenha },
      { withCredentials: true },
    );
  }

  excluir(email: string): Observable<void> {
    return this.http.delete<void>('/api/conta', { body: { email }, withCredentials: true });
  }

  listarConversas(): Observable<ConversaResumo[]> {
    return this.http.get<ConversaResumo[]>('/api/conta/conversas', { withCredentials: true });
  }
}
