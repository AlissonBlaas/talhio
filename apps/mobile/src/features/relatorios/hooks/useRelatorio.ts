import type { Periodo } from '@talhio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { relatoriosApi } from '../api/relatoriosApi';
import { relatoriosKeys } from '../relatorios.keys';

/** `maquinaIds`: só essas máquinas entram no relatório; vazio = a fazenda inteira. */
export function useRelatorio(periodo: Periodo, data: string | null, maquinaIds: string[] = []) {
  const queryClient = useQueryClient();
  const chave = relatoriosKeys.periodo(periodo, data, maquinaIds);
  const query = useQuery({
    queryKey: chave,
    queryFn: () => relatoriosApi.buscar(periodo, data, maquinaIds),
    // Relatório muda devagar: fresco por 5 min. Ao trocar de período ou de dia, mostra o anterior até o novo chegar.
    // Ao trocar as MÁQUINAS não: o anterior é de outras máquinas, então a tela volta ao esqueleto e remonta.
    staleTime: 5 * 60 * 1000,
    placeholderData: (anterior, consultaAnterior) => (consultaAnterior?.queryKey[3] === chave[3] ? anterior : undefined),
  });
  return {
    relatorio: query.data ?? null,
    carregando: query.isPending,
    /** true enquanto ainda aparece o relatório anterior. */
    trocando: query.isPlaceholderData,
    erro: query.error,
    atualizando: query.isRefetching && !query.isPlaceholderData,
    atualizar: () => void query.refetch(),
    /**
     * Chame ao aplicar uma escolha de máquinas: joga fora o relatório guardado dessa escolha, para a tela mostrar
     * o esqueleto e buscar de novo (mesmo que a escolha seja igual à de antes).
     */
    refazerPara: (novasMaquinaIds: string[]) => void queryClient.resetQueries({ queryKey: relatoriosKeys.periodo(periodo, data, novasMaquinaIds), exact: true }),
  };
}
