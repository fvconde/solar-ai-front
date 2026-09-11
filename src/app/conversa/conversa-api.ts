import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ContatoRequest,
  ContatoResponse,
  ConsentimentoRequest,
  ConsentimentoResponse,
  ConversaResponse,
  MensagemResponse,
  NovaMensagemRequest,
} from './contrato';

@Injectable({ providedIn: 'root' })
export class ConversaApi {
  private readonly http = inject(HttpClient);

  enviarMensagem(conversaId: string, texto: string): Promise<MensagemResponse> {
    const corpo: NovaMensagemRequest = { texto };
    return firstValueFrom(
      this.http.post<MensagemResponse>(`/conversas/${conversaId}/mensagens`, corpo),
    );
  }

  registrarConsentimento(
    conversaId: string,
    dados: ConsentimentoRequest,
  ): Promise<ConsentimentoResponse> {
    return firstValueFrom(
      this.http.post<ConsentimentoResponse>(`/conversas/${conversaId}/consentimento`, dados),
    );
  }

  registrarContato(conversaId: string, dados: ContatoRequest): Promise<ContatoResponse> {
    return firstValueFrom(
      this.http.post<ContatoResponse>(`/conversas/${conversaId}/contato`, dados),
    );
  }

  obterConversa(conversaId: string): Promise<ConversaResponse> {
    return firstValueFrom(this.http.get<ConversaResponse>(`/conversas/${conversaId}`));
  }
}
