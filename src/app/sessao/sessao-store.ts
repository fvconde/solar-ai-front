import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { EntrarApi } from '../entrar/entrar-api';
import { CorretorSessao, SessaoResposta } from '../entrar/entrar-contrato';

export type DefinirSessaoPayload = SessaoResposta | CorretorSessao;

@Injectable({ providedIn: 'root' })
export class SessaoStore {
  private readonly api = inject(EntrarApi);
  private restauracao: Observable<CorretorSessao | null> | null = null;

  readonly corretor = signal<CorretorSessao | null>(null);
  readonly perfil = signal<'corretor' | 'supervisor' | null>(null);
  readonly corretorId = signal<string | null>(null);
  readonly vinculoAtivo = signal<boolean>(false);
  readonly filtrosPermitidos = signal<string[]>([]);
  readonly filtroInicial = signal<string | null>(null);

  restaurar(): Observable<CorretorSessao | null> {
    if (this.corretor()) {
      return of(this.corretor());
    }

    this.restauracao ??= this.api.obterSessao().pipe(
      tap((resposta) => this.aplicarDados(resposta)),
      map((resposta) => resposta.corretor),
      catchError(() => {
        this.limpar();
        return of(null);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.restauracao;
  }

  definir(dados: DefinirSessaoPayload): void {
    if ('id' in dados && 'especialidade' in dados) {
      const c = dados as CorretorSessao;
      this.aplicarDados({
        corretor: c,
        perfil: 'corretor',
        corretorId: c.id,
        vinculoAtivo: true,
        filtrosPermitidos: ['meus_leads'],
        filtroInicial: 'meus_leads',
      });
      this.restauracao = of(c);
    } else {
      const resp = dados as SessaoResposta;
      this.aplicarDados(resp);
      this.restauracao = of(resp.corretor);
    }
  }

  limpar(): void {
    this.corretor.set(null);
    this.perfil.set(null);
    this.corretorId.set(null);
    this.vinculoAtivo.set(false);
    this.filtrosPermitidos.set([]);
    this.filtroInicial.set(null);
    this.restauracao = null;
  }

  private aplicarDados(dados: SessaoResposta | null): void {
    if (!dados) {
      this.limpar();
      return;
    }

    this.corretor.set(dados.corretor);
    this.perfil.set(dados.perfil ?? 'corretor');
    this.corretorId.set(
      dados.corretorId !== undefined ? dados.corretorId : (dados.corretor?.id ?? null),
    );
    this.vinculoAtivo.set(dados.vinculoAtivo ?? true);
    this.filtrosPermitidos.set(dados.filtrosPermitidos ?? ['meus_leads']);
    this.filtroInicial.set(dados.filtroInicial ?? 'meus_leads');
  }
}
