import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ImovelSugerido } from '../conversa/contrato';
import { reais } from '../conversa/horario';

const SOB_CONSULTA = { valor: 'Sob consulta', sufixo: '' };

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
  readonly intencao = input<string | null>(null);

  /**
   * Quem quer comprar precisa ver o valor de venda. Quase todo imovel da base
   * tem os dois precos, entao preferir o aluguel sempre mostrava R$ 2.200/mes
   * para quem acabou de dizer "ate 600 mil".
   */
  protected readonly preco = computed(() => {
    const item = this.imovel();
    const aluguel = { valor: reais(item.precoAluguel ?? 0), sufixo: '/mês' };
    const venda = { valor: reais(item.precoVenda ?? 0), sufixo: '' };

    if (this.intencao() === 'aluguel') {
      return item.precoAluguel != null ? aluguel : item.precoVenda != null ? venda : SOB_CONSULTA;
    }

    return item.precoVenda != null ? venda : item.precoAluguel != null ? aluguel : SOB_CONSULTA;
  });

  protected readonly dados = computed(() => {
    const item = this.imovel();
    const quartos = `${item.quartos} ${item.quartos === 1 ? 'quarto' : 'quartos'}`;
    return `${quartos} · ${item.metragem} m²`;
  });
}
