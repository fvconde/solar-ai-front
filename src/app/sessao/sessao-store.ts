import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { SessaoApi } from './sessao-api';
import { Perfil, SessaoResponse, StatusCorretor, UsuarioSessao } from './sessao-contrato';

export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) {
    return '';
  }
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

export function primeiroNomeDe(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

@Injectable({ providedIn: 'root' })
export class SessaoStore {
  private readonly api = inject(SessaoApi);
  private restauracao: Observable<SessaoResponse | null> | null = null;

  readonly usuario = signal<UsuarioSessao | null>(null);
  readonly perfil = signal<Perfil | null>(null);
  readonly statusCorretor = signal<StatusCorretor | null>(null);
  readonly corretorId = signal<string | null>(null);
  readonly vinculoAtivo = signal<boolean>(false);
  readonly filtrosPermitidos = signal<string[]>([]);
  readonly filtroInicial = signal<string | null>(null);
  readonly pendentesAprovacao = signal<number | null>(null);

  readonly ativa = computed(() => this.usuario() !== null);
  readonly temPainel = computed(
    () => this.perfil() === 'corretor' || this.perfil() === 'supervisor',
  );
  readonly emAnalise = computed(
    () => this.perfil() === 'corretor' && this.statusCorretor() === 'em_analise',
  );
  readonly primeiroNome = computed(() => primeiroNomeDe(this.usuario()?.nome ?? ''));
  readonly iniciais = computed(() => iniciaisDe(this.usuario()?.nome ?? ''));

  restaurar(): Observable<SessaoResponse | null> {
    this.restauracao ??= this.api.obter().pipe(
      tap((resposta) => this.aplicar(resposta)),
      catchError(() => {
        this.limpar();
        return of(null);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.restauracao;
  }

  definir(resposta: SessaoResponse): void {
    this.aplicar(resposta);
    this.restauracao = of(resposta);
  }

  atualizarUsuario(dados: Pick<UsuarioSessao, 'nome' | 'email'>): void {
    const atual = this.usuario();
    if (atual) {
      this.usuario.set({ ...atual, ...dados });
    }
  }

  descontarPendente(): void {
    const atual = this.pendentesAprovacao();
    if (atual !== null) {
      this.pendentesAprovacao.set(Math.max(atual - 1, 0));
    }
  }

  sair(): Observable<void> {
    return this.api.encerrar().pipe(
      catchError(() => of(undefined)),
      map(() => this.limpar()),
    );
  }

  limpar(): void {
    this.usuario.set(null);
    this.perfil.set(null);
    this.statusCorretor.set(null);
    this.corretorId.set(null);
    this.vinculoAtivo.set(false);
    this.filtrosPermitidos.set([]);
    this.filtroInicial.set(null);
    this.pendentesAprovacao.set(null);
    this.restauracao = of(null);
  }

  private aplicar(dados: SessaoResponse): void {
    this.usuario.set(dados.usuario);
    this.perfil.set(dados.perfil);
    this.statusCorretor.set(dados.statusCorretor);
    this.corretorId.set(dados.corretorId);
    this.vinculoAtivo.set(dados.vinculoAtivo);
    this.filtrosPermitidos.set(dados.filtrosPermitidos ?? []);
    this.filtroInicial.set(dados.filtroInicial);
    this.pendentesAprovacao.set(dados.pendentesAprovacao);
  }
}
