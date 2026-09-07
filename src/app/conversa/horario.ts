const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formatoMilhar = new Intl.NumberFormat('pt-BR');

export function horaAgora(): string {
  return formatoHora.format(new Date());
}

export function horaDe(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '' : formatoHora.format(data);
}

export function reais(valor: number): string {
  return `R$ ${formatoMilhar.format(valor)}`;
}
