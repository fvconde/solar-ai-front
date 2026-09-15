import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { EntrarApi } from '../entrar/entrar-api';
import { CorretorSessao } from '../entrar/entrar-contrato';

@Injectable({ providedIn: 'root' })
export class SessaoStore {
  private readonly api = inject(EntrarApi);
  private restauracao: Observable<CorretorSessao | null> | null = null;

  readonly corretor = signal<CorretorSessao | null>(null);

  restaurar(): Observable<CorretorSessao | null> {
    if (this.corretor()) {
      return of(this.corretor());
    }

    this.restauracao ??= this.api.obterSessao().pipe(
      map((resposta) => resposta.corretor),
      tap((corretor) => this.corretor.set(corretor)),
      catchError(() => {
        this.corretor.set(null);
        return of(null);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.restauracao;
  }

  definir(corretor: CorretorSessao): void {
    this.corretor.set(corretor);
    this.restauracao = of(corretor);
  }

  limpar(): void {
    this.corretor.set(null);
    this.restauracao = null;
  }
}
