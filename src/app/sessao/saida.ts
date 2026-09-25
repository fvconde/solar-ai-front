import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Avisos } from '../componentes/aviso-flutuante';
import { ConversaStore } from '../conversa/conversa-store';
import { SessaoStore } from './sessao-store';

@Injectable({ providedIn: 'root' })
export class Saida {
  private readonly sessao = inject(SessaoStore);
  private readonly conversa = inject(ConversaStore);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);

  sair(): void {
    this.sessao.sair().subscribe(() => this.concluir('Você saiu da sua conta'));
  }

  contaExcluida(): void {
    this.sessao.limpar();
    this.concluir('Sua conta foi excluída');
  }

  private concluir(aviso: string): void {
    void this.conversa.definirConsentimentoDaConta(null);
    void this.conversa.novaConversa();
    this.avisos.mostrar(aviso);
    void this.router.navigate(['/']);
  }
}
