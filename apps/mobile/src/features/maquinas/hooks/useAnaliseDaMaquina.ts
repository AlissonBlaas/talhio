import { useQuery } from '@tanstack/react-query';

import { maquinasApi } from '../api/maquinasApi';
import { maquinasKeys } from '../maquinas.keys';

export type PeriodoDaAnalise = 'hoje' | 'ontem' | '7dias' | '30dias';

export const PERIODOS_DA_ANALISE: { id: PeriodoDaAnalise; rotulo: string }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'ontem', rotulo: 'Ontem' },
  { id: '7dias', rotulo: '7 dias' },
  { id: '30dias', rotulo: '30 dias' },
];

const diaDeBrasilia = (data: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data);
const DIA_MS = 86_400_000;

/** Primeiro e último dia (AAAA-MM-DD, horário de Brasília) de cada período. "7 dias" e "30 dias" terminam hoje. */
export function intervaloDoPeriodo(periodo: PeriodoDaAnalise, agora: Date = new Date()): { de: string; ate: string } {
  const hoje = diaDeBrasilia(agora);
  switch (periodo) {
    case 'hoje':
      return { de: hoje, ate: hoje };
    case 'ontem': {
      const ontem = diaDeBrasilia(new Date(agora.getTime() - DIA_MS));
      return { de: ontem, ate: ontem };
    }
    case '7dias':
      return { de: diaDeBrasilia(new Date(agora.getTime() - 6 * DIA_MS)), ate: hoje };
    case '30dias':
      return { de: diaDeBrasilia(new Date(agora.getTime() - 29 * DIA_MS)), ate: hoje };
  }
}

/** Todos os dados da máquina (Analisador da Máquina) no período. Hoje atualiza a cada minuto; dia passado não muda. */
export function useAnaliseDaMaquina(id: string, periodo: PeriodoDaAnalise, habilitado = true) {
  const { de, ate } = intervaloDoPeriodo(periodo);
  const query = useQuery({
    queryKey: maquinasKeys.analise(id, de, ate),
    queryFn: () => maquinasApi.analise(id, de, ate),
    enabled: habilitado,
    staleTime: periodo === 'hoje' ? 60_000 : 10 * 60_000,
    retry: 1,
  });
  return { analise: query.data ?? null, carregando: query.isPending && habilitado, erro: query.error, atualizar: () => void query.refetch(), de, ate };
}
