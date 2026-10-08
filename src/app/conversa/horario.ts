import { SlotOferecido } from './contrato';

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

const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function diaCurto(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '' : `${data.getDate()} ${MESES_CURTOS[data.getMonth()]}`;
}

export function mesEAno(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? ''
    : `${MESES_CURTOS[data.getMonth()]} ${data.getFullYear()}`;
}

export function ehHoje(iso: string, agora = new Date()): boolean {
  return diaDe(iso) === diaDe(agora.toISOString());
}

export interface GrupoDeHorarios {
  dia: string;
  rotulo: string;
  horarios: SlotOferecido[];
}

const TIMEZONE_SP = 'America/Sao_Paulo';

const formatoSpChave = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE_SP,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatoSpSemana = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE_SP,
  weekday: 'long',
});

const formatoSpExtenso = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE_SP,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const formatoSpHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE_SP,
  hourCycle: 'h23',
  hour: 'numeric',
  minute: '2-digit',
});

const formatoSpBloco = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE_SP,
  day: 'numeric',
  month: 'short',
});

export function diaDoAgendamento(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return '';
  }
  const parts = Object.fromEntries(formatoSpChave.formatToParts(data).map((p) => [p.type, p.value]));
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}

export function diaDaSemanaDoAgendamento(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return '';
  }
  const parts = Object.fromEntries(formatoSpSemana.formatToParts(data).map((p) => [p.type, p.value]));
  const weekday = (parts['weekday'] ?? '').replace(/-feira/i, '');
  if (!weekday) {
    return '';
  }
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

export function diaExtensoDoAgendamento(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return '';
  }
  const parts = Object.fromEntries(formatoSpExtenso.formatToParts(data).map((p) => [p.type, p.value]));
  const weekday = (parts['weekday'] ?? '').replace(/-feira/i, '');
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${weekdayCap}, ${parts['day']} de ${parts['month']}`;
}

export function horaDoAgendamento(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return '';
  }
  const parts = Object.fromEntries(formatoSpHora.formatToParts(data).map((p) => [p.type, p.value]));
  const hora = parseInt(parts['hour'] ?? '0', 10);
  const minuto = parts['minute'] ?? '00';
  return minuto === '00' ? `${hora}h` : `${hora}h${minuto}`;
}

export function periodoDoAgendamento(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return '';
  }
  const parts = Object.fromEntries(formatoSpHora.formatToParts(data).map((p) => [p.type, p.value]));
  const hora = parseInt(parts['hour'] ?? '0', 10);
  if (hora < 12) {
    return 'manhã';
  }
  if (hora < 18) {
    return 'tarde';
  }
  return 'noite';
}

export function intervaloDoAgendamento(inicio: string, fim: string): string {
  const hInicio = horaDoAgendamento(inicio);
  const hFim = horaDoAgendamento(fim);
  if (!hInicio || !hFim) {
    return '';
  }
  return `${hInicio} às ${hFim}`;
}

export function dataDoAgendamento(inicio: string, fim: string): string {
  const diaExtenso = diaExtensoDoAgendamento(inicio);
  const intervalo = intervaloDoAgendamento(inicio, fim);
  if (!diaExtenso || !intervalo) {
    return '';
  }
  return `${diaExtenso}, ${intervalo}`;
}

export function blocoDataDoAgendamento(iso: string): { mes: string; dia: string } {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return { mes: '', dia: '' };
  }
  const parts = Object.fromEntries(formatoSpBloco.formatToParts(data).map((p) => [p.type, p.value]));
  const mes = (parts['month'] ?? '').replace(/[^a-zA-Záéíóúâêîôûãõç]/g, '').slice(0, 3).toUpperCase();
  const dia = parts['day'] ?? '';
  return { mes, dia };
}

export function agruparSlotsPorDia(slots: SlotOferecido[]): GrupoDeHorarios[] {
  if (!Array.isArray(slots) || slots.length === 0) {
    return [];
  }

  const validos = slots.filter((s) => {
    if (!s || !s.inicio || !s.fim) {
      return false;
    }
    const tInicio = new Date(s.inicio).getTime();
    const tFim = new Date(s.fim).getTime();
    return !Number.isNaN(tInicio) && !Number.isNaN(tFim);
  });

  const ordenados = [...validos].sort(
    (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
  );

  const grupos: GrupoDeHorarios[] = [];
  const mapa = new Map<string, GrupoDeHorarios>();

  for (const slot of ordenados) {
    const dia = diaDoAgendamento(slot.inicio);
    if (!dia) {
      continue;
    }
    let grupo = mapa.get(dia);
    if (!grupo) {
      grupo = {
        dia,
        rotulo: diaExtensoDoAgendamento(slot.inicio),
        horarios: [],
      };
      mapa.set(dia, grupo);
      grupos.push(grupo);
    }
    grupo.horarios.push(slot);
  }

  return grupos;
}
