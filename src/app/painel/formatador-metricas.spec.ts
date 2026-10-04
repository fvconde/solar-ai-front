import { formatadorMetricas as f } from './formatador-metricas';

describe('Formatador de métricas (S-22)', () => {
  it('mostra contagens sem separador de milhar', () => {
    expect(f.numero(1200)).toBe('1200');
    expect(f.numero(0)).toBe('0');
  });
  it('centraliza plurais inclusive mês irregular', () => {
    expect(f.plural(1, 'conversa', 'conversas')).toBe('1 conversa');
    expect(f.plural(0, 'conversa', 'conversas')).toBe('0 conversas');
    expect(f.plural(2, 'mês', 'meses')).toBe('2 meses');
  });
  it('arredonda percentuais e preserva proporção da largura', () => {
    expect(f.percentual(1, 3)).toBe('33%');
    expect(parseFloat(f.largura(1, 3))).toBeCloseTo(33.333, 2);
    expect(f.percentual(14, 14)).toBe('100%');
  });
  it('denominador zero produz travessão e largura zero', () => {
    expect(f.percentual(0, 0)).toBe('—');
    expect(f.percentual(2, 0)).toBe('—');
    expect(f.largura(2, 0)).toBe('0%');
  });
  it('não produz NaN nem permite barras fora da área', () => {
    expect(f.percentual(NaN, 3)).toBe('—');
    expect(f.numero(Infinity)).toBe('—');
    expect(f.largura(Infinity, 3)).toBe('0%');
    expect(f.largura(-1, 2)).toBe('0%');
    expect(f.largura(5, 2)).toBe('100%');
  });
  it('datas ausentes ou inválidas usam travessão', () => {
    expect(f.data(null)).toBe('—');
    expect(f.data('inválida')).toBe('—');
  });
  it('formata mês, agenda e atualização em português no fuso do navegador', () => {
    expect(f.data('2026-10-15T15:00:00Z', 'mes')).toContain('2026');
    expect(f.data('2026-10-15T15:00:00Z', 'mes')).toContain('out');
    expect(f.data('2026-10-15T15:00:00Z')).toMatch(/15\/10.*\d{2}:\d{2}/);
    expect(f.data('2026-10-15T15:00:00Z', 'horario')).toMatch(/^\d{2}:\d{2}$/);
  });
});
