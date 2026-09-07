import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
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

  obterConversa(conversaId: string): Promise<ConversaResponse> {
    return firstValueFrom(this.http.get<ConversaResponse>(`/conversas/${conversaId}`));
  }
}
