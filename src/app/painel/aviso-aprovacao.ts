import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ContaApi } from '../conta/conta-api';

const CHAVE_APROVACAO_VISTA = 'solar.aprovacaoVista';

@Component({
  selector: 'app-aviso-aprovacao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visivel()) {
      <p class="aviso-ok" role="status">
        <span><b>Cadastro aprovado.</b> Seus primeiros leads já estão aqui.</span>
        <button class="fechar" type="button" aria-label="Fechar" (click)="visivel.set(false)">
          ✕
        </button>
      </p>
    }
  `,
  styles: `
    .aviso-ok {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 16px 28px 0;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14.5px;
      color: var(--sucesso);
      background: color-mix(in srgb, var(--sucesso) 14%, var(--superficie-elevada));
    }

    .fechar {
      margin-left: auto;
      padding: 0 4px;
      font-size: 13px;
      color: var(--texto-secundario);
      background: none;
      border: none;
      cursor: pointer;
    }
  `,
})
export class AvisoAprovacao implements OnInit {
  private readonly api = inject(ContaApi);

  readonly visivel = signal(false);

  ngOnInit(): void {
    this.api.obter().subscribe({
      next: (conta) => {
        const vistos = lerLocal(CHAVE_APROVACAO_VISTA)?.split(',') ?? [];
        if (!conta.corretor?.aprovadoEm || vistos.includes(conta.id)) {
          return;
        }
        gravarLocal(CHAVE_APROVACAO_VISTA, [...vistos, conta.id].join(','));
        this.visivel.set(true);
      },
      error: () => undefined,
    });
  }
}

function lerLocal(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarLocal(chave: string, valor: string): void {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    return;
  }
}
