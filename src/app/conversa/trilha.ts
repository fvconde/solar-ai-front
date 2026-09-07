import { ImovelSugerido } from './contrato';

export type EstadoConversa =
  | 'aceite-pendente'
  | 'aceite-recusado'
  | 'conversando'
  | 'preparando'
  | 'espera-prolongada'
  | 'falha'
  | 'encerrada';

export type VarianteEvento = 'neutro' | 'sucesso' | 'atencao' | 'erro';

export type TipoAcao = 'rever-escolha' | 'tentar-novamente' | 'nova-conversa';

export interface AcaoEvento {
  rotulo: string;
  tipo: TipoAcao;
}

export interface ItemDivisor {
  tipo: 'divisor';
  id: string;
  rotulo: string;
}

export interface ItemLia {
  tipo: 'lia';
  id: string;
  texto: string;
  hora: string;
  imoveis: ImovelSugerido[];
}

export interface ItemPessoa {
  tipo: 'pessoa';
  id: string;
  texto: string;
  hora: string;
}

export interface ItemEvento {
  tipo: 'evento';
  id: string;
  variante: VarianteEvento;
  rotulo: string;
  texto: string;
  acao: AcaoEvento | null;
}

export type ItemTrilha = ItemDivisor | ItemLia | ItemPessoa | ItemEvento;
