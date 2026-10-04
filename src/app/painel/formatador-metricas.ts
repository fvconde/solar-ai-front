export const formatadorMetricas = {
  numero(valor: number): string {
    return Number.isFinite(valor) ? String(Math.trunc(valor)) : '—';
  },
  plural(valor: number, singular: string, plural: string): string {
    return `${this.numero(valor)} ${valor === 1 ? singular : plural}`;
  },
  percentual(valor: number, total: number): string {
    return total > 0 && Number.isFinite(valor / total)
      ? `${Math.round((valor * 100) / total)}%`
      : '—';
  },
  largura(valor: number, total: number): string {
    return total > 0 && Number.isFinite(valor / total)
      ? `${Math.min(100, Math.max(0, (valor * 100) / total))}%`
      : '0%';
  },
  data(valor: string | null, formato: 'horario' | 'agenda' | 'mes' = 'agenda'): string {
    if (!valor || !Number.isFinite(Date.parse(valor))) return '—';
    const opcoes: Intl.DateTimeFormatOptions = formato === 'mes'
      ? { month: 'short', year: 'numeric' }
      : formato === 'horario'
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(valor));
  },
};
