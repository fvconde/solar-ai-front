const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formatoMilhar = new Intl.NumberFormat('pt-BR');
const formatoDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
const formatoDiaComAno = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const HOJE = 'Hoje';

export function horaAgora(): string {
  return formatoHora.format(new Date());
}

export function horaDe(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '' : formatoHora.format(data);
}

/** Chave de dia no fuso local — o divisor separa por dia de calendario, nao por 24h. */
export function diaDe(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return '';
  }
  return `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
}

export function rotuloDeDia(iso: string, agora = new Date()): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return HOJE;
  }

  const chave = diaDe(iso);
  if (chave === diaDe(agora.toISOString())) {
    return HOJE;
  }

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (chave === diaDe(ontem.toISOString())) {
    return 'Ontem';
  }

  return data.getFullYear() === agora.getFullYear()
    ? formatoDia.format(data)
    : formatoDiaComAno.format(data);
}

export function reais(valor: number): string {
  return `R$ ${formatoMilhar.format(valor)}`;
}
