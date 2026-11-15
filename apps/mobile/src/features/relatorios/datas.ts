import type { Periodo } from '@talhio/shared';

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const paraIso = (d: Date) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

export const hojeIso = () => paraIso(new Date());

/**
 * Anda um período para trás (-1) ou para frente (+1): um dia, 7 dias ou um mês.
 * Devolve null quando chega em hoje (ou no mês atual): null significa "o período corrente", sem data fixa.
 */
export function mover(data: string | null, periodo: Periodo, passo: -1 | 1): string | null {
  const hoje = hojeIso();
  const base = new Date(`${data ?? hoje}T12:00:00`);
  if (periodo === 'mes') {
    base.setDate(1);
    base.setMonth(base.getMonth() + passo);
  } else {
    base.setDate(base.getDate() + passo * (periodo === 'semana' ? 7 : 1));
  }
  const novo = paraIso(base);
  const alcancouHoje = periodo === 'mes' ? novo.slice(0, 7) >= hoje.slice(0, 7) : novo >= hoje;
  return alcancouHoje ? null : novo;
}
