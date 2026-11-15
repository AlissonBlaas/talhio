import type { Periodo } from '@talhio/shared';

const DIA_MS = 24 * 60 * 60 * 1000;

const paraData = (dia: string) => new Date(`${dia}T12:00:00Z`);
const paraDia = (data: Date) => data.toISOString().slice(0, 10);

/** Soma `n` dias (pode ser negativo) a um dia AAAA-MM-DD. */
export const somarDias = (dia: string, n: number) => paraDia(new Date(paraData(dia).getTime() + n * DIA_MS));

/** Os dias de `inicio` a `fim`, inclusive. */
export function diasEntre(inicio: string, fim: string): string[] {
  const lista: string[] = [];
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) lista.push(dia);
  return lista;
}

export type Intervalos = {
  /** Dias do período pedido, do mais antigo ao mais novo. */
  atuais: string[];
  /** Dias com que ele é comparado, também do mais antigo ao mais novo. */
  anteriores: string[];
  /** O período termina hoje (ainda está em andamento)? Muda só o texto: "hoje", "últimos 7 dias". */
  emAndamento: boolean;
};

/**
 * Quais dias entram no relatório.
 * - dia: o dia de referência, comparado com o dia antes.
 * - semana: os 7 dias que terminam na referência, comparados com os 7 antes.
 * - mes: o mês de calendário da referência (do dia 1 até a referência, se for o mês de hoje),
 *   comparado com o mês anterior, nos mesmos primeiros dias.
 * `referencia` nunca passa de `hoje`.
 */
export function intervalosDo(periodo: Periodo, referencia: string, hoje: string): Intervalos {
  const ref = referencia > hoje ? hoje : referencia;
  if (periodo === 'dia') return { atuais: [ref], anteriores: [somarDias(ref, -1)], emAndamento: ref === hoje };
  if (periodo === 'semana') return { atuais: diasEntre(somarDias(ref, -6), ref), anteriores: diasEntre(somarDias(ref, -13), somarDias(ref, -7)), emAndamento: ref === hoje };

  const primeiro = `${ref.slice(0, 7)}-01`;
  const mesmoMesDeHoje = ref.slice(0, 7) === hoje.slice(0, 7);
  const ultimoDoMes = (() => {
    const d = paraData(primeiro);
    d.setUTCMonth(d.getUTCMonth() + 1, 0);
    return paraDia(d);
  })();
  const fim = mesmoMesDeHoje ? hoje : ultimoDoMes;
  const atuais = diasEntre(primeiro, fim);
  const mesAntes = (() => {
    const d = paraData(primeiro);
    d.setUTCMonth(d.getUTCMonth() - 1, 1);
    return paraDia(d);
  })();
  return { atuais, anteriores: diasEntre(mesAntes, somarDias(mesAntes, atuais.length - 1)).filter((d) => d.slice(0, 7) === mesAntes.slice(0, 7)), emAndamento: mesmoMesDeHoje };
}
