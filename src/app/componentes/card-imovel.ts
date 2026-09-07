import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ImovelSugerido } from '../conversa/contrato';
import { reais } from '../conversa/horario';

@Component({
  selector: 'app-card-imovel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <span class="cabeca">{{ imovel().tipo }} · {{ imovel().bairro }}</span>
      <span class="preco">{{ preco().valor }}<span class="sufixo">{{ preco().sufixo }}</span></span>
      <span class="dados">{{ dados() }}</span>
      <p class="motivo">{{ imovel().motivo }}</p>
    </article>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      width: 560px;
      max-width: 100%;
      padding: 20px 22px;
      background: var(--superficie-elevada);
      border: 1px solid var(--borda-componente);
      border-radius: var(--raio-card);
    }

    .cabeca {
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--texto-secundario);
    }

    .preco {
      margin-top: 10px;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.015em;
      line-height: 1.1;
      color: var(--texto-primario);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .sufixo {
      font-size: 17px;
      font-weight: 500;
      letter-spacing: 0;
    }

    .dados {
      margin-top: 8px;
      font-size: 16px;
      line-height: 1.5;
      color: var(--texto-primario);
      font-variant-numeric: tabular-nums;
    }

    .motivo {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--borda-divisor-card);
      font-size: 16px;
      line-height: 1.55;
      color: var(--texto-primario);
    }
  `,
})
export class CardImovel {
  readonly imovel = input.required<ImovelSugerido>();

  protected readonly preco = computed(() => {
    const item = this.imovel();
    if (item.precoAluguel != null) {
      return { valor: reais(item.precoAluguel), sufixo: '/mês' };
    }
    if (item.precoVenda != null) {
      return { valor: reais(item.precoVenda), sufixo: '' };
    }
    return { valor: 'Sob consulta', sufixo: '' };
  });

  protected readonly dados = computed(() => {
    const item = this.imovel();
    const quartos = `${item.quartos} ${item.quartos === 1 ? 'quarto' : 'quartos'}`;
    return `${quartos} · ${item.metragem} m²`;
  });
}
